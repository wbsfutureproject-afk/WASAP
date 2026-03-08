const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const helmet = require("helmet");
const compression = require("compression");

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const publicDir = __dirname;
const dataDir = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.join(__dirname, "data");
const storageFilePath = process.env.STORAGE_FILE_PATH
	? path.resolve(process.env.STORAGE_FILE_PATH)
	: path.join(dataDir, "storage.json");
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const EMPTY_STORE = {
	kta: [],
	tta: [],
	departments: [],
	pics: [],
	users: [],
};

const SYSTEM_USERS = {
	superadmin: { username: "superadmin", password: "superadmin", role: "Super Admin" },
	admin: { username: "admin", password: "admin", role: "Admin" },
	user: { username: "user", password: "user", role: "User" },
};

const issuedTokens = new Map();

function issueAuthToken(account) {
	const token = crypto.randomBytes(24).toString("hex");
	issuedTokens.set(token, {
		username: account.username,
		role: account.role,
		issuedAt: Date.now(),
	});
	return token;
}

async function ensureStorageFile() {
	await fs.mkdir(dataDir, { recursive: true });

	try {
		await fs.access(storageFilePath);
	} catch (error) {
		await fs.writeFile(storageFilePath, JSON.stringify(EMPTY_STORE, null, 2), "utf-8");
	}
}

async function readStore() {
	await ensureStorageFile();

	try {
		const raw = await fs.readFile(storageFilePath, "utf-8");
		const parsed = JSON.parse(raw);

		return {
			kta: Array.isArray(parsed?.kta) ? parsed.kta : [],
			tta: Array.isArray(parsed?.tta) ? parsed.tta : [],
			departments: Array.isArray(parsed?.departments) ? parsed.departments : [],
			pics: Array.isArray(parsed?.pics) ? parsed.pics : [],
			users: Array.isArray(parsed?.users) ? parsed.users : [],
		};
	} catch (error) {
		await fs.writeFile(storageFilePath, JSON.stringify(EMPTY_STORE, null, 2), "utf-8");
		return { ...EMPTY_STORE };
	}
}

async function writeStore(nextStore) {
	const sanitizedStore = {
		kta: Array.isArray(nextStore?.kta) ? nextStore.kta : [],
		tta: Array.isArray(nextStore?.tta) ? nextStore.tta : [],
		departments: Array.isArray(nextStore?.departments) ? nextStore.departments : [],
		pics: Array.isArray(nextStore?.pics) ? nextStore.pics : [],
		users: Array.isArray(nextStore?.users) ? nextStore.users : [],
	};

	await ensureStorageFile();
	await fs.writeFile(storageFilePath, JSON.stringify(sanitizedStore, null, 2), "utf-8");
}

app.use(helmet({
	contentSecurityPolicy: false,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
	if (!req.path.startsWith("/api/")) {
		next();
		return;
	}

	const requestOrigin = req.headers.origin;
	const hasSpecificOrigins = allowedOrigins.length > 0;
	const isAllowedOrigin = !hasSpecificOrigins || (requestOrigin && allowedOrigins.includes(requestOrigin));

	if (isAllowedOrigin) {
		if (hasSpecificOrigins && requestOrigin) {
			res.setHeader("Access-Control-Allow-Origin", requestOrigin);
			res.setHeader("Vary", "Origin");
		} else {
			res.setHeader("Access-Control-Allow-Origin", "*");
		}

		res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
	}

	if (req.method === "OPTIONS") {
		res.status(isAllowedOrigin ? 204 : 403).end();
		return;
	}

	next();
});

app.get("/api/health", (req, res) => {
	res.json({
		status: "ok",
		app: "SHE WBS",
		timestamp: new Date().toISOString(),
	});
});

app.get("/api/kta", async (req, res) => {
	const store = await readStore();
	res.json({ data: store.kta });
});

app.put("/api/kta", async (req, res) => {
	const incoming = Array.isArray(req.body) ? req.body : req.body?.data;
	if (!Array.isArray(incoming)) {
		res.status(400).json({ message: "Body harus array atau object { data: [] }." });
		return;
	}

	const store = await readStore();
	store.kta = incoming;
	await writeStore(store);
	res.json({ message: "KTA records updated.", count: store.kta.length });
});

app.get("/api/tta", async (req, res) => {
	const store = await readStore();
	res.json({ data: store.tta });
});

app.put("/api/tta", async (req, res) => {
	const incoming = Array.isArray(req.body) ? req.body : req.body?.data;
	if (!Array.isArray(incoming)) {
		res.status(400).json({ message: "Body harus array atau object { data: [] }." });
		return;
	}

	const store = await readStore();
	store.tta = incoming;
	await writeStore(store);
	res.json({ message: "TTA records updated.", count: store.tta.length });
});

app.get("/api/master", async (req, res) => {
	const store = await readStore();
	res.json({
		data: {
			users: store.users,
			departments: store.departments,
			pics: store.pics,
		},
	});
});

app.put("/api/master", async (req, res) => {
	const payload = req.body?.data;
	if (!payload || typeof payload !== "object") {
		res.status(400).json({ message: "Body harus object { data: { users, departments, pics } }." });
		return;
	}

	const store = await readStore();
	store.users = Array.isArray(payload.users) ? payload.users : store.users;
	store.departments = Array.isArray(payload.departments) ? payload.departments : store.departments;
	store.pics = Array.isArray(payload.pics) ? payload.pics : store.pics;

	await writeStore(store);
	res.json({
		message: "Master data updated.",
		counts: {
			users: store.users.length,
			departments: store.departments.length,
			pics: store.pics.length,
		},
	});
});

app.post("/api/auth/login", async (req, res) => {
	const loginIdentifier = String(req.body?.loginIdentifier || "").trim().toLowerCase();
	const password = String(req.body?.password || "");

	if (!loginIdentifier || !password) {
		res.status(400).json({ message: "loginIdentifier dan password wajib diisi." });
		return;
	}

	const systemAccount = SYSTEM_USERS[loginIdentifier];
	if (systemAccount && systemAccount.password === password) {
		const token = issueAuthToken(systemAccount);
		res.json({
			data: {
				username: systemAccount.username,
				role: systemAccount.role,
				token,
			},
		});
		return;
	}

	const store = await readStore();
	const managedAccount = store.users.find((item) => {
		const itemUsername = String(item?.username || "").trim().toLowerCase();
		const itemEmail = String(item?.alamatEmail || "").trim().toLowerCase();
		return itemUsername === loginIdentifier || itemEmail === loginIdentifier;
	});

	if (!managedAccount || String(managedAccount.password || "") !== password) {
		res.status(401).json({ message: "Username/email atau password tidak valid." });
		return;
	}

	const token = issueAuthToken({
		username: managedAccount.username,
		role: managedAccount.kategori,
	});

	res.json({
		data: {
			username: managedAccount.username,
			role: managedAccount.kategori,
			token,
		},
	});
});

app.use(express.static(publicDir));

app.get("*", (req, res) => {
	res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, host, () => {
	console.log(`SHE WBS running on http://${host}:${port}`);
});
