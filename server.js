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
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabaseTable = String(process.env.SUPABASE_TABLE || "wbs_storage").trim();
const supabaseRecordKey = String(process.env.SUPABASE_RECORD_KEY || "she_wbs").trim();
const isSupabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

const EMPTY_STORE = {
	kta: [],
	tta: [],
	departments: [],
	pics: [],
	users: [],
	leaveSettings: [],
};

const SYSTEM_USERS = {
	superadmin: { username: "superadmin", password: "superadmin", role: "Super Admin" },
	admin: { username: "admin", password: "admin", role: "Admin" },
	user: { username: "user", password: "user", role: "User" },
};

const issuedTokens = new Map();

function sanitizeStore(rawStore) {
	return {
		kta: Array.isArray(rawStore?.kta) ? rawStore.kta : [],
		tta: Array.isArray(rawStore?.tta) ? rawStore.tta : [],
		departments: Array.isArray(rawStore?.departments) ? rawStore.departments : [],
		pics: Array.isArray(rawStore?.pics) ? rawStore.pics : [],
		users: Array.isArray(rawStore?.users) ? rawStore.users : [],
		leaveSettings: Array.isArray(rawStore?.leaveSettings) ? rawStore.leaveSettings : [],
	};
}
function issueAuthToken(account) {
	const token = crypto.randomBytes(24).toString("hex");
	issuedTokens.set(token, {
		username: account.username,
		role: account.role,
		issuedAt: Date.now(),
	});
	return token;
}

function isSuperAdminAccount(account) {
	return String(account?.role || "") === "Super Admin";
}

async function ensureStorageFile() {
	await fs.mkdir(dataDir, { recursive: true });

	try {
		await fs.access(storageFilePath);
	} catch (error) {
		await fs.writeFile(storageFilePath, JSON.stringify(EMPTY_STORE, null, 2), "utf-8");
	}
}

function buildSupabaseHeaders(extraHeaders = {}) {
	return {
		apikey: supabaseServiceRoleKey,
		Authorization: `Bearer ${supabaseServiceRoleKey}`,
		"Content-Type": "application/json",
		...extraHeaders,
	};
}

function buildSupabaseTableUrl() {
	return `${supabaseUrl}/rest/v1/${encodeURIComponent(supabaseTable)}`;
}

async function readStoreFromSupabase() {
	const url = new URL(buildSupabaseTableUrl());
	url.searchParams.set("select", "payload");
	url.searchParams.set("key", `eq.${supabaseRecordKey}`);
	url.searchParams.set("limit", "1");

	const response = await fetch(url, {
		method: "GET",
		headers: buildSupabaseHeaders(),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Supabase read failed (${response.status}): ${details}`);
	}

	const rows = await response.json();
	const payload = Array.isArray(rows) && rows[0] && typeof rows[0].payload === "object" ? rows[0].payload : null;

	if (payload) {
		return sanitizeStore(payload);
	}

	const emptyStore = sanitizeStore(EMPTY_STORE);
	await writeStoreToSupabase(emptyStore);
	return emptyStore;
}

async function writeStoreToSupabase(nextStore) {
	const sanitizedStore = sanitizeStore(nextStore);
	const url = new URL(buildSupabaseTableUrl());
	url.searchParams.set("on_conflict", "key");

	const response = await fetch(url, {
		method: "POST",
		headers: buildSupabaseHeaders({
			Prefer: "resolution=merge-duplicates,return=minimal",
		}),
		body: JSON.stringify([
			{
				key: supabaseRecordKey,
				payload: sanitizedStore,
			},
		]),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Supabase write failed (${response.status}): ${details}`);
	}
}

async function readStore() {
	if (isSupabaseEnabled) {
		try {
			return await readStoreFromSupabase();
		} catch (error) {
			console.error("[storage] Gagal baca dari Supabase, fallback ke file storage:", error.message);
		}
	}

	await ensureStorageFile();

	try {
		const raw = await fs.readFile(storageFilePath, "utf-8");
		const parsed = JSON.parse(raw);

		return sanitizeStore(parsed);
	} catch (error) {
		await fs.writeFile(storageFilePath, JSON.stringify(EMPTY_STORE, null, 2), "utf-8");
		return sanitizeStore(EMPTY_STORE);
	}
}

async function writeStore(nextStore) {
	const sanitizedStore = sanitizeStore(nextStore);

	if (isSupabaseEnabled) {
		try {
			await writeStoreToSupabase(sanitizedStore);
			return;
		} catch (error) {
			console.error("[storage] Gagal tulis ke Supabase, fallback ke file storage:", error.message);
		}
	}

	await ensureStorageFile();
	await fs.writeFile(storageFilePath, JSON.stringify(sanitizedStore, null, 2), "utf-8");
}

function normalizeKey(value) {
	return String(value || "").trim().toLowerCase();
}

function isOriginAllowed(requestOrigin) {
	if (allowedOrigins.length === 0) {
		return true;
	}

	if (!requestOrigin) {
		return false;
	}

	let requestHost = "";
	try {
		requestHost = new URL(requestOrigin).hostname.toLowerCase();
	} catch (error) {
		return false;
	}

	return allowedOrigins.some((allowedOrigin) => {
		if (allowedOrigin === requestOrigin) {
			return true;
		}

		let allowedHost = "";
		try {
			const normalizedAllowedOrigin = /^https?:\/\/\*\./i.test(allowedOrigin)
				? allowedOrigin.replace(/^https?:\/\/\*\./i, "https://")
				: allowedOrigin;
			allowedHost = new URL(normalizedAllowedOrigin).hostname.toLowerCase();

			if (allowedHost.endsWith(".vercel.app") && requestHost.endsWith(".vercel.app")) {
				return true;
			}
		} catch (error) {
		}

		const wildcardMatch = allowedOrigin.match(/^(?:https?:\/\/)?\*\.(.+)$/i);
		if (!wildcardMatch) {
			return false;
		}

		const wildcardHost = String(wildcardMatch[1] || "").toLowerCase();
		if (!wildcardHost) {
			return false;
		}

		return requestHost === wildcardHost || requestHost.endsWith(`.${wildcardHost}`);
	});
}

function getBodyObject(body) {
	const payload = body?.data ?? body;
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return null;
	}

	return payload;
}

function getTextFromBody(body, fieldName) {
	const payload = getBodyObject(body);
	if (!payload) {
		return "";
	}

	if (fieldName && payload[fieldName] != null) {
		return String(payload[fieldName]).trim();
	}

	if (payload.name != null) {
		return String(payload.name).trim();
	}

	if (payload.value != null) {
		return String(payload.value).trim();
	}

	return "";
}

function normalizeUserPayload(payload, existingUser = null) {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return null;
	}

	const source = { ...(existingUser || {}), ...payload };
	const normalizedUser = {
		...source,
		username: String(source.username || source.userName || source.user || "").trim(),
		password: String(source.password || source.kataSandi || source.pass || ""),
		alamatEmail: String(source.alamatEmail || source.email || "").trim().toLowerCase(),
		kategori: String(source.kategori || source.role || "").trim(),
	};

	if (!normalizedUser.username || !normalizedUser.password) {
		return null;
	}

	if (!normalizedUser.kategori) {
		normalizedUser.kategori = "User";
	}

	delete normalizedUser.userName;
	delete normalizedUser.user;
	delete normalizedUser.kataSandi;
	delete normalizedUser.pass;
	delete normalizedUser.email;
	delete normalizedUser.role;

	return normalizedUser;
}

function resolveManagedAccount(storeUsers, loginIdentifier) {
	return storeUsers.find((item) => {
		const itemUsername = normalizeKey(item?.username || item?.userName || item?.user);
		const itemEmail = normalizeKey(item?.alamatEmail || item?.email);
		return itemUsername === loginIdentifier || itemEmail === loginIdentifier;
	});
}

app.use(helmet({
	contentSecurityPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use((req, res, next) => {
	if (!req.path.startsWith("/api/")) {
		next();
		return;
	}

	const requestOrigin = req.headers.origin;
	const hasSpecificOrigins = allowedOrigins.length > 0;
	const isAllowedOrigin = !hasSpecificOrigins || isOriginAllowed(requestOrigin);

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

app.use("/api", (req, res, next) => {
	if (req.path === "/health" || req.path === "/auth/login") {
		next();
		return;
	}

	const authHeader = String(req.headers.authorization || "").trim();
	if (!authHeader.startsWith("Bearer ")) {
		res.status(401).json({ message: "Unauthorized. Bearer token dibutuhkan." });
		return;
	}

	const token = authHeader.slice(7).trim();
	const authAccount = issuedTokens.get(token);
	if (!token || !authAccount) {
		res.status(401).json({ message: "Unauthorized. Token tidak valid atau expired." });
		return;
	}

	req.auth = authAccount;

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

app.get("/api/kta/:noId", async (req, res) => {
	const noId = String(req.params.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Parameter noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const record = store.kta.find((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (!record) {
		res.status(404).json({ message: "Record KTA tidak ditemukan." });
		return;
	}

	res.json({ data: record });
});

app.post("/api/kta", async (req, res) => {
	const incoming = getBodyObject(req.body);
	if (!incoming) {
		res.status(400).json({ message: "Body harus object data KTA atau { data: object }." });
		return;
	}

	const noId = String(incoming.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Field noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const duplicate = store.kta.some((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (duplicate) {
		res.status(409).json({ message: "Record KTA dengan noId yang sama sudah ada." });
		return;
	}

	store.kta.push(incoming);
	await writeStore(store);
	res.status(201).json({ message: "Record KTA berhasil dibuat.", data: incoming, count: store.kta.length });
});

app.put("/api/kta/:noId", async (req, res) => {
	const noId = String(req.params.noId || "").trim();
	const incoming = getBodyObject(req.body);
	if (!noId || !incoming) {
		res.status(400).json({ message: "Parameter noId dan body object wajib diisi." });
		return;
	}

	const store = await readStore();
	const index = store.kta.findIndex((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (index < 0) {
		res.status(404).json({ message: "Record KTA tidak ditemukan." });
		return;
	}

	const existing = store.kta[index] || {};
	const updated = { ...existing, ...incoming, noId: existing.noId || noId };
	store.kta[index] = updated;
	await writeStore(store);
	res.json({ message: "Record KTA berhasil diperbarui.", data: updated });
});

app.delete("/api/kta/:noId", async (req, res) => {
	const noId = String(req.params.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Parameter noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const beforeCount = store.kta.length;
	store.kta = store.kta.filter((item) => normalizeKey(item?.noId) !== normalizeKey(noId));

	if (store.kta.length === beforeCount) {
		res.status(404).json({ message: "Record KTA tidak ditemukan." });
		return;
	}

	await writeStore(store);
	res.json({ message: "Record KTA berhasil dihapus.", count: store.kta.length });
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

app.get("/api/tta/:noId", async (req, res) => {
	const noId = String(req.params.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Parameter noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const record = store.tta.find((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (!record) {
		res.status(404).json({ message: "Record TTA tidak ditemukan." });
		return;
	}

	res.json({ data: record });
});

app.post("/api/tta", async (req, res) => {
	const incoming = getBodyObject(req.body);
	if (!incoming) {
		res.status(400).json({ message: "Body harus object data TTA atau { data: object }." });
		return;
	}

	const noId = String(incoming.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Field noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const duplicate = store.tta.some((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (duplicate) {
		res.status(409).json({ message: "Record TTA dengan noId yang sama sudah ada." });
		return;
	}

	store.tta.push(incoming);
	await writeStore(store);
	res.status(201).json({ message: "Record TTA berhasil dibuat.", data: incoming, count: store.tta.length });
});

app.put("/api/tta/:noId", async (req, res) => {
	const noId = String(req.params.noId || "").trim();
	const incoming = getBodyObject(req.body);
	if (!noId || !incoming) {
		res.status(400).json({ message: "Parameter noId dan body object wajib diisi." });
		return;
	}

	const store = await readStore();
	const index = store.tta.findIndex((item) => normalizeKey(item?.noId) === normalizeKey(noId));
	if (index < 0) {
		res.status(404).json({ message: "Record TTA tidak ditemukan." });
		return;
	}

	const existing = store.tta[index] || {};
	const updated = { ...existing, ...incoming, noId: existing.noId || noId };
	store.tta[index] = updated;
	await writeStore(store);
	res.json({ message: "Record TTA berhasil diperbarui.", data: updated });
});

app.delete("/api/tta/:noId", async (req, res) => {
	if (!isSuperAdminAccount(req.auth)) {
		res.status(403).json({ message: "Forbidden. Hanya Super Admin yang dapat menghapus record TTA." });
		return;
	}

	const noId = String(req.params.noId || "").trim();
	if (!noId) {
		res.status(400).json({ message: "Parameter noId wajib diisi." });
		return;
	}

	const store = await readStore();
	const beforeCount = store.tta.length;
	store.tta = store.tta.filter((item) => normalizeKey(item?.noId) !== normalizeKey(noId));

	if (store.tta.length === beforeCount) {
		res.status(404).json({ message: "Record TTA tidak ditemukan." });
		return;
	}

	await writeStore(store);
	res.json({ message: "Record TTA berhasil dihapus.", count: store.tta.length });
});

app.get("/api/master", async (req, res) => {
	const store = await readStore();
	res.json({
		data: {
			users: store.users,
			departments: store.departments,
			pics: store.pics,
			leaveSettings: store.leaveSettings,
		},
	});
});

app.put("/api/master", async (req, res) => {
	const payload = req.body?.data;
	if (!payload || typeof payload !== "object") {
		res.status(400).json({ message: "Body harus object { data: { users, departments, pics, leaveSettings } }." });
		return;
	}

	const store = await readStore();
	store.users = Array.isArray(payload.users) ? payload.users : store.users;
	store.departments = Array.isArray(payload.departments) ? payload.departments : store.departments;
	store.pics = Array.isArray(payload.pics) ? payload.pics : store.pics;
	store.leaveSettings = Array.isArray(payload.leaveSettings) ? payload.leaveSettings : store.leaveSettings;

	await writeStore(store);
	res.json({
		message: "Master data updated.",
		counts: {
			users: store.users.length,
			departments: store.departments.length,
			pics: store.pics.length,
			leaveSettings: store.leaveSettings.length,
		},
	});
});

app.get("/api/users", async (req, res) => {
	const store = await readStore();
	res.json({ data: store.users });
});

app.get("/api/users/:username", async (req, res) => {
	const username = String(req.params.username || "").trim();
	if (!username) {
		res.status(400).json({ message: "Parameter username wajib diisi." });
		return;
	}

	const store = await readStore();
	const user = store.users.find((item) => normalizeKey(item?.username) === normalizeKey(username));
	if (!user) {
		res.status(404).json({ message: "User tidak ditemukan." });
		return;
	}

	res.json({ data: user });
});

app.post("/api/users", async (req, res) => {
	const incoming = getBodyObject(req.body);
	if (!incoming) {
		res.status(400).json({ message: "Body harus object data user atau { data: object }." });
		return;
	}

	const normalizedUser = normalizeUserPayload(incoming);
	if (!normalizedUser) {
		res.status(400).json({ message: "Field username dan password wajib diisi." });
		return;
	}

	const username = normalizedUser.username;

	const store = await readStore();
	const duplicate = store.users.some((item) => normalizeKey(item?.username) === normalizeKey(username));
	if (duplicate) {
		res.status(409).json({ message: "User dengan username yang sama sudah ada." });
		return;
	}

	store.users.push(normalizedUser);
	await writeStore(store);
	res.status(201).json({ message: "User berhasil dibuat.", data: normalizedUser, count: store.users.length });
});

app.put("/api/users/:username", async (req, res) => {
	const username = String(req.params.username || "").trim();
	const incoming = getBodyObject(req.body);
	if (!username || !incoming) {
		res.status(400).json({ message: "Parameter username dan body object wajib diisi." });
		return;
	}

	const store = await readStore();
	const index = store.users.findIndex((item) => normalizeKey(item?.username) === normalizeKey(username));
	if (index < 0) {
		res.status(404).json({ message: "User tidak ditemukan." });
		return;
	}

	const existing = store.users[index] || {};
	const updated = normalizeUserPayload(incoming, existing);
	if (!updated) {
		res.status(400).json({ message: "Field username dan password wajib diisi." });
		return;
	}

	updated.username = existing.username || username;
	store.users[index] = updated;
	await writeStore(store);
	res.json({ message: "User berhasil diperbarui.", data: updated });
});

app.delete("/api/users/:username", async (req, res) => {
	const username = String(req.params.username || "").trim();
	if (!username) {
		res.status(400).json({ message: "Parameter username wajib diisi." });
		return;
	}

	const store = await readStore();
	const beforeCount = store.users.length;
	store.users = store.users.filter((item) => normalizeKey(item?.username) !== normalizeKey(username));

	if (store.users.length === beforeCount) {
		res.status(404).json({ message: "User tidak ditemukan." });
		return;
	}

	await writeStore(store);
	res.json({ message: "User berhasil dihapus.", count: store.users.length });
});

app.get("/api/departments", async (req, res) => {
	const store = await readStore();
	res.json({ data: store.departments });
});

app.post("/api/departments", async (req, res) => {
	const name = getTextFromBody(req.body, "name");
	if (!name) {
		res.status(400).json({ message: "Nama departemen wajib diisi." });
		return;
	}

	const store = await readStore();
	const duplicate = store.departments.some((item) => normalizeKey(item) === normalizeKey(name));
	if (duplicate) {
		res.status(409).json({ message: "Departemen sudah ada." });
		return;
	}

	store.departments.push(name);
	await writeStore(store);
	res.status(201).json({ message: "Departemen berhasil dibuat.", data: name, count: store.departments.length });
});

app.put("/api/departments/:name", async (req, res) => {
	const currentName = String(req.params.name || "").trim();
	const nextName = getTextFromBody(req.body, "name");
	if (!currentName || !nextName) {
		res.status(400).json({ message: "Nama departemen lama dan baru wajib diisi." });
		return;
	}

	const store = await readStore();
	const index = store.departments.findIndex((item) => normalizeKey(item) === normalizeKey(currentName));
	if (index < 0) {
		res.status(404).json({ message: "Departemen tidak ditemukan." });
		return;
	}

	const duplicate = store.departments.some((item, itemIndex) => itemIndex !== index && normalizeKey(item) === normalizeKey(nextName));
	if (duplicate) {
		res.status(409).json({ message: "Nama departemen sudah digunakan." });
		return;
	}

	store.departments[index] = nextName;
	await writeStore(store);
	res.json({ message: "Departemen berhasil diperbarui.", data: nextName });
});

app.delete("/api/departments/:name", async (req, res) => {
	const name = String(req.params.name || "").trim();
	if (!name) {
		res.status(400).json({ message: "Nama departemen wajib diisi." });
		return;
	}

	const store = await readStore();
	const beforeCount = store.departments.length;
	store.departments = store.departments.filter((item) => normalizeKey(item) !== normalizeKey(name));

	if (store.departments.length === beforeCount) {
		res.status(404).json({ message: "Departemen tidak ditemukan." });
		return;
	}

	await writeStore(store);
	res.json({ message: "Departemen berhasil dihapus.", count: store.departments.length });
});

app.get("/api/pics", async (req, res) => {
	const store = await readStore();
	res.json({ data: store.pics });
});

app.post("/api/pics", async (req, res) => {
	const name = getTextFromBody(req.body, "name");
	if (!name) {
		res.status(400).json({ message: "Nama PIC wajib diisi." });
		return;
	}

	const store = await readStore();
	const duplicate = store.pics.some((item) => normalizeKey(item) === normalizeKey(name));
	if (duplicate) {
		res.status(409).json({ message: "PIC sudah ada." });
		return;
	}

	store.pics.push(name);
	await writeStore(store);
	res.status(201).json({ message: "PIC berhasil dibuat.", data: name, count: store.pics.length });
});

app.put("/api/pics/:name", async (req, res) => {
	const currentName = String(req.params.name || "").trim();
	const nextName = getTextFromBody(req.body, "name");
	if (!currentName || !nextName) {
		res.status(400).json({ message: "Nama PIC lama dan baru wajib diisi." });
		return;
	}

	const store = await readStore();
	const index = store.pics.findIndex((item) => normalizeKey(item) === normalizeKey(currentName));
	if (index < 0) {
		res.status(404).json({ message: "PIC tidak ditemukan." });
		return;
	}

	const duplicate = store.pics.some((item, itemIndex) => itemIndex !== index && normalizeKey(item) === normalizeKey(nextName));
	if (duplicate) {
		res.status(409).json({ message: "Nama PIC sudah digunakan." });
		return;
	}

	store.pics[index] = nextName;
	await writeStore(store);
	res.json({ message: "PIC berhasil diperbarui.", data: nextName });
});

app.delete("/api/pics/:name", async (req, res) => {
	const name = String(req.params.name || "").trim();
	if (!name) {
		res.status(400).json({ message: "Nama PIC wajib diisi." });
		return;
	}

	const store = await readStore();
	const beforeCount = store.pics.length;
	store.pics = store.pics.filter((item) => normalizeKey(item) !== normalizeKey(name));

	if (store.pics.length === beforeCount) {
		res.status(404).json({ message: "PIC tidak ditemukan." });
		return;
	}

	await writeStore(store);
	res.json({ message: "PIC berhasil dihapus.", count: store.pics.length });
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
	const managedAccount = resolveManagedAccount(store.users, loginIdentifier);
	const managedPassword = String(managedAccount?.password || managedAccount?.kataSandi || managedAccount?.pass || "");

	if (!managedAccount || managedPassword !== password) {
		res.status(401).json({ message: "Username/email atau password tidak valid." });
		return;
	}

	const managedRole = String(managedAccount.kategori || managedAccount.role || "User").trim() || "User";
	const managedUsername = String(managedAccount.username || managedAccount.userName || managedAccount.user || "").trim();

	const token = issueAuthToken({
		username: managedUsername,
		role: managedRole,
	});

	res.json({
		data: {
			username: managedUsername,
			role: managedRole,
			token,
		},
	});
});

app.use(express.static(publicDir));

app.get("*", (req, res) => {
	res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, host, () => {
	if (isSupabaseEnabled) {
		console.log(`[storage] Supabase aktif (table: ${supabaseTable}, key: ${supabaseRecordKey}).`);
	} else {
		console.log(`[storage] File storage aktif (${storageFilePath}).`);
	}
	console.log(`SHE WBS running on http://${host}:${port}`);
});
