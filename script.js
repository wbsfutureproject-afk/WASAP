const app = document.getElementById("app");
const SESSION_KEY = "she_wbs_session";
const DEPARTMENTS_KEY = "she_wbs_departments";
const PICS_KEY = "she_wbs_pics";
const USER_MASTER_KEY = "she_wbs_user_master";
const KTA_KEY = "she_wbs_kta";
const TTA_KEY = "she_wbs_tta";
const BACKEND_HEALTH_ENDPOINT = "/api/health";
const KTA_SYNC_ENDPOINT = "/api/kta";
const TTA_SYNC_ENDPOINT = "/api/tta";
const MASTER_SYNC_ENDPOINT = "/api/master";
const AUTH_LOGIN_ENDPOINT = "/api/auth/login";
const USERS_ENDPOINT = "/api/users";
const DEPARTMENTS_ENDPOINT = "/api/departments";
const PICS_ENDPOINT = "/api/pics";
const SESSION_EXPIRED_NOTICE = "Sesi berakhir, silakan login ulang.";
const DEFAULT_TEMUAN_CATEGORIES = [
	"Unsafe Action",
	"Unsafe Condition",
	"Near Miss",
	"Property Damage",
	"Environmental Incident",
	"Others",
];
const DEFAULT_LOKASI_TEMUAN = [
	"Jetty, BLC dan MCC room",
	"jetty manual",
	"stockpile",
	"rumah genset jetty",
	"shelter office GL",
	"KPL hulu",
	"KPL hilir",
	"Fuel Storage",
	"Jembatan Timbang 1",
	"Jembatan Timbang 2",
	"Workshop port",
	"TPS LB3 Port",
	"Gudang Oli Port",
	"Rumah Genset Workshop",
	"Warehouse",
	"Office",
	"Jalan Hauling",
	"Jembatan Pertagas 1",
	"Jembatan Keramasan",
	"Jembatan Pertagas 2",
	"Workshop CY",
	"TPS LB3 CY",
	"Gudang oli CY",
	"Rumah Genset CY",
	"Shelter CY",
	"KPL CY",
	"CY",
	"Rel WBS",
];

const USERS = {
	superadmin: { username: "superadmin", password: "superadmin", role: "Super Admin" },
	admin: { username: "admin", password: "admin", role: "Admin" },
	user: { username: "user", password: "user", role: "User" },
};

const ROLE_MENUS = {
	"Super Admin": [
		"My Profile",
		"Achievement",
		"Tasklist",
		"Daftar User",
		"Daftar Departemen",
		"Daftar PIC",
		"Logout",
	],
	Admin: ["My Profile", "Achievement", "Tasklist", "Daftar User", "Logout"],
	User: ["My Profile", "Achievement", "Tasklist", "Logout"],
};

function resolveApiBaseUrl() {
	const metaElement = document.querySelector('meta[name="api-base-url"]');
	const configuredValue = String(metaElement?.content || "").trim();
	return configuredValue.replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

function toApiUrl(endpoint) {
	const path = String(endpoint || "").trim();
	if (!path) {
		return API_BASE_URL || "/";
	}

	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	if (!API_BASE_URL) {
		return path;
	}

	return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getSession() {
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw);
	} catch (error) {
		localStorage.removeItem(SESSION_KEY);
		return null;
	}
}

function buildAuthHeaders(extraHeaders = {}) {
	const session = getSession();
	const token = String(session?.token || "").trim();

	if (!token) {
		return { ...extraHeaders };
	}

	return {
		...extraHeaders,
		Authorization: `Bearer ${token}`,
	};
}

let isHandlingUnauthorized = false;
let pendingSessionNotice = "";

function handleUnauthorizedResponse() {
	if (isHandlingUnauthorized) {
		return;
	}

	const session = getSession();
	if (!session) {
		return;
	}

	isHandlingUnauthorized = true;
	pendingSessionNotice = SESSION_EXPIRED_NOTICE;
	clearSession();
	renderApp();
	setTimeout(() => {
		isHandlingUnauthorized = false;
	}, 0);
}

function encodePathSegment(value) {
	return encodeURIComponent(String(value || "").trim());
}

async function apiRequest(endpoint, options = {}) {
	const method = String(options.method || "GET").toUpperCase();
	const hasBody = options.body !== undefined;

	const headers = buildAuthHeaders({
		Accept: "application/json",
		...(hasBody ? { "Content-Type": "application/json" } : {}),
		...(options.headers || {}),
	});

	try {
		const response = await fetch(toApiUrl(endpoint), {
			method,
			headers,
			...(hasBody ? { body: JSON.stringify(options.body) } : {}),
		});

		let payload = null;
		try {
			payload = await response.json();
		} catch (error) {
			payload = null;
		}

		if (response.status === 401) {
			handleUnauthorizedResponse();
		}

		return {
			ok: response.ok,
			status: response.status,
			payload,
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			payload: { message: "Gagal terhubung ke backend." },
		};
	}
}

function getApiErrorMessage(result, fallbackMessage) {
	const message = String(result?.payload?.message || "").trim();
	if (message) {
		return message;
	}

	if (result?.status === 401) {
		return "Sesi login tidak valid atau sudah berakhir. Silakan login ulang.";
	}

	return fallbackMessage;
}

async function runWithButtonLoading(buttonElement, loadingText, action) {
	if (!buttonElement) {
		await action();
		return;
	}

	const originalText = buttonElement.textContent;
	buttonElement.disabled = true;
	buttonElement.textContent = loadingText;

	try {
		await action();
	} finally {
		buttonElement.disabled = false;
		buttonElement.textContent = originalText;
	}
}

async function runWithFormControlsDisabled(formElement, action) {
	if (!formElement) {
		await action();
		return;
	}

	const controls = Array.from(formElement.elements || []);
	const previousDisabledStates = controls.map((control) => Boolean(control.disabled));

	controls.forEach((control) => {
		control.disabled = true;
	});

	try {
		await action();
	} finally {
		controls.forEach((control, index) => {
			control.disabled = previousDisabledStates[index];
		});
	}
}

async function createKtaRecord(record) {
	return apiRequest(KTA_SYNC_ENDPOINT, { method: "POST", body: { data: record } });
}

async function updateKtaRecord(noId, updates) {
	return apiRequest(`${KTA_SYNC_ENDPOINT}/${encodePathSegment(noId)}`, {
		method: "PUT",
		body: { data: updates },
	});
}

async function deleteKtaRecord(noId) {
	return apiRequest(`${KTA_SYNC_ENDPOINT}/${encodePathSegment(noId)}`, { method: "DELETE" });
}

async function createTtaRecord(record) {
	return apiRequest(TTA_SYNC_ENDPOINT, { method: "POST", body: { data: record } });
}

async function updateTtaRecord(noId, updates) {
	return apiRequest(`${TTA_SYNC_ENDPOINT}/${encodePathSegment(noId)}`, {
		method: "PUT",
		body: { data: updates },
	});
}

async function deleteTtaRecord(noId) {
	return apiRequest(`${TTA_SYNC_ENDPOINT}/${encodePathSegment(noId)}`, { method: "DELETE" });
}

async function createManagedUser(userData) {
	return apiRequest(USERS_ENDPOINT, { method: "POST", body: { data: userData } });
}

async function updateManagedUser(username, updates) {
	return apiRequest(`${USERS_ENDPOINT}/${encodePathSegment(username)}`, {
		method: "PUT",
		body: { data: updates },
	});
}

async function deleteManagedUser(username) {
	return apiRequest(`${USERS_ENDPOINT}/${encodePathSegment(username)}`, { method: "DELETE" });
}

async function createDepartment(name) {
	return apiRequest(DEPARTMENTS_ENDPOINT, { method: "POST", body: { name } });
}

async function updateDepartment(currentName, nextName) {
	return apiRequest(`${DEPARTMENTS_ENDPOINT}/${encodePathSegment(currentName)}`, {
		method: "PUT",
		body: { name: nextName },
	});
}

async function deleteDepartment(name) {
	return apiRequest(`${DEPARTMENTS_ENDPOINT}/${encodePathSegment(name)}`, { method: "DELETE" });
}

async function createPic(name) {
	return apiRequest(PICS_ENDPOINT, { method: "POST", body: { name } });
}

async function updatePic(currentName, nextName) {
	return apiRequest(`${PICS_ENDPOINT}/${encodePathSegment(currentName)}`, {
		method: "PUT",
		body: { name: nextName },
	});
}

async function deletePic(name) {
	return apiRequest(`${PICS_ENDPOINT}/${encodePathSegment(name)}`, { method: "DELETE" });
}

async function updateBackendStatus() {
	const statusElement = document.getElementById("backendStatus");
	if (!statusElement) {
		return;
	}

	statusElement.textContent = "Backend: checking...";
	statusElement.classList.remove("backend-status-online", "backend-status-offline");

	try {
		const response = await fetch(toApiUrl(BACKEND_HEALTH_ENDPOINT), {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error("Health check failed");
		}

		statusElement.textContent = "Backend: online";
		statusElement.classList.add("backend-status-online");
	} catch (error) {
		statusElement.textContent = "Backend: offline";
		statusElement.classList.add("backend-status-offline");
	}
}

async function fetchRecordsFromBackend(endpoint) {
	try {
		const response = await fetch(toApiUrl(endpoint), {
			method: "GET",
			headers: buildAuthHeaders({
				Accept: "application/json",
			}),
		});

		if (!response.ok) {
			if (response.status === 401) {
				handleUnauthorizedResponse();
			}
			return null;
		}

		const payload = await response.json();
		const records = Array.isArray(payload?.data) ? payload.data : null;
		return records;
	} catch (error) {
		return null;
	}
}

async function pushRecordsToBackend(endpoint, records) {
	try {
		const response = await fetch(toApiUrl(endpoint), {
			method: "PUT",
			headers: buildAuthHeaders({
				"Content-Type": "application/json",
			}),
			body: JSON.stringify({ data: records }),
		});

		if (!response.ok && response.status === 401) {
			handleUnauthorizedResponse();
		}
	} catch (error) {
		return;
	}
}

function readLocalArray(localStorageKey) {
	const raw = localStorage.getItem(localStorageKey);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		return [];
	}
}

function writeLocalArray(localStorageKey, records) {
	localStorage.setItem(localStorageKey, JSON.stringify(Array.isArray(records) ? records : []));
}

async function syncArrayData(endpoint, localStorageKey) {
	const backendRecords = await fetchRecordsFromBackend(endpoint);
	const localRecords = readLocalArray(localStorageKey);

	if (Array.isArray(backendRecords) && backendRecords.length > 0) {
		writeLocalArray(localStorageKey, backendRecords);
		return;
	}

	if (localRecords.length > 0) {
		await pushRecordsToBackend(endpoint, localRecords);
	}
}

async function fetchMasterFromBackend() {
	try {
		const response = await fetch(toApiUrl(MASTER_SYNC_ENDPOINT), {
			method: "GET",
			headers: buildAuthHeaders({
				Accept: "application/json",
			}),
		});

		if (!response.ok) {
			if (response.status === 401) {
				handleUnauthorizedResponse();
			}
			return null;
		}

		const payload = await response.json();
		const data = payload?.data;
		if (!data || typeof data !== "object") {
			return null;
		}

		return {
			users: Array.isArray(data.users) ? data.users : [],
			departments: Array.isArray(data.departments) ? data.departments : [],
			pics: Array.isArray(data.pics) ? data.pics : [],
		};
	} catch (error) {
		return null;
	}
}

async function pushMasterToBackend(masterData) {
	try {
		const response = await fetch(toApiUrl(MASTER_SYNC_ENDPOINT), {
			method: "PUT",
			headers: buildAuthHeaders({
				"Content-Type": "application/json",
			}),
			body: JSON.stringify({ data: masterData }),
		});

		if (!response.ok && response.status === 401) {
			handleUnauthorizedResponse();
		}
	} catch (error) {
		return;
	}
}

function getLocalMasterData() {
	return {
		users: readLocalArray(USER_MASTER_KEY),
		departments: readLocalArray(DEPARTMENTS_KEY),
		pics: readLocalArray(PICS_KEY),
	};
}

async function hydrateMasterFromBackend() {
	const backendMaster = await fetchMasterFromBackend();
	const localMaster = getLocalMasterData();

	if (backendMaster && (backendMaster.users.length > 0 || backendMaster.departments.length > 0 || backendMaster.pics.length > 0)) {
		writeLocalArray(USER_MASTER_KEY, backendMaster.users);
		writeLocalArray(DEPARTMENTS_KEY, backendMaster.departments);
		writeLocalArray(PICS_KEY, backendMaster.pics);
		return;
	}

	if (localMaster.users.length > 0 || localMaster.departments.length > 0 || localMaster.pics.length > 0) {
		await pushMasterToBackend(localMaster);
	}
}

async function hydrateRecordsFromBackend() {
	await Promise.all([
		syncArrayData(KTA_SYNC_ENDPOINT, KTA_KEY),
		syncArrayData(TTA_SYNC_ENDPOINT, TTA_KEY),
		hydrateMasterFromBackend(),
	]);
}

function setSession(session) {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
	localStorage.removeItem(SESSION_KEY);
}

function getDepartments() {
	const raw = localStorage.getItem(DEPARTMENTS_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		localStorage.removeItem(DEPARTMENTS_KEY);
		return [];
	}
}

function setDepartments(departments) {
	localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(departments));
	pushMasterToBackend({
		users: getManagedUsers(),
		departments,
		pics: getPics(),
	});
}

function getPics() {
	const raw = localStorage.getItem(PICS_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) {
			return [];
		}

		let shouldPersistCleanup = false;
		const seen = new Set();
		const cleanedPics = [];

		data.forEach((item) => {
			const rawName = String(item || "").trim();
			if (!rawName) {
				shouldPersistCleanup = true;
				return;
			}

			const mappedFullName = getUserFullNameFromIdentifier(rawName);
			const finalName = String(mappedFullName && mappedFullName !== "-" ? mappedFullName : rawName).trim();
			if (!finalName) {
				shouldPersistCleanup = true;
				return;
			}

			if (finalName !== rawName) {
				shouldPersistCleanup = true;
			}

			const dedupeKey = finalName.toLowerCase();
			if (seen.has(dedupeKey)) {
				shouldPersistCleanup = true;
				return;
			}

			seen.add(dedupeKey);
			cleanedPics.push(finalName);
		});

		if (shouldPersistCleanup) {
			setPics(cleanedPics);
		}

		return cleanedPics;
	} catch (error) {
		localStorage.removeItem(PICS_KEY);
		return [];
	}
}

function setPics(pics) {
	localStorage.setItem(PICS_KEY, JSON.stringify(pics));
	pushMasterToBackend({
		users: getManagedUsers(),
		departments: getDepartments(),
		pics,
	});
}

function getManagedUsers() {
	const raw = localStorage.getItem(USER_MASTER_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) {
			return [];
		}

		let shouldPersistCleanup = false;
		const cleanedUsers = data.map((item) => {
			if (!item || typeof item !== "object") {
				return item;
			}

			if (
				!("alamatLengkap" in item) &&
				!("noKtp" in item) &&
				!("noMinePermit" in item) &&
				!("tempatLahir" in item) &&
				!("tanggalLahir" in item)
			) {
				return item;
			}

			shouldPersistCleanup = true;
			const { alamatLengkap, noKtp, noMinePermit, tempatLahir, tanggalLahir, ...rest } = item;
			return rest;
		});

		if (shouldPersistCleanup) {
			setManagedUsers(cleanedUsers);
		}

		return cleanedUsers;
	} catch (error) {
		localStorage.removeItem(USER_MASTER_KEY);
		return [];
	}
}

function setManagedUsers(users) {
	localStorage.setItem(USER_MASTER_KEY, JSON.stringify(users));
	pushMasterToBackend({
		users,
		departments: getDepartments(),
		pics: getPics(),
	});
}

function getKtaRecords() {
	const raw = localStorage.getItem(KTA_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) {
			return [];
		}

		let shouldPersistCleanup = false;
		const migratedRecords = data.map((item) => {
			if (!item || typeof item !== "object") {
				return item;
			}

			const directFix = String(item.perbaikanLangsung || "").trim();
			const status = String(item.status || "").trim();
			if (directFix === "Tidak" && !status) {
				shouldPersistCleanup = true;
				return {
					...item,
					status: "Open",
				};
			}

			return item;
		});

		if (shouldPersistCleanup) {
			setKtaRecords(migratedRecords);
		}

		return migratedRecords;
	} catch (error) {
		localStorage.removeItem(KTA_KEY);
		return [];
	}
}

function setKtaRecords(records) {
	localStorage.setItem(KTA_KEY, JSON.stringify(records));
	pushRecordsToBackend(KTA_SYNC_ENDPOINT, records);
}

function getTtaRecords() {
	const raw = localStorage.getItem(TTA_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) {
			return [];
		}

		let shouldPersistCleanup = false;
		const migratedRecords = data.map((item) => {
			if (!item || typeof item !== "object") {
				return item;
			}

			let nextItem = item;
			const directFix = String(item.perbaikanLangsung || "").trim();
			const status = String(item.status || "").trim();
			if (directFix === "Tidak" && !status) {
				shouldPersistCleanup = true;
				nextItem = {
					...nextItem,
					status: "Open",
				};
			}

			const currentPelaku = String(item.namaPelakuTta || "").trim();
			if (!currentPelaku) {
				return nextItem;
			}

			const fullName = getUserFullNameFromIdentifier(currentPelaku);
			if (!fullName || fullName === "-" || fullName === currentPelaku) {
				return nextItem;
			}

			shouldPersistCleanup = true;
			return {
				...nextItem,
				namaPelakuTta: fullName,
			};
		});

		if (shouldPersistCleanup) {
			setTtaRecords(migratedRecords);
		}

		return migratedRecords;
	} catch (error) {
		localStorage.removeItem(TTA_KEY);
		return [];
	}
}

function setTtaRecords(records) {
	localStorage.setItem(TTA_KEY, JSON.stringify(records));
	pushRecordsToBackend(TTA_SYNC_ENDPOINT, records);
}

function getTodayDate() {
	return new Date().toISOString().slice(0, 10);
}

function createKtaId() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const year = String(now.getFullYear());
	const runningNumber = String(getKtaRecords().length + 1).padStart(4, "0");
	return `KTA - ${month}/${year} - ${runningNumber}`;
}

function createTtaId() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const year = String(now.getFullYear());
	const runningNumber = String(getTtaRecords().length + 1).padStart(4, "0");
	return `TTA - ${month}/${year} - ${runningNumber}`;
}

function readFilesAsDataUrls(fileList) {
	const files = Array.from(fileList || []);
	if (files.length === 0) {
		return Promise.resolve([]);
	}

	const promises = files.map(
		(file) =>
			new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = () => {
					resolve({ name: file.name, dataUrl: String(reader.result || "") });
				};
				reader.onerror = () => {
					resolve({ name: file.name, dataUrl: "" });
				};
				reader.readAsDataURL(file);
			}),
	);

	return Promise.all(promises);
}

function getUserList() {
	return getManagedUsers().map((item) => item.username);
}

function getManagedUserByUsername(username) {
	const normalizedUsername = String(username || "").trim().toLowerCase();
	if (!normalizedUsername) {
		return null;
	}

	return getManagedUsers().find((item) => String(item.username || "").trim().toLowerCase() === normalizedUsername) || null;
}

function getUserFullNameFromIdentifier(identifier) {
	const normalizedIdentifier = String(identifier || "").trim();
	if (!normalizedIdentifier) {
		return "-";
	}

	const byUsername = getManagedUserByUsername(normalizedIdentifier);
	if (byUsername) {
		return String(byUsername.namaLengkap || byUsername.username || "-").trim() || "-";
	}

	const byFullName = getManagedUsers().find(
		(item) => String(item.namaLengkap || "").trim().toLowerCase() === normalizedIdentifier.toLowerCase(),
	);
	if (byFullName) {
		return String(byFullName.namaLengkap || byFullName.username || "-").trim() || "-";
	}

	return normalizedIdentifier;
}

function getTemuanCategoryOptions() {
	const categories = new Set(DEFAULT_TEMUAN_CATEGORIES);

	[...getKtaRecords(), ...getTtaRecords()].forEach((item) => {
		const category = String(item?.kategoriTemuan || "").trim();
		if (category) {
			categories.add(category);
		}
	});

	return Array.from(categories);
}

async function resolveLoginAccount(loginIdentifier, password) {
	try {
		const response = await fetch(toApiUrl(AUTH_LOGIN_ENDPOINT), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ loginIdentifier, password }),
		});

		if (response.ok) {
			const payload = await response.json();
			if (payload?.data?.username && payload?.data?.role && payload?.data?.token) {
				return {
					username: payload.data.username,
					role: payload.data.role,
					token: payload.data.token,
				};
			}
		}
	} catch (error) {
	}

	const normalizedIdentifier = loginIdentifier.trim().toLowerCase();
	const systemAccount = USERS[normalizedIdentifier];
	if (systemAccount && systemAccount.password === password) {
		return { username: systemAccount.username, role: systemAccount.role, token: "local-fallback-token" };
	}

	const managedAccount = getManagedUsers().find((item) => {
		const itemUsername = String(item.username || "").trim().toLowerCase();
		const itemEmail = String(item.alamatEmail || "").trim().toLowerCase();
		return itemUsername === normalizedIdentifier || itemEmail === normalizedIdentifier;
	});
	if (!managedAccount || managedAccount.password !== password) {
		return null;
	}

	return {
		username: managedAccount.username,
		role: managedAccount.kategori,
		token: "local-fallback-token",
	};
}

function getReporterProfile(session) {
	const managedUser = getManagedUsers().find((item) => item.username.toLowerCase() === session.username.toLowerCase());

	if (managedUser) {
		return {
			namaPelapor: managedUser.namaLengkap,
			jabatan: managedUser.jabatan,
			departemen: managedUser.departemen,
			perusahaan: managedUser.perusahaan || "-",
		};
	}

	return {
		namaPelapor: session.username,
		jabatan: "-",
		departemen: "-",
		perusahaan: "-",
	};
}

function renderLogin() {
	app.innerHTML = `
		<section class="card">
			<h1>SHE WBS</h1>
			<p class="subtitle">Silakan login untuk mengakses aplikasi.</p>
			<form id="loginForm" novalidate>
				<div class="field">
					<label for="username">Username atau Email</label>
					<input id="username" name="username" type="text" autocomplete="username" placeholder="Masukkan username atau email" required />
				</div>
				<div class="field">
					<label for="password">Password</label>
					<input id="password" name="password" type="password" autocomplete="current-password" required />
				</div>
				<p id="errorText" class="error"></p>
				<button type="submit" class="btn-primary">Login</button>
			</form>
		</section>
	`;

	const loginForm = document.getElementById("loginForm");
	const usernameInput = document.getElementById("username");
	const passwordInput = document.getElementById("password");
	const errorText = document.getElementById("errorText");
	const loginSubmitButton = loginForm.querySelector('button[type="submit"]');

	if (pendingSessionNotice) {
		errorText.textContent = pendingSessionNotice;
		pendingSessionNotice = "";
	}

	loginForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		errorText.textContent = "";

		await runWithButtonLoading(loginSubmitButton, "Login...", async () => {
			const loginIdentifier = usernameInput.value.trim();
			const password = passwordInput.value.trim();

			const account = await resolveLoginAccount(loginIdentifier, password);

			if (!account) {
				errorText.textContent = "Username/email atau password tidak valid.";
				return;
			}

			setSession(account);
			await hydrateRecordsFromBackend();
			renderApp();
		});
	});
}

function renderDashboard(session) {
	const menuItems = ROLE_MENUS[session.role] || [];
	const menuHtml = menuItems
		.map((item) => {
			const isLogout = item === "Logout";
			return `<button type="button" class="sidebar-item ${isLogout ? "sidebar-logout" : ""}" data-menu="${item}">${item}</button>`;
		})
		.join("");

	app.innerHTML = `
		<section class="dashboard-layout">
			<aside class="sidebar card">
				<h3 class="sidebar-title">SHE WBS</h3>
				<p class="sidebar-role">${session.role}</p>
				<nav class="sidebar-menu">
					${menuHtml}
				</nav>
			</aside>
			<div class="content card" id="contentArea"></div>
		</section>
	`;

	const sidebarButtons = app.querySelectorAll(".sidebar-item");
	const contentArea = document.getElementById("contentArea");

	function renderDefaultContent(activeMenu) {
		contentArea.innerHTML = `
			<h2>Selamat Datang, ${session.role}</h2>
			<p class="subtitle">Menu aktif: ${activeMenu}</p>
			<p class="subtitle">Menu utama aplikasi SHE WBS</p>
			<div class="menu">
				<button type="button" class="menu-item menu-button" data-shortcut="KTA">KTA</button>
				<button type="button" class="menu-item menu-button" data-shortcut="TTA">TTA</button>
			</div>
		`;

		const ktaShortcut = contentArea.querySelector('[data-shortcut="KTA"]');
		if (ktaShortcut) {
			ktaShortcut.addEventListener("click", () => {
				renderKtaContent();
			});
		}

		const ttaShortcut = contentArea.querySelector('[data-shortcut="TTA"]');
		if (ttaShortcut) {
			ttaShortcut.addEventListener("click", () => {
				renderTtaContent();
			});
		}
	}

	function getAchievementMonthLabel(monthKey) {
		const monthNames = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Mei",
			"Jun",
			"Jul",
			"Agu",
			"Sep",
			"Okt",
			"Nov",
			"Des",
		];

		if (!/^\d{4}-\d{2}$/.test(monthKey)) {
			return "Tanpa Tanggal";
		}

		const [year, month] = monthKey.split("-");
		const monthIndex = Number(month) - 1;
		return `${monthNames[monthIndex] || month} ${year}`;
	}

	function escapeAchievementHtml(value) {
		return String(value || "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");
	}

	function toMonthKey(dateValue) {
		const dateText = String(dateValue || "").trim();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
			return "0000-00";
		}

		return dateText.slice(0, 7);
	}

	function normalizeAchievementStatus(status) {
		const statusText = String(status || "").trim().toLowerCase();
		if (statusText === "open") {
			return "Open";
		}
		if (statusText === "progress") {
			return "Progress";
		}
		if (statusText === "close") {
			return "Close";
		}
		return null;
	}

	function buildAchievementSeries(records) {
		const monthly = {};

		records.forEach((item) => {
			const status = normalizeAchievementStatus(item.status);
			if (!status) {
				return;
			}

			const monthKey = toMonthKey(item.tanggalLaporan);
			if (!monthly[monthKey]) {
				monthly[monthKey] = { monthKey, Open: 0, Progress: 0, Close: 0 };
			}

			monthly[monthKey][status] += 1;
		});

		return Object.values(monthly).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
	}

	function renderAchievementChart(title, records) {
		const series = buildAchievementSeries(records);
		const maxValue = Math.max(
			1,
			...series.flatMap((item) => [item.Open, item.Progress, item.Close]),
		);

		const chartBody =
			series.length === 0
				? `<p class="subtitle">Belum ada data status Open/Progress/Close.</p>`
				: `
					<div class="achievement-chart-grid">
						${series
							.map((item) => {
								const label = getAchievementMonthLabel(item.monthKey);
								const openHeight = Math.round((item.Open / maxValue) * 110);
								const progressHeight = Math.round((item.Progress / maxValue) * 110);
								const closeHeight = Math.round((item.Close / maxValue) * 110);

								return `
									<div class="achievement-month-card">
										<p class="achievement-month-label">${label}</p>
										<div class="achievement-bars">
											<div class="achievement-bar-item">
												<div class="achievement-bar-track">
													<div class="achievement-bar achievement-open" style="height: ${openHeight}px"></div>
												</div>
												<span class="achievement-bar-count">${item.Open}</span>
											</div>
											<div class="achievement-bar-item">
												<div class="achievement-bar-track">
													<div class="achievement-bar achievement-progress" style="height: ${progressHeight}px"></div>
												</div>
												<span class="achievement-bar-count">${item.Progress}</span>
											</div>
											<div class="achievement-bar-item">
												<div class="achievement-bar-track">
													<div class="achievement-bar achievement-close" style="height: ${closeHeight}px"></div>
												</div>
												<span class="achievement-bar-count">${item.Close}</span>
											</div>
										</div>
										<p class="achievement-month-detail">Open: ${item.Open} • Progress: ${item.Progress} • Close: ${item.Close}</p>
									</div>
								`;
							})
							.join("")}
					</div>
				`;

		return `
			<section class="achievement-section">
				<h3>${title}</h3>
				${chartBody}
			</section>
		`;
	}

	function getAchievementDimensionLabel(dimensionKey) {
		const labels = {
			departemen: "Departemen",
			kategoriTemuan: "Kategori Temuan",
			lokasiTemuan: "Lokasi Temuan",
			detailLokasiTemuan: "Detail Lokasi Temuan",
			riskLevel: "Risk Level",
			namaPic: "Nama PIC",
			namaPja: "Nama PIC",
			namaPelakuTta: "Nama Pelaku TTA",
			jabatanPelakuTta: "Jabatan Pelaku TTA",
			departemenPelakuTta: "Departemen Pelaku TTA",
		};

		return labels[dimensionKey] || dimensionKey;
	}

	function getAchievementDimensionValue(item, dimensionKey) {
		if (!item) {
			return "-";
		}

		if (dimensionKey === "namaPja") {
			const value = String(item.namaPja || item.namaPic || "").trim();
			return value || "-";
		}

		if (dimensionKey === "namaPelakuTta") {
			return getUserFullNameFromIdentifier(item.namaPelakuTta);
		}

		const value = String(item[dimensionKey] || "").trim();
		return value || "-";
	}

	function buildAchievementDistribution(records, dimensionKey) {
		const grouped = {};

		records.forEach((item) => {
			const key = getAchievementDimensionValue(item, dimensionKey);
			grouped[key] = (grouped[key] || 0) + 1;
		});

		return Object.entries(grouped)
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
	}

	function applyAchievementFilter(records, activeFilter) {
		if (!activeFilter || !activeFilter.dimension || !activeFilter.value) {
			return records;
		}

		return records.filter((item) => getAchievementDimensionValue(item, activeFilter.dimension) === activeFilter.value);
	}

	function applyAchievementDateRange(records, startDate, endDate) {
		const start = String(startDate || "").trim();
		const end = String(endDate || "").trim();

		if (!start && !end) {
			return records;
		}

		return records.filter((item) => {
			const reportDate = String(item.tanggalLaporan || "").trim();
			if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
				return false;
			}

			if (start && reportDate < start) {
				return false;
			}

			if (end && reportDate > end) {
				return false;
			}

			return true;
		});
	}

	function getAchievementStatusSummary(records) {
		let openCount = 0;
		let progressCount = 0;
		let closeCount = 0;

		records.forEach((item) => {
			const status = normalizeAchievementStatus(item.status);
			if (status === "Open") {
				openCount += 1;
			}
			if (status === "Progress") {
				progressCount += 1;
			}
			if (status === "Close") {
				closeCount += 1;
			}
		});

		const totalCount = records.length;
		const openPercentage = totalCount === 0 ? 0 : (openCount / totalCount) * 100;

		return { openCount, progressCount, closeCount, totalCount, openPercentage };
	}

	function renderAchievementTreemapChart(title, dimensionKey, data, activeFilter, dashboardType) {
		const maxValue = Math.max(1, ...data.map((item) => item.count));

		return `
			<section class="achievement-section achievement-section-half">
				<h3>${title}</h3>
				${
					data.length === 0
						? '<p class="subtitle">Belum ada data untuk ditampilkan.</p>'
						: `<div class="achievement-treemap">
							${data
								.map((item, index) => {
									const size = Math.max(1, Math.round((item.count / maxValue) * 6));
									const isActive = Boolean(
										activeFilter && activeFilter.dimension === dimensionKey && activeFilter.value === item.label,
									);
									const hue = (index * 43) % 360;
									return `
										<button
											type="button"
											class="achievement-dist-row achievement-treemap-tile ${isActive ? "active" : ""}"
											data-dashboard="${dashboardType}"
											data-dimension="${dimensionKey}"
											data-value="${encodeURIComponent(item.label)}"
											style="grid-column: span ${Math.min(6, size)}; --tile-color: hsl(${hue}, 70%, 45%);"
										>
											<span class="achievement-dist-label">${escapeAchievementHtml(item.label)}</span>
											<span class="achievement-dist-count">${item.count}</span>
										</button>
									`;
								})
								.join("")}
						</div>`
				}
			</section>
		`;
	}

	function renderAchievementDonutChart(title, dimensionKey, data, activeFilter, dashboardType) {
		const total = data.reduce((sum, item) => sum + item.count, 0);
		let cursor = 0;
		const segments = data.map((item, index) => {
			const portion = total === 0 ? 0 : (item.count / total) * 100;
			const from = cursor;
			const to = cursor + portion;
			cursor = to;
			return {
				...item,
				from,
				to,
				hue: (index * 47) % 360,
			};
		});

		const gradient =
			segments.length === 0
				? "conic-gradient(#e5e7eb 0deg 360deg)"
				: `conic-gradient(${segments
						.map((item) => `hsl(${item.hue}, 72%, 46%) ${item.from}% ${item.to}%`)
						.join(",")})`;

		return `
			<section class="achievement-section achievement-section-half">
				<h3>${title}</h3>
				${
					data.length === 0
						? '<p class="subtitle">Belum ada data untuk ditampilkan.</p>'
						: `<div class="achievement-donut-wrap">
							<div class="achievement-donut-chart" style="--donut-bg:${gradient};">
								<div class="achievement-donut-center">Total: ${total}</div>
							</div>
							<div class="achievement-donut-legend">
								${segments
									.map((item) => {
										const isActive = Boolean(
											activeFilter && activeFilter.dimension === dimensionKey && activeFilter.value === item.label,
										);
										return `
											<button
												type="button"
												class="achievement-dist-row achievement-donut-legend-row ${isActive ? "active" : ""}"
												data-dashboard="${dashboardType}"
												data-dimension="${dimensionKey}"
												data-value="${encodeURIComponent(item.label)}"
											>
												<span class="achievement-donut-dot" style="--donut-color:hsl(${item.hue}, 72%, 46%);"></span>
												<span class="achievement-dist-label">${escapeAchievementHtml(item.label)}</span>
												<span class="achievement-dist-count">${item.count}</span>
											</button>
										`;
									})
									.join("")}
							</div>
						</div>`
				}
			</section>
		`;
	}

	function renderAchievementDistributionChart(title, dimensionKey, records, activeFilter, dashboardType) {
		const data = buildAchievementDistribution(records, dimensionKey);

		if (dimensionKey === "lokasiTemuan") {
			return renderAchievementTreemapChart(title, dimensionKey, data, activeFilter, dashboardType);
		}

		if (dimensionKey === "riskLevel") {
			return renderAchievementDonutChart(title, dimensionKey, data, activeFilter, dashboardType);
		}

		const maxValue = Math.max(1, ...data.map((item) => item.count));

		return `
			<section class="achievement-section">
				<h3>${title}</h3>
				${
					data.length === 0
						? '<p class="subtitle">Belum ada data untuk ditampilkan.</p>'
						: `<div class="achievement-dist-list">
							${data
								.map((item) => {
									const width = Math.max(6, Math.round((item.count / maxValue) * 100));
									const isActive = Boolean(
										activeFilter && activeFilter.dimension === dimensionKey && activeFilter.value === item.label,
									);
									return `
										<button
											type="button"
											class="achievement-dist-row ${isActive ? "active" : ""}"
											data-dashboard="${dashboardType}"
											data-dimension="${dimensionKey}"
											data-value="${encodeURIComponent(item.label)}"
										>
											<span class="achievement-dist-label">${escapeAchievementHtml(item.label)}</span>
											<span class="achievement-dist-track"><span class="achievement-dist-fill" style="width: ${width}%"></span></span>
											<span class="achievement-dist-count">${item.count}</span>
										</button>
									`;
								})
								.join("")}
						</div>`
				}
			</section>
		`;
	}

	function renderAchievementKtaTable(records) {
		if (records.length === 0) {
			return '<p class="subtitle">Belum ada detail temuan KTA.</p>';
		}

		const rows = records
			.slice()
			.reverse()
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.noId)}</td>
						<td>${escapeAchievementHtml(item.tanggalLaporan)}</td>
						<td>${escapeAchievementHtml(item.namaPelapor)}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "departemen"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "kategoriTemuan"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "lokasiTemuan"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "detailLokasiTemuan"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "riskLevel"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "namaPic"))}</td>
						<td>${escapeAchievementHtml(item.status || "-")}</td>
					</tr>
				`,
			)
			.join("");

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>No ID</th>
						<th>Tanggal Laporan</th>
						<th>Nama Pelapor</th>
						<th>Departemen</th>
						<th>Kategori Temuan</th>
						<th>Lokasi Temuan</th>
						<th>Detail Lokasi Temuan</th>
						<th>Risk Level</th>
						<th>Nama PIC</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		`;
	}

	function normalizeJobGroup(value) {
		return String(value || "")
			.trim()
			.toUpperCase()
			.replace(/\s+/g, " ");
	}

	function getKtaTargetMultiplierByJobGroup(jobGroup) {
		const normalizedGroup = normalizeJobGroup(jobGroup);

		if (normalizedGroup === "OPERATOR") {
			return 3;
		}

		if (normalizedGroup === "PENGAWAS" || normalizedGroup === "LEVEL 1 MGT") {
			return 1;
		}

		return 0;
	}

	function renderKtaReporterPerformanceTable(records) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung target KTA per pelapor.</p>';
		}

		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;
		const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const targetMultiplier = getKtaTargetMultiplierByJobGroup(normalizedGroup);

				let monthlyAchievement = 0;
				let yearlyAchievement = 0;

				records.forEach((record) => {
					const reportDateText = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateText)) {
						return;
					}

					const [yearText, monthText] = reportDateText.split("-");
					const recordYear = Number(yearText);
					const recordMonth = Number(monthText);

					const recordReporterRaw = String(record.namaPelapor || "").trim();
					const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
						.trim()
						.toLowerCase();
					const recordReporter = recordReporterRaw.toLowerCase();

					const isSameReporter =
						recordReporter === normalizedReporterName ||
						recordReporter === normalizedUsername ||
						recordReporterFullName === normalizedReporterName ||
						recordReporterFullName === normalizedUsername;

					if (!isSameReporter) {
						return;
					}

					if (recordYear === currentYear) {
						yearlyAchievement += 1;
						if (recordMonth === currentMonth) {
							monthlyAchievement += 1;
						}
					}
				});

				const monthlyTarget = targetMultiplier * daysInCurrentMonth;
				const yearlyTarget = targetMultiplier > 0 ? 365 : 0;

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					monthlyTarget,
					monthlyAchievement,
					yearlyTarget,
					yearlyAchievement,
				};
			})
			.filter((item) => item.jobGroup !== "OPERATOR")
			.sort((a, b) => a.reporterName.localeCompare(b.reporterName));

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${item.monthlyTarget}</td>
						<td>${item.monthlyAchievement}</td>
						<td>${item.yearlyTarget}</td>
						<td>${item.yearlyAchievement}</td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.monthlyTarget += item.monthlyTarget;
				accumulator.monthlyAchievement += item.monthlyAchievement;
				accumulator.yearlyTarget += item.yearlyTarget;
				accumulator.yearlyAchievement += item.yearlyAchievement;
				return accumulator;
			},
			{ monthlyTarget: 0, monthlyAchievement: 0, yearlyTarget: 0, yearlyAchievement: 0 },
		);

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Target KTA Bulanan</th>
						<th>Pencapaian Bulanan</th>
						<th>Target KTA Tahunan</th>
						<th>Pencapaian Tahunan</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totals.monthlyTarget}</th>
						<th>${totals.monthlyAchievement}</th>
						<th>${totals.yearlyTarget}</th>
						<th>${totals.yearlyAchievement}</th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderAchievementTtaTable(records) {
		if (records.length === 0) {
			return '<p class="subtitle">Belum ada detail temuan TTA.</p>';
		}

		const rows = records
			.slice()
			.reverse()
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.noId)}</td>
						<td>${escapeAchievementHtml(item.tanggalLaporan)}</td>
						<td>${escapeAchievementHtml(item.namaPelapor)}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "departemen"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "kategoriTemuan"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "riskLevel"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "namaPja"))}</td>
						<td>${escapeAchievementHtml(getAchievementDimensionValue(item, "namaPelakuTta"))}</td>
						<td>${escapeAchievementHtml(item.status || "-")}</td>
					</tr>
				`,
			)
			.join("");

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>No ID</th>
						<th>Tanggal Laporan</th>
						<th>Nama Pelapor</th>
						<th>Departemen</th>
						<th>Kategori Temuan</th>
						<th>Risk Level</th>
						<th>Nama PIC</th>
						<th>Pelaku TTA</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		`;
	}

	function getTtaTargetByJobGroup(jobGroup, daysInCurrentMonth) {
		const normalizedGroup = normalizeJobGroup(jobGroup);
		if (normalizedGroup === "PENGAWAS" || normalizedGroup === "LEVEL 1 MGT") {
			return {
				monthlyTarget: 2 * daysInCurrentMonth,
				yearlyTarget: 730,
			};
		}

		return {
			monthlyTarget: 0,
			yearlyTarget: 0,
		};
	}

	function renderTtaReporterPerformanceTable(records) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung target TTA per pelapor.</p>';
		}

		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;
		const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const targets = getTtaTargetByJobGroup(normalizedGroup, daysInCurrentMonth);

				let monthlyAchievement = 0;
				let yearlyAchievement = 0;

				records.forEach((record) => {
					const reportDateText = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateText)) {
						return;
					}

					const [yearText, monthText] = reportDateText.split("-");
					const recordYear = Number(yearText);
					const recordMonth = Number(monthText);

					const recordReporterRaw = String(record.namaPelapor || "").trim();
					const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
						.trim()
						.toLowerCase();
					const recordReporter = recordReporterRaw.toLowerCase();

					const isSameReporter =
						recordReporter === normalizedReporterName ||
						recordReporter === normalizedUsername ||
						recordReporterFullName === normalizedReporterName ||
						recordReporterFullName === normalizedUsername;

					if (!isSameReporter) {
						return;
					}

					if (recordYear === currentYear) {
						yearlyAchievement += 1;
						if (recordMonth === currentMonth) {
							monthlyAchievement += 1;
						}
					}
				});

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					monthlyTarget: targets.monthlyTarget,
					monthlyAchievement,
					yearlyTarget: targets.yearlyTarget,
					yearlyAchievement,
				};
			})
			.filter((item) => item.jobGroup === "PENGAWAS" || item.jobGroup === "LEVEL 1 MGT")
			.sort((a, b) => a.reporterName.localeCompare(b.reporterName));

		if (rows.length === 0) {
			return '<p class="subtitle">Tidak ada pelapor dengan Kelompok Jabatan PENGAWAS atau LEVEL 1 MGT.</p>';
		}

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${item.monthlyTarget}</td>
						<td>${item.monthlyAchievement}</td>
						<td>${item.yearlyTarget}</td>
						<td>${item.yearlyAchievement}</td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.monthlyTarget += item.monthlyTarget;
				accumulator.monthlyAchievement += item.monthlyAchievement;
				accumulator.yearlyTarget += item.yearlyTarget;
				accumulator.yearlyAchievement += item.yearlyAchievement;
				return accumulator;
			},
			{ monthlyTarget: 0, monthlyAchievement: 0, yearlyTarget: 0, yearlyAchievement: 0 },
		);

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Target TTA Bulanan</th>
						<th>Pencapaian Bulanan</th>
						<th>Target TTA Tahunan</th>
						<th>Pencapaian Tahunan</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totals.monthlyTarget}</th>
						<th>${totals.monthlyAchievement}</th>
						<th>${totals.yearlyTarget}</th>
						<th>${totals.yearlyAchievement}</th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderOperatorCombinedPerformanceTable(ktaRecords, ttaRecords) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung target gabungan KTA/TTA per pelapor.</p>';
		}

		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);

				let monthlyAchievement = 0;
				let yearlyAchievement = 0;

				const combinedRecords = [...ktaRecords, ...ttaRecords];
				combinedRecords.forEach((record) => {
					const reportDateText = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateText)) {
						return;
					}

					const [yearText, monthText] = reportDateText.split("-");
					const recordYear = Number(yearText);
					const recordMonth = Number(monthText);

					const recordReporterRaw = String(record.namaPelapor || "").trim();
					const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
						.trim()
						.toLowerCase();
					const recordReporter = recordReporterRaw.toLowerCase();

					const isSameReporter =
						recordReporter === normalizedReporterName ||
						recordReporter === normalizedUsername ||
						recordReporterFullName === normalizedReporterName ||
						recordReporterFullName === normalizedUsername;

					if (!isSameReporter) {
						return;
					}

					if (recordYear === currentYear) {
						yearlyAchievement += 1;
						if (recordMonth === currentMonth) {
							monthlyAchievement += 1;
						}
					}
				});

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					monthlyTarget: 12,
					monthlyAchievement,
					yearlyTarget: 144,
					yearlyAchievement,
				};
			})
			.filter((item) => item.jobGroup === "OPERATOR")
			.sort((a, b) => a.reporterName.localeCompare(b.reporterName));

		if (rows.length === 0) {
			return '<p class="subtitle">Tidak ada pelapor dengan Kelompok Jabatan OPERATOR.</p>';
		}

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${item.monthlyTarget}</td>
						<td>${item.monthlyAchievement}</td>
						<td>${item.yearlyTarget}</td>
						<td>${item.yearlyAchievement}</td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.monthlyTarget += item.monthlyTarget;
				accumulator.monthlyAchievement += item.monthlyAchievement;
				accumulator.yearlyTarget += item.yearlyTarget;
				accumulator.yearlyAchievement += item.yearlyAchievement;
				return accumulator;
			},
			{ monthlyTarget: 0, monthlyAchievement: 0, yearlyTarget: 0, yearlyAchievement: 0 },
		);

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Target KTA / TTA Bulanan</th>
						<th>Pencapaian Bulanan</th>
						<th>Target KTA / TTA Tahunan</th>
						<th>Pencapaian Tahunan</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totals.monthlyTarget}</th>
						<th>${totals.monthlyAchievement}</th>
						<th>${totals.yearlyTarget}</th>
						<th>${totals.yearlyAchievement}</th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderKtaReporterDateRangeAchievementTable(records) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung pencapaian KTA berdasarkan rentang tanggal.</p>';
		}

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);

				const perDateCount = {};
				let achievementCount = 0;

				records.forEach((record) => {
					const reportDate = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
						return;
					}

					const recordReporterRaw = String(record.namaPelapor || "").trim();
					const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
						.trim()
						.toLowerCase();
					const recordReporter = recordReporterRaw.toLowerCase();

					const isSameReporter =
						recordReporter === normalizedReporterName ||
						recordReporter === normalizedUsername ||
						recordReporterFullName === normalizedReporterName ||
						recordReporterFullName === normalizedUsername;

					if (!isSameReporter) {
						return;
					}

					achievementCount += 1;
					perDateCount[reportDate] = (perDateCount[reportDate] || 0) + 1;
				});

				const dateCounts = Object.values(perDateCount);
				const hasLessThanOnePerDate = dateCounts.length === 0 || dateCounts.some((count) => count < 1);

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					achievementCount,
					hasLessThanOnePerDate,
				};
			})
			.filter((item) => item.jobGroup === "PENGAWAS" || item.jobGroup === "LEVEL 1 MGT")
			.sort((a, b) => b.achievementCount - a.achievementCount || a.reporterName.localeCompare(b.reporterName));

		if (rows.length === 0) {
			return '<p class="subtitle">Tidak ada pelapor dengan Kelompok Jabatan PENGAWAS atau LEVEL 1 MGT.</p>';
		}

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td class="${item.hasLessThanOnePerDate ? "reporter-low-achievement" : ""}">${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${item.achievementCount}</td>
					</tr>
				`,
			)
			.join("");

		const totalAchievement = rows.reduce((accumulator, item) => accumulator + item.achievementCount, 0);

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Pencapaian KTA (Date Range Aktif)</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totalAchievement}</th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderTtaReporterDateRangeAchievementTable(records) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung pencapaian TTA berdasarkan rentang tanggal.</p>';
		}

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);

				const perDateCount = {};
				let achievementCount = 0;

				records.forEach((record) => {
					const reportDate = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
						return;
					}

					const recordReporterRaw = String(record.namaPelapor || "").trim();
					const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
						.trim()
						.toLowerCase();
					const recordReporter = recordReporterRaw.toLowerCase();

					const isSameReporter =
						recordReporter === normalizedReporterName ||
						recordReporter === normalizedUsername ||
						recordReporterFullName === normalizedReporterName ||
						recordReporterFullName === normalizedUsername;

					if (!isSameReporter) {
						return;
					}

					achievementCount += 1;
					perDateCount[reportDate] = (perDateCount[reportDate] || 0) + 1;
				});

				const dateCounts = Object.values(perDateCount);
				const hasLessThanTwoPerDate = dateCounts.length === 0 || dateCounts.some((count) => count < 2);

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					achievementCount,
					hasLessThanTwoPerDate,
				};
			})
			.filter((item) => item.jobGroup === "PENGAWAS" || item.jobGroup === "LEVEL 1 MGT")
			.sort((a, b) => b.achievementCount - a.achievementCount || a.reporterName.localeCompare(b.reporterName));

		if (rows.length === 0) {
			return '<p class="subtitle">Tidak ada pelapor dengan Kelompok Jabatan PENGAWAS atau LEVEL 1 MGT.</p>';
		}

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td class="${item.hasLessThanTwoPerDate ? "reporter-low-achievement" : ""}">${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${item.achievementCount}</td>
					</tr>
				`,
			)
			.join("");

		const totalAchievement = rows.reduce((accumulator, item) => accumulator + item.achievementCount, 0);

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Pencapaian TTA (Date Range Aktif)</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totalAchievement}</th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderUserAchievementContent() {
		const ktaRecords = getKtaRecords();
		const ttaRecords = getTtaRecords();

		contentArea.innerHTML = `
			<h2>Achievement</h2>
			<p class="subtitle">Dashboard pencapaian bulanan KTA dan TTA dengan detail status Open, Progress, dan Close.</p>
			<div class="achievement-legend">
				<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-open"></span>Open</span>
				<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-progress"></span>Progress</span>
				<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-close"></span>Close</span>
			</div>
			${renderAchievementChart("Grafik Bulanan KTA", ktaRecords)}
			${renderAchievementChart("Grafik Bulanan TTA", ttaRecords)}
		`;
	}

	function renderAchievementContent() {
		if (session.role === "User") {
			renderUserAchievementContent();
			return;
		}

		let activeDashboard = "KTA";
		let activeKtaFilter = null;
		let activeTtaFilter = null;
		let ktaTableFilter = "all";
		let ttaTableFilter = "all";
		let dateRangeStart = "";
		let dateRangeEnd = "";

		function renderAdminAchievementView() {
			const allKtaRecords = getKtaRecords();
			const allTtaRecords = getTtaRecords();
			const rangedKtaRecords = applyAchievementDateRange(allKtaRecords, dateRangeStart, dateRangeEnd);
			const rangedTtaRecords = applyAchievementDateRange(allTtaRecords, dateRangeStart, dateRangeEnd);
			const ktaRecords = applyAchievementFilter(rangedKtaRecords, activeKtaFilter);
			const ttaRecords = applyAchievementFilter(rangedTtaRecords, activeTtaFilter);

			const ktaSummary = getAchievementStatusSummary(ktaRecords);
			const ttaSummary = getAchievementStatusSummary(ttaRecords);

			const activeFilter = activeDashboard === "KTA" ? activeKtaFilter : activeTtaFilter;
			const activeFilterText = activeFilter
				? `${getAchievementDimensionLabel(activeFilter.dimension)}: ${activeFilter.value}`
				: "Tanpa filter";
			const dateFilterText = dateRangeStart || dateRangeEnd ? `${dateRangeStart || "-"} s.d. ${dateRangeEnd || "-"}` : "Semua tanggal";

			const ktaDashboardHtml = `
				<div class="achievement-stat-grid">
					<div class="achievement-stat-card"><h4>Open</h4><p>${ktaSummary.openCount}</p></div>
					<div class="achievement-stat-card"><h4>Progress</h4><p>${ktaSummary.progressCount}</p></div>
					<div class="achievement-stat-card"><h4>Close</h4><p>${ktaSummary.closeCount}</p></div>
					<div class="achievement-stat-card"><h4>Total KTA</h4><p>${ktaSummary.totalCount}</p></div>
					<div class="achievement-stat-card"><h4>Persentase Open</h4><p>${ktaSummary.openPercentage.toFixed(2)}%</p></div>
				</div>
				<div class="achievement-row-pair">
					${renderAchievementDistributionChart("Grafik Pencapaian KTA berdasarkan Departemen", "departemen", ktaRecords, activeKtaFilter, "KTA")}
					${renderAchievementDistributionChart("Grafik Pencapaian KTA berdasarkan Risk Level", "riskLevel", ktaRecords, activeKtaFilter, "KTA")}
				</div>
				${renderAchievementDistributionChart("Grafik Pencapaian KTA berdasarkan Kategori Temuan", "kategoriTemuan", ktaRecords, activeKtaFilter, "KTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian KTA berdasarkan Lokasi Temuan", "lokasiTemuan", ktaRecords, activeKtaFilter, "KTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian KTA berdasarkan Nama PIC", "namaPic", ktaRecords, activeKtaFilter, "KTA")}
				<section class="achievement-section">
					<h3>Detail Temuan KTA</h3>
					<div class="table-wrap">
						${renderAchievementKtaTable(ktaRecords)}
					</div>
				</section>
				${
					ktaTableFilter === "all" || ktaTableFilter === "summary"
						? `<section class="achievement-section">
							<h3>Target dan Pencapaian KTA per Pelapor</h3>
							<p class="subtitle">Perhitungan bulan berjalan dan tahun berjalan berdasarkan Kelompok Jabatan pada Daftar User.</p>
							<div class="table-wrap kta-performance-table-wrap">
								${renderKtaReporterPerformanceTable(allKtaRecords)}
							</div>
						</section>`
						: ""
				}
				<section class="achievement-section">
					<h3>Target dan Pencapaian Gabungan KTA / TTA (OPERATOR)</h3>
					<p class="subtitle">Menampilkan Kelompok Jabatan OPERATOR dengan target tetap bulanan 12 serta tahunan 144.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderOperatorCombinedPerformanceTable(allKtaRecords, allTtaRecords)}
					</div>
				</section>
				${
					ktaTableFilter === "all" || ktaTableFilter === "daily"
						? `<section class="achievement-section">
							<h3>Pencapaian Pembuatan KTA per Pelapor (Date Range)</h3>
							<p class="subtitle">Menampilkan Kelompok Jabatan PENGAWAS dan LEVEL 1 MGT berdasarkan date range aktif pada Dashboard KTA. Nama pelapor berwarna merah jika jumlah KTA per tanggal kurang dari 1.</p>
							<div class="table-wrap kta-performance-table-wrap">
								${renderKtaReporterDateRangeAchievementTable(rangedKtaRecords)}
							</div>
						</section>`
						: ""
				}
			`;

			const ttaDashboardHtml = `
				<div class="achievement-stat-grid">
					<div class="achievement-stat-card"><h4>Open</h4><p>${ttaSummary.openCount}</p></div>
					<div class="achievement-stat-card"><h4>Progress</h4><p>${ttaSummary.progressCount}</p></div>
					<div class="achievement-stat-card"><h4>Close</h4><p>${ttaSummary.closeCount}</p></div>
					<div class="achievement-stat-card"><h4>Total TTA</h4><p>${ttaSummary.totalCount}</p></div>
					<div class="achievement-stat-card"><h4>Persentase Open</h4><p>${ttaSummary.openPercentage.toFixed(2)}%</p></div>
				</div>
				<div class="achievement-row-pair">
					${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Departemen", "departemen", ttaRecords, activeTtaFilter, "TTA")}
					${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Risk Level", "riskLevel", ttaRecords, activeTtaFilter, "TTA")}
				</div>
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Kategori Temuan", "kategoriTemuan", ttaRecords, activeTtaFilter, "TTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Lokasi Temuan", "lokasiTemuan", ttaRecords, activeTtaFilter, "TTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Nama PIC", "namaPja", ttaRecords, activeTtaFilter, "TTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Nama Pelaku TTA", "namaPelakuTta", ttaRecords, activeTtaFilter, "TTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Jabatan Pelaku TTA", "jabatanPelakuTta", ttaRecords, activeTtaFilter, "TTA")}
				${renderAchievementDistributionChart("Grafik Pencapaian TTA berdasarkan Departemen Pelaku TTA", "departemenPelakuTta", ttaRecords, activeTtaFilter, "TTA")}
				<section class="achievement-section">
					<h3>Detail Temuan TTA</h3>
					<div class="table-wrap">
						${renderAchievementTtaTable(ttaRecords)}
					</div>
				</section>
				${
					ttaTableFilter === "all" || ttaTableFilter === "summary"
						? `<section class="achievement-section">
							<h3>Target dan Pencapaian TTA per Pelapor</h3>
							<p class="subtitle">Perhitungan bulan berjalan dan tahun berjalan untuk Kelompok Jabatan PENGAWAS dan LEVEL 1 MGT.</p>
							<div class="table-wrap kta-performance-table-wrap">
								${renderTtaReporterPerformanceTable(allTtaRecords)}
							</div>
						</section>`
						: ""
				}
				<section class="achievement-section">
					<h3>Target dan Pencapaian Gabungan KTA / TTA (OPERATOR)</h3>
					<p class="subtitle">Menampilkan Kelompok Jabatan OPERATOR dengan target tetap bulanan 12 serta tahunan 144.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderOperatorCombinedPerformanceTable(allKtaRecords, allTtaRecords)}
					</div>
				</section>
				${
					ttaTableFilter === "all" || ttaTableFilter === "daily"
						? `<section class="achievement-section">
							<h3>Pencapaian Pembuatan TTA per Pelapor (Date Range)</h3>
							<p class="subtitle">Menampilkan Kelompok Jabatan PENGAWAS dan LEVEL 1 MGT berdasarkan date range aktif pada Dashboard TTA. Nama pelapor berwarna merah jika jumlah TTA per tanggal kurang dari 2.</p>
							<div class="table-wrap kta-performance-table-wrap">
								${renderTtaReporterDateRangeAchievementTable(rangedTtaRecords)}
							</div>
						</section>`
						: ""
				}
			`;

			contentArea.innerHTML = `
				<h2>Achievement</h2>
				<p class="subtitle">Dashboard interaktif untuk ${session.role}. Klik grafik untuk menerapkan filter, klik ulang untuk reset.</p>
				<div class="form-grid" id="achievementDateRange">
					<div class="field">
						<label for="achievementDateStart">Dari Tanggal Laporan</label>
						<input id="achievementDateStart" type="date" value="${dateRangeStart}" />
					</div>
					<div class="field">
						<label for="achievementDateEnd">Sampai Tanggal Laporan</label>
						<input id="achievementDateEnd" type="date" value="${dateRangeEnd}" />
					</div>
					<div class="inline-actions field-full">
						<button type="button" class="btn-small btn-edit" id="achievementApplyDate">Terapkan Tanggal</button>
						<button type="button" class="btn-small" id="achievementResetDate">Reset Tanggal</button>
					</div>
				</div>
				<p id="achievementDateError" class="error"></p>
				<div class="achievement-submenu">
					<button type="button" class="achievement-tab ${activeDashboard === "KTA" ? "active" : ""}" data-achievement-tab="KTA">Dashboard KTA</button>
					<button type="button" class="achievement-tab ${activeDashboard === "TTA" ? "active" : ""}" data-achievement-tab="TTA">Dashboard TTA</button>
				</div>
				<div class="achievement-filter-info">
					<p><strong>Filter Aktif:</strong> ${escapeAchievementHtml(activeFilterText)}</p>
					<p><strong>Rentang Tanggal:</strong> ${escapeAchievementHtml(dateFilterText)}</p>
					<button type="button" class="btn-small" id="achievementResetFilter">Reset Filter</button>
				</div>
				${
					activeDashboard === "KTA"
						? `<div class="achievement-kta-table-filter">
							<button type="button" class="btn-small achievement-kta-table-btn ${ktaTableFilter === "all" ? "active" : ""}" data-kta-table-filter="all">Semua Tabel KTA</button>
							<button type="button" class="btn-small achievement-kta-table-btn ${ktaTableFilter === "summary" ? "active" : ""}" data-kta-table-filter="summary">Bulanan & Tahunan</button>
							<button type="button" class="btn-small achievement-kta-table-btn ${ktaTableFilter === "daily" ? "active" : ""}" data-kta-table-filter="daily">Per Tanggal</button>
							<button type="button" class="btn-small achievement-kta-table-btn ${ktaTableFilter === "hidden" ? "active" : ""}" data-kta-table-filter="hidden">Sembunyikan</button>
						</div>`
						: activeDashboard === "TTA"
							? `<div class="achievement-kta-table-filter">
								<button type="button" class="btn-small achievement-kta-table-btn ${ttaTableFilter === "all" ? "active" : ""}" data-tta-table-filter="all">Semua Tabel TTA</button>
								<button type="button" class="btn-small achievement-kta-table-btn ${ttaTableFilter === "summary" ? "active" : ""}" data-tta-table-filter="summary">Bulanan & Tahunan</button>
								<button type="button" class="btn-small achievement-kta-table-btn ${ttaTableFilter === "daily" ? "active" : ""}" data-tta-table-filter="daily">Per Tanggal</button>
								<button type="button" class="btn-small achievement-kta-table-btn ${ttaTableFilter === "hidden" ? "active" : ""}" data-tta-table-filter="hidden">Sembunyikan</button>
							</div>`
							: ""
				}
				${activeDashboard === "KTA" ? ktaDashboardHtml : ttaDashboardHtml}
			`;

			const achievementDateError = document.getElementById("achievementDateError");
			const achievementDateStart = document.getElementById("achievementDateStart");
			const achievementDateEnd = document.getElementById("achievementDateEnd");
			const achievementApplyDate = document.getElementById("achievementApplyDate");
			const achievementResetDate = document.getElementById("achievementResetDate");

			achievementApplyDate.addEventListener("click", () => {
				const nextStart = String(achievementDateStart.value || "").trim();
				const nextEnd = String(achievementDateEnd.value || "").trim();

				if (nextStart && nextEnd && nextStart > nextEnd) {
					achievementDateError.textContent = "Tanggal mulai tidak boleh lebih besar dari tanggal akhir.";
					return;
				}

				achievementDateError.textContent = "";
				dateRangeStart = nextStart;
				dateRangeEnd = nextEnd;
				renderAdminAchievementView();
			});

			achievementResetDate.addEventListener("click", () => {
				dateRangeStart = "";
				dateRangeEnd = "";
				achievementDateError.textContent = "";
				renderAdminAchievementView();
			});

			const tabs = contentArea.querySelectorAll("[data-achievement-tab]");
			tabs.forEach((button) => {
				button.addEventListener("click", () => {
					activeDashboard = button.dataset.achievementTab;
					renderAdminAchievementView();
				});
			});

			const resetFilterButton = document.getElementById("achievementResetFilter");
			resetFilterButton.addEventListener("click", () => {
				if (activeDashboard === "KTA") {
					activeKtaFilter = null;
				} else {
					activeTtaFilter = null;
				}
				renderAdminAchievementView();
			});

			const chartRows = contentArea.querySelectorAll(".achievement-dist-row");
			chartRows.forEach((button) => {
				button.addEventListener("click", () => {
					const dashboard = button.dataset.dashboard;
					const dimension = button.dataset.dimension;
					const value = decodeURIComponent(button.dataset.value || "");

					if (dashboard === "KTA") {
						const isSame = Boolean(
							activeKtaFilter && activeKtaFilter.dimension === dimension && activeKtaFilter.value === value,
						);
						activeKtaFilter = isSame ? null : { dimension, value };
					} else {
						const isSame = Boolean(
							activeTtaFilter && activeTtaFilter.dimension === dimension && activeTtaFilter.value === value,
						);
						activeTtaFilter = isSame ? null : { dimension, value };
					}

					renderAdminAchievementView();
				});
			});

			const ktaTableFilterButtons = contentArea.querySelectorAll("[data-kta-table-filter]");
			ktaTableFilterButtons.forEach((button) => {
				button.addEventListener("click", () => {
					ktaTableFilter = String(button.dataset.ktaTableFilter || "all");
					renderAdminAchievementView();
				});
			});

			const ttaTableFilterButtons = contentArea.querySelectorAll("[data-tta-table-filter]");
			ttaTableFilterButtons.forEach((button) => {
				button.addEventListener("click", () => {
					ttaTableFilter = String(button.dataset.ttaTableFilter || "all");
					renderAdminAchievementView();
				});
			});
		};

		renderAdminAchievementView();
	}

	function renderKtaContent() {
		const isSuperAdmin = session.role === "Super Admin";

		const reportDate = getTodayDate();
		const noId = createKtaId();
		const picOptions = getPics();
		const kategoriTemuanOptions = [
			"Peralatan unit atau mesin dalam kondisi rusak",
			"Lingkungan kerja yang berbahaya (jalan rusak, licin, jarak pandang terbatas)",
			"Housekeeping yang buruk",
			"Sistem pengaman tidak memadai",
			"Rambu peringatan tidak tersedia",
		];
		const lokasiTemuanOptions = DEFAULT_LOKASI_TEMUAN;
		const profile = getReporterProfile(session);

		contentArea.innerHTML = `
			<h2>Form KTA</h2>
			<p class="subtitle">Input data KTA sesuai temuan lapangan.</p>
			<form id="ktaForm" class="form-grid" novalidate>
				<div class="field">
					<label for="ktaNoId">No ID</label>
					<input id="ktaNoId" name="noId" type="text" value="${noId}" readonly />
				</div>
				<div class="field">
					<label for="ktaTanggalLaporan">Tanggal Laporan</label>
					<input id="ktaTanggalLaporan" name="tanggalLaporan" type="date" value="${reportDate}" readonly />
				</div>
				<div class="field">
					<label for="ktaNamaPelapor">Nama Pelapor</label>
					<input id="ktaNamaPelapor" name="namaPelapor" type="text" value="${profile.namaPelapor}" readonly />
				</div>
				<div class="field">
					<label for="ktaJabatan">Jabatan</label>
					<input id="ktaJabatan" name="jabatan" type="text" value="${profile.jabatan}" readonly />
				</div>
				<div class="field">
					<label for="ktaDepartemen">Departemen</label>
					<input id="ktaDepartemen" name="departemen" type="text" value="${profile.departemen}" readonly />
				</div>
				<div class="field">
					<label for="ktaPerusahaan">Perusahaan</label>
					<input id="ktaPerusahaan" name="perusahaan" type="text" value="${profile.perusahaan}" readonly />
				</div>
				<div class="field">
					<label for="ktaTanggalTemuan">Tanggal Temuan</label>
					<input id="ktaTanggalTemuan" name="tanggalTemuan" type="date" required />
				</div>
				<div class="field">
					<label for="ktaKategoriTemuan">Kategori Temuan</label>
					<select id="ktaKategoriTemuan" name="kategoriTemuan" required>
						<option value="">Pilih Kategori Temuan</option>
						${kategoriTemuanOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ktaLokasiTemuan">Lokasi Temuan</label>
					<select id="ktaLokasiTemuan" name="lokasiTemuan" required>
						<option value="">Pilih Lokasi Temuan</option>
						${lokasiTemuanOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ktaDetailLokasi">Detail Lokasi Temuan</label>
					<input id="ktaDetailLokasi" name="detailLokasiTemuan" type="text" required />
				</div>
				<div class="field">
					<label for="ktaRiskLevel">Risk Level</label>
					<select id="ktaRiskLevel" name="riskLevel" required>
						<option value="">Pilih Risk Level</option>
						<option value="Critical">Critical</option>
						<option value="High">High</option>
						<option value="Medium">Medium</option>
						<option value="Low">Low</option>
					</select>
				</div>
				<div class="field">
					<label for="ktaPic">Nama PIC</label>
					<select id="ktaPic" name="namaPic" required>
						<option value="">Pilih PIC</option>
						${picOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field field-full">
					<label for="ktaDetailTemuan">Detail Temuan</label>
					<textarea id="ktaDetailTemuan" name="detailTemuan" rows="3" required></textarea>
				</div>
				<div class="field field-full">
					<label for="ktaFotoTemuan">Foto Temuan</label>
					<input id="ktaFotoTemuan" name="fotoTemuan" type="file" accept="image/*" multiple />
				</div>
				<div class="field">
					<label for="ktaPerbaikanLangsung">Perbaikan Langsung</label>
					<select id="ktaPerbaikanLangsung" name="perbaikanLangsung" required>
						<option value="">Pilih</option>
						<option value="Ya">Ya</option>
						<option value="Tidak">Tidak</option>
					</select>
				</div>

				<div id="directFixSection" class="field-full hidden">
					<div class="form-grid">
						<div class="field field-full">
							<label for="ktaTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="ktaTindakanPerbaikan" name="tindakanPerbaikan" rows="3"></textarea>
						</div>
						<div class="field field-full">
							<label for="ktaFotoPerbaikan">Foto Perbaikan</label>
							<input id="ktaFotoPerbaikan" name="fotoPerbaikan" type="file" accept="image/*" multiple />
						</div>
						<div class="field">
							<label for="ktaTanggalPerbaikan">Tanggal Perbaikan</label>
							<input id="ktaTanggalPerbaikan" name="tanggalPerbaikan" type="date" />
						</div>
						<div class="field">
							<label for="ktaStatus">Status</label>
							<select id="ktaStatus" name="status">
								<option value="">Pilih Status</option>
								<option value="Open">Open</option>
								<option value="Progress">Progress</option>
								<option value="Close">Close</option>
							</select>
						</div>
					</div>
				</div>

				<div class="inline-actions field-full">
					<button type="submit" id="ktaSubmitBtn" class="btn-primary">Simpan KTA</button>
					${isSuperAdmin ? '<button type="button" id="ktaCancelEditBtn" class="btn-secondary hidden">Batal</button>' : ""}
				</div>
			</form>
			<p id="ktaError" class="error"></p>
			<div id="ktaSuccess" class="subtitle"></div>
			<h3>Riwayat KTA</h3>
			<div id="ktaHistory" class="table-wrap"></div>
			<div id="ktaDetailPanel" class="detail-panel hidden"></div>
		`;

		const ktaForm = document.getElementById("ktaForm");
		const perbaikanLangsung = document.getElementById("ktaPerbaikanLangsung");
		const directFixSection = document.getElementById("directFixSection");
		const tindakanPerbaikan = document.getElementById("ktaTindakanPerbaikan");
		const tanggalPerbaikan = document.getElementById("ktaTanggalPerbaikan");
		const statusField = document.getElementById("ktaStatus");
		const ktaError = document.getElementById("ktaError");
		const ktaSuccess = document.getElementById("ktaSuccess");
		const ktaHistory = document.getElementById("ktaHistory");
		const ktaDetailPanel = document.getElementById("ktaDetailPanel");
		const ktaSubmitBtn = document.getElementById("ktaSubmitBtn");
		const ktaCancelEditBtn = document.getElementById("ktaCancelEditBtn");

		let editIndex = -1;
		let existingTemuanPhotos = [];
		let existingPerbaikanPhotos = [];

		function renderPhotos(photos) {
			if (!Array.isArray(photos) || photos.length === 0) {
				return `<p class="subtitle">Tidak ada foto.</p>`;
			}

			const photoHtml = photos
				.map((photo) => {
					if (!photo.dataUrl) {
						return `<div class="photo-card"><p class="subtitle">${photo.name}</p></div>`;
					}

					return `
						<div class="photo-card">
							<img src="${photo.dataUrl}" alt="${photo.name}" class="photo-thumb" />
							<p class="photo-caption">${photo.name}</p>
						</div>
					`;
				})
				.join("");

			return `<div class="photo-grid">${photoHtml}</div>`;
		}

		function showKtaDetail(record) {
			ktaDetailPanel.classList.remove("hidden");
			ktaDetailPanel.innerHTML = `
				<div class="detail-header">
					<h3>Detail KTA - ${record.noId}</h3>
					<button type="button" id="closeKtaDetail" class="btn-small">Tutup</button>
				</div>
				<div class="detail-grid">
					<p><strong>Tanggal Laporan:</strong> ${record.tanggalLaporan}</p>
					<p><strong>Nama Pelapor:</strong> ${record.namaPelapor}</p>
					<p><strong>Jabatan:</strong> ${record.jabatan}</p>
					<p><strong>Departemen:</strong> ${record.departemen}</p>
					<p><strong>Perusahaan:</strong> ${record.perusahaan || "-"}</p>
					<p><strong>Tanggal Temuan:</strong> ${record.tanggalTemuan}</p>
					<p><strong>Kategori Temuan:</strong> ${record.kategoriTemuan}</p>
					<p><strong>Lokasi Temuan:</strong> ${record.lokasiTemuan || "-"}</p>
					<p><strong>Detail Lokasi Temuan:</strong> ${record.detailLokasiTemuan}</p>
					<p><strong>Risk Level:</strong> ${record.riskLevel}</p>
					<p><strong>Nama PIC:</strong> ${record.namaPic}</p>
					<p><strong>Perbaikan Langsung:</strong> ${record.perbaikanLangsung}</p>
					<p><strong>Status:</strong> ${record.status || "-"}</p>
					<p><strong>Tanggal Perbaikan:</strong> ${record.tanggalPerbaikan || "-"}</p>
				</div>
				<p><strong>Detail Temuan:</strong> ${record.detailTemuan}</p>
				<p><strong>Tindakan Perbaikan:</strong> ${record.tindakanPerbaikan || "-"}</p>
				<h4>Foto Temuan</h4>
				${renderPhotos(record.fotoTemuan)}
				<h4>Foto Perbaikan</h4>
				${renderPhotos(record.fotoPerbaikan)}
			`;

			const closeKtaDetail = document.getElementById("closeKtaDetail");
			closeKtaDetail.addEventListener("click", () => {
				ktaDetailPanel.classList.add("hidden");
				ktaDetailPanel.innerHTML = "";
			});
		}

		function renderKtaHistory() {
			const records = getKtaRecords();

			if (records.length === 0) {
				ktaHistory.innerHTML = `<p class="subtitle">Belum ada data KTA tersimpan.</p>`;
				return;
			}

			const rows = records
				.map((item, index) => ({ item, index }))
				.reverse()
				.map(
					(entry) => `
						<tr>
							<td>${entry.item.noId}</td>
							<td>${entry.item.tanggalLaporan}</td>
							<td>${entry.item.namaPelapor}</td>
							<td>${entry.item.departemen}</td>
							<td>${entry.item.riskLevel}</td>
							<td>${entry.item.namaPic}</td>
							<td>${entry.item.perbaikanLangsung}</td>
							<td>${entry.item.status || "-"}</td>
							<td>
								<button type="button" class="btn-small btn-edit kta-detail-btn" data-index="${entry.index}">Detail</button>
								${
									isSuperAdmin
										? `<button type="button" class="btn-small btn-edit kta-edit-btn" data-index="${entry.index}">Edit</button>
										   <button type="button" class="btn-small btn-delete kta-delete-btn" data-index="${entry.index}">Hapus</button>`
										: ""
								}
							</td>
						</tr>
					`,
				)
				.join("");

			ktaHistory.innerHTML = `
				<table class="data-table">
					<thead>
						<tr>
							<th>No ID</th>
							<th>Tanggal Laporan</th>
							<th>Nama Pelapor</th>
							<th>Departemen</th>
							<th>Risk Level</th>
							<th>Nama PIC</th>
							<th>Perbaikan Langsung</th>
							<th>Status</th>
							<th>Aksi</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			`;

			const detailButtons = ktaHistory.querySelectorAll(".kta-detail-btn");
			detailButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					const selected = getKtaRecords()[index];
					if (selected) {
						showKtaDetail(selected);
					}
				});
			});

			if (isSuperAdmin) {
				const editButtons = ktaHistory.querySelectorAll(".kta-edit-btn");
				const deleteButtons = ktaHistory.querySelectorAll(".kta-delete-btn");

				editButtons.forEach((button) => {
					button.addEventListener("click", () => {
						const index = Number(button.dataset.index);
						const selected = getKtaRecords()[index];
						if (!selected) {
							return;
						}

						editIndex = index;
						existingTemuanPhotos = Array.isArray(selected.fotoTemuan) ? selected.fotoTemuan : [];
						existingPerbaikanPhotos = Array.isArray(selected.fotoPerbaikan) ? selected.fotoPerbaikan : [];

						document.getElementById("ktaNoId").value = selected.noId;
						document.getElementById("ktaTanggalLaporan").value = selected.tanggalLaporan;
						document.getElementById("ktaNamaPelapor").value = selected.namaPelapor;
						document.getElementById("ktaJabatan").value = selected.jabatan;
						document.getElementById("ktaDepartemen").value = selected.departemen;
						document.getElementById("ktaPerusahaan").value = selected.perusahaan || profile.perusahaan;
						document.getElementById("ktaTanggalTemuan").value = selected.tanggalTemuan;
						document.getElementById("ktaKategoriTemuan").value = selected.kategoriTemuan;
						document.getElementById("ktaLokasiTemuan").value = selected.lokasiTemuan || "";
						document.getElementById("ktaDetailLokasi").value = selected.detailLokasiTemuan;
						document.getElementById("ktaRiskLevel").value = selected.riskLevel;
						document.getElementById("ktaPic").value = selected.namaPic;
						document.getElementById("ktaDetailTemuan").value = selected.detailTemuan;
						document.getElementById("ktaPerbaikanLangsung").value = selected.perbaikanLangsung;
						document.getElementById("ktaTindakanPerbaikan").value = selected.tindakanPerbaikan || "";
						document.getElementById("ktaTanggalPerbaikan").value = selected.tanggalPerbaikan || "";
						document.getElementById("ktaStatus").value = selected.status || "";

						toggleDirectFixFields();
						ktaSubmitBtn.textContent = "Simpan Perubahan";
						if (ktaCancelEditBtn) {
							ktaCancelEditBtn.classList.remove("hidden");
						}
						ktaSuccess.textContent = "Mode edit aktif. Upload foto baru jika ingin mengganti foto lama.";
					});
				});

				deleteButtons.forEach((button) => {
					button.addEventListener("click", async () => {
						ktaError.textContent = "";
						ktaSuccess.textContent = "";
						const index = Number(button.dataset.index);
						const recordsNow = getKtaRecords();
						const selectedRecord = recordsNow[index];
						if (!selectedRecord) {
							return;
						}

						const deleteResult = await deleteKtaRecord(selectedRecord.noId);
						if (!deleteResult.ok) {
							ktaError.textContent = getApiErrorMessage(deleteResult, "Gagal menghapus data KTA di backend.");
							return;
						}

						recordsNow.splice(index, 1);
						writeLocalArray(KTA_KEY, recordsNow);

						if (editIndex === index) {
							resetKtaForm();
						}

						ktaSuccess.textContent = "Data KTA berhasil dihapus.";
						renderKtaHistory();
					});
				});
			}
		}

		function resetKtaForm() {
			ktaForm.reset();
			editIndex = -1;
			existingTemuanPhotos = [];
			existingPerbaikanPhotos = [];
			document.getElementById("ktaNoId").value = createKtaId();
			document.getElementById("ktaTanggalLaporan").value = getTodayDate();
			document.getElementById("ktaNamaPelapor").value = profile.namaPelapor;
			document.getElementById("ktaJabatan").value = profile.jabatan;
			document.getElementById("ktaDepartemen").value = profile.departemen;
			document.getElementById("ktaPerusahaan").value = profile.perusahaan;
			ktaSubmitBtn.textContent = "Simpan KTA";
			if (ktaCancelEditBtn) {
				ktaCancelEditBtn.classList.add("hidden");
			}
			toggleDirectFixFields();
		}

		function toggleDirectFixFields() {
			const isDirectFix = perbaikanLangsung.value === "Ya";
			directFixSection.classList.toggle("hidden", !isDirectFix);
			tindakanPerbaikan.required = isDirectFix;
			tanggalPerbaikan.required = isDirectFix;
			statusField.required = isDirectFix;
		}

		perbaikanLangsung.addEventListener("change", toggleDirectFixFields);

		ktaForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			ktaError.textContent = "";
			ktaSuccess.textContent = "";

			await runWithButtonLoading(ktaSubmitBtn, "Menyimpan...", async () => {
			await runWithFormControlsDisabled(ktaForm, async () => {

			const formData = new FormData(ktaForm);
			const fotoTemuanFiles = document.getElementById("ktaFotoTemuan").files || [];
			const fotoPerbaikanFiles = document.getElementById("ktaFotoPerbaikan").files || [];

			const payload = {
				noId: String(formData.get("noId") || "").trim(),
				tanggalLaporan: String(formData.get("tanggalLaporan") || "").trim(),
				namaPelapor: String(formData.get("namaPelapor") || "").trim(),
				jabatan: String(formData.get("jabatan") || "").trim(),
				departemen: String(formData.get("departemen") || "").trim(),
				perusahaan: String(formData.get("perusahaan") || "").trim(),
				tanggalTemuan: String(formData.get("tanggalTemuan") || "").trim(),
				kategoriTemuan: String(formData.get("kategoriTemuan") || "").trim(),
				lokasiTemuan: String(formData.get("lokasiTemuan") || "").trim(),
				detailLokasiTemuan: String(formData.get("detailLokasiTemuan") || "").trim(),
				riskLevel: String(formData.get("riskLevel") || "").trim(),
				namaPic: String(formData.get("namaPic") || "").trim(),
				detailTemuan: String(formData.get("detailTemuan") || "").trim(),
				fotoTemuan: [],
				perbaikanLangsung: String(formData.get("perbaikanLangsung") || "").trim(),
				tindakanPerbaikan: String(formData.get("tindakanPerbaikan") || "").trim(),
				fotoPerbaikan: [],
				tanggalPerbaikan: String(formData.get("tanggalPerbaikan") || "").trim(),
				status: String(formData.get("status") || "").trim(),
			};

			const requiredBase = [
				"noId",
				"tanggalLaporan",
				"namaPelapor",
				"jabatan",
				"departemen",
				"perusahaan",
				"tanggalTemuan",
				"kategoriTemuan",
				"lokasiTemuan",
				"detailLokasiTemuan",
				"riskLevel",
				"namaPic",
				"detailTemuan",
				"perbaikanLangsung",
			];

			if (requiredBase.some((field) => !payload[field])) {
				ktaError.textContent = "Lengkapi seluruh field wajib pada form KTA.";
				return;
			}

			if (!kategoriTemuanOptions.includes(payload.kategoriTemuan)) {
				ktaError.textContent = "Kategori Temuan harus dipilih dari daftar yang tersedia.";
				return;
			}

			if (!["Critical", "High", "Medium", "Low"].includes(payload.riskLevel)) {
				ktaError.textContent = "Risk Level tidak valid.";
				return;
			}

			if (!getPics().includes(payload.namaPic)) {
				ktaError.textContent = "Nama PIC harus dipilih dari Daftar PIC.";
				return;
			}

			if (![
				"Mining",
				"Hauling",
				"Port",
				"Workshop",
				"Warehouse",
				"CHPP",
				"Office",
				"Camp",
				"Others",
			].includes(payload.lokasiTemuan)) {
				ktaError.textContent = "Lokasi Temuan harus dipilih dari daftar yang tersedia.";
				return;
			}

			if (payload.perbaikanLangsung === "Ya") {
				if (!payload.tindakanPerbaikan || !payload.tanggalPerbaikan || !payload.status) {
					ktaError.textContent = "Lengkapi field perbaikan langsung (Tindakan, Tanggal, dan Status).";
					return;
				}

				if (!["Open", "Progress", "Close"].includes(payload.status)) {
					ktaError.textContent = "Status perbaikan tidak valid.";
					return;
				}
			}

			if (payload.perbaikanLangsung === "Tidak") {
				payload.tindakanPerbaikan = "";
				payload.fotoPerbaikan = [];
				payload.tanggalPerbaikan = "";
				payload.status = "Open";
			}

			payload.fotoTemuan = await readFilesAsDataUrls(fotoTemuanFiles);
			if (editIndex >= 0 && payload.fotoTemuan.length === 0) {
				payload.fotoTemuan = existingTemuanPhotos;
			}

			if (payload.perbaikanLangsung === "Ya") {
				payload.fotoPerbaikan = await readFilesAsDataUrls(fotoPerbaikanFiles);
				if (editIndex >= 0 && payload.fotoPerbaikan.length === 0) {
					payload.fotoPerbaikan = existingPerbaikanPhotos;
				}
			}

			const records = getKtaRecords();

			if (editIndex >= 0 && isSuperAdmin) {
				const currentRecord = records[editIndex];
				if (!currentRecord) {
					ktaError.textContent = "Data KTA yang akan diperbarui tidak ditemukan.";
					return;
				}

				const updateResult = await updateKtaRecord(currentRecord.noId, payload);
				if (!updateResult.ok) {
					ktaError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui data KTA di backend.");
					return;
				}

				records[editIndex] = payload;
				writeLocalArray(KTA_KEY, records);
			} else {
				const createResult = await createKtaRecord(payload);
				if (!createResult.ok) {
					ktaError.textContent = getApiErrorMessage(createResult, "Gagal menyimpan data KTA ke backend.");
					return;
				}

				records.push(payload);
				writeLocalArray(KTA_KEY, records);
			}

			ktaSuccess.textContent =
				editIndex >= 0 && isSuperAdmin
					? `Data KTA berhasil diperbarui dengan No ID ${payload.noId}.`
					: `Data KTA berhasil disimpan dengan No ID ${payload.noId}.`;
			resetKtaForm();
			renderKtaHistory();
			});
			});
		});

		if (ktaCancelEditBtn) {
			ktaCancelEditBtn.addEventListener("click", () => {
				resetKtaForm();
				ktaSuccess.textContent = "Mode edit dibatalkan.";
			});
		}

		toggleDirectFixFields();
		renderKtaHistory();
	}

	function renderTtaContent() {
		const reportDate = getTodayDate();
		const noId = createTtaId();
		const picOptions = getPics();
		const userOptions = getManagedUsers();
		const kategoriTemuanOptions = [
			"Mengoperasikan unit/diluar prosedur yang di tentukan",
			"Menggunakan peralatan atau permesinan dalam keadaan rusak",
			"Tidak menggunakan APD yang sesuai",
			"Penempatan material yang tidak sesuai",
			"Berada pada daerah tau posisi yang tidak aman",
			"Bercanda berlebihan",
			"Menggunakan peralatan yang tidak sesuai",
			"Ergonomi yang kurang baik",
		];
		const lokasiTemuanOptions = DEFAULT_LOKASI_TEMUAN;
		const profile = getReporterProfile(session);

		contentArea.innerHTML = `
			<h2>Form TTA</h2>
			<p class="subtitle">Input data TTA sesuai temuan lapangan.</p>
			<form id="ttaForm" class="form-grid" novalidate>
				<div class="field">
					<label for="ttaNoId">No ID</label>
					<input id="ttaNoId" name="noId" type="text" value="${noId}" readonly />
				</div>
				<div class="field">
					<label for="ttaTanggalLaporan">Tanggal Laporan</label>
					<input id="ttaTanggalLaporan" name="tanggalLaporan" type="date" value="${reportDate}" readonly />
				</div>
				<div class="field">
					<label for="ttaNamaPelapor">Nama Pelapor</label>
					<input id="ttaNamaPelapor" name="namaPelapor" type="text" value="${profile.namaPelapor}" readonly />
				</div>
				<div class="field">
					<label for="ttaJabatan">Jabatan</label>
					<input id="ttaJabatan" name="jabatan" type="text" value="${profile.jabatan}" readonly />
				</div>
				<div class="field">
					<label for="ttaDepartemen">Departemen</label>
					<input id="ttaDepartemen" name="departemen" type="text" value="${profile.departemen}" readonly />
				</div>
				<div class="field">
					<label for="ttaPerusahaan">Perusahaan</label>
					<input id="ttaPerusahaan" name="perusahaan" type="text" value="${profile.perusahaan}" readonly />
				</div>
				<div class="field">
					<label for="ttaTanggalTemuan">Tanggal Temuan</label>
					<input id="ttaTanggalTemuan" name="tanggalTemuan" type="date" required />
				</div>
				<div class="field">
					<label for="ttaJamTemuan">Jam Temuan</label>
					<input id="ttaJamTemuan" name="jamTemuan" type="time" required />
				</div>
				<div class="field">
					<label for="ttaKategoriTemuan">Kategori Temuan</label>
					<select id="ttaKategoriTemuan" name="kategoriTemuan" required>
						<option value="">Pilih Kategori Temuan</option>
						${kategoriTemuanOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ttaLokasiTemuan">Lokasi Temuan</label>
					<select id="ttaLokasiTemuan" name="lokasiTemuan" required>
						<option value="">Pilih Lokasi Temuan</option>
						${lokasiTemuanOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ttaDetailLokasi">Detail Lokasi Temuan</label>
					<input id="ttaDetailLokasi" name="detailLokasiTemuan" type="text" required />
				</div>
				<div class="field">
					<label for="ttaRiskLevel">Risk Level</label>
					<select id="ttaRiskLevel" name="riskLevel" required>
						<option value="">Pilih Risk Level</option>
						<option value="Critical">Critical</option>
						<option value="High">High</option>
						<option value="Medium">Medium</option>
						<option value="Low">Low</option>
					</select>
				</div>
				<div class="field">
					<label for="ttaPja">Nama PIC</label>
					<select id="ttaPja" name="namaPja" required>
						<option value="">Pilih PIC</option>
						${picOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ttaPelaku">Nama Pelaku TTA</label>
					<select id="ttaPelaku" name="namaPelakuTta" required>
						<option value="">Pilih Pelaku TTA</option>
						${userOptions.map((item) => `<option value="${item.username}">${item.namaLengkap || item.username}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="ttaJabatanPelaku">Jabatan Pelaku TTA</label>
					<input id="ttaJabatanPelaku" name="jabatanPelakuTta" type="text" readonly />
				</div>
				<div class="field">
					<label for="ttaDepartemenPelaku">Departemen Pelaku TTA</label>
					<input id="ttaDepartemenPelaku" name="departemenPelakuTta" type="text" readonly />
				</div>
				<div class="field">
					<label for="ttaPerusahaanPelaku">Perusahaan Pelaku TTA</label>
					<input id="ttaPerusahaanPelaku" name="perusahaanPelakuTta" type="text" readonly />
				</div>
				<div class="field field-full">
					<label for="ttaDetailTemuan">Detail Temuan</label>
					<textarea id="ttaDetailTemuan" name="detailTemuan" rows="3" required></textarea>
				</div>
				<div class="field field-full">
					<label for="ttaFotoTemuan">Foto Temuan</label>
					<input id="ttaFotoTemuan" name="fotoTemuan" type="file" accept="image/*" multiple />
				</div>
				<div class="field">
					<label for="ttaPerbaikanLangsung">Perbaikan Langsung</label>
					<select id="ttaPerbaikanLangsung" name="perbaikanLangsung" required>
						<option value="">Pilih</option>
						<option value="Ya">Ya</option>
						<option value="Tidak">Tidak</option>
					</select>
				</div>

				<div id="ttaDirectFixSection" class="field-full hidden">
					<div class="form-grid">
						<div class="field field-full">
							<label for="ttaTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="ttaTindakanPerbaikan" name="tindakanPerbaikan" rows="3"></textarea>
						</div>
						<div class="field field-full">
							<label for="ttaFotoPerbaikan">Foto Perbaikan</label>
							<input id="ttaFotoPerbaikan" name="fotoPerbaikan" type="file" accept="image/*" multiple />
						</div>
						<div class="field">
							<label for="ttaTanggalPerbaikan">Tanggal Perbaikan</label>
							<input id="ttaTanggalPerbaikan" name="tanggalPerbaikan" type="date" />
						</div>
						<div class="field">
							<label for="ttaStatus">Status</label>
							<select id="ttaStatus" name="status">
								<option value="">Pilih Status</option>
								<option value="Open">Open</option>
								<option value="Progress">Progress</option>
								<option value="Close">Close</option>
							</select>
						</div>
					</div>
				</div>

				<div class="inline-actions field-full">
					<button type="submit" id="ttaSubmitBtn" class="btn-primary">Simpan TTA</button>
					<button type="button" id="ttaCancelEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="ttaError" class="error"></p>
			<div id="ttaSuccess" class="subtitle"></div>
			<h3>Riwayat TTA</h3>
			<div id="ttaHistory" class="table-wrap"></div>
			<div id="ttaDetailPanel" class="detail-panel hidden"></div>
		`;

		const ttaForm = document.getElementById("ttaForm");
		const pelakuField = document.getElementById("ttaPelaku");
		const jabatanPelakuField = document.getElementById("ttaJabatanPelaku");
		const departemenPelakuField = document.getElementById("ttaDepartemenPelaku");
		const perusahaanPelakuField = document.getElementById("ttaPerusahaanPelaku");
		const perbaikanLangsung = document.getElementById("ttaPerbaikanLangsung");
		const directFixSection = document.getElementById("ttaDirectFixSection");
		const tindakanPerbaikan = document.getElementById("ttaTindakanPerbaikan");
		const tanggalPerbaikan = document.getElementById("ttaTanggalPerbaikan");
		const statusField = document.getElementById("ttaStatus");
		const ttaError = document.getElementById("ttaError");
		const ttaSuccess = document.getElementById("ttaSuccess");
		const ttaHistory = document.getElementById("ttaHistory");
		const ttaDetailPanel = document.getElementById("ttaDetailPanel");
		const ttaSubmitBtn = document.getElementById("ttaSubmitBtn");
		const ttaCancelEditBtn = document.getElementById("ttaCancelEditBtn");

		let editIndex = -1;
		let existingTemuanPhotos = [];
		let existingPerbaikanPhotos = [];

		function renderPhotos(photos) {
			if (!Array.isArray(photos) || photos.length === 0) {
				return `<p class="subtitle">Tidak ada foto.</p>`;
			}

			const photoHtml = photos
				.map((photo) => {
					if (!photo.dataUrl) {
						return `<div class="photo-card"><p class="subtitle">${photo.name}</p></div>`;
					}

					return `
						<div class="photo-card">
							<img src="${photo.dataUrl}" alt="${photo.name}" class="photo-thumb" />
							<p class="photo-caption">${photo.name}</p>
						</div>
					`;
				})
				.join("");

			return `<div class="photo-grid">${photoHtml}</div>`;
		}

		function updatePelakuInfo() {
			const selected = userOptions.find((item) => item.username === pelakuField.value);
			jabatanPelakuField.value = selected ? selected.jabatan : "";
			departemenPelakuField.value = selected ? selected.departemen : "";
			perusahaanPelakuField.value = selected ? selected.perusahaan || "-" : "";
		}

		function showTtaDetail(record) {
			ttaDetailPanel.classList.remove("hidden");
			ttaDetailPanel.innerHTML = `
				<div class="detail-header">
					<h3>Detail TTA - ${record.noId}</h3>
					<button type="button" id="closeTtaDetail" class="btn-small">Tutup</button>
				</div>
				<div class="detail-grid">
					<p><strong>Tanggal Laporan:</strong> ${record.tanggalLaporan}</p>
					<p><strong>Nama Pelapor:</strong> ${record.namaPelapor}</p>
					<p><strong>Jabatan:</strong> ${record.jabatan}</p>
					<p><strong>Departemen:</strong> ${record.departemen}</p>
					<p><strong>Perusahaan:</strong> ${record.perusahaan || "-"}</p>
					<p><strong>Tanggal Temuan:</strong> ${record.tanggalTemuan}</p>
					<p><strong>Jam Temuan:</strong> ${record.jamTemuan}</p>
					<p><strong>Kategori Temuan:</strong> ${record.kategoriTemuan}</p>
					<p><strong>Lokasi Temuan:</strong> ${record.lokasiTemuan || "-"}</p>
					<p><strong>Detail Lokasi Temuan:</strong> ${record.detailLokasiTemuan}</p>
					<p><strong>Risk Level:</strong> ${record.riskLevel}</p>
					<p><strong>Nama PIC:</strong> ${record.namaPja || record.namaPic || "-"}</p>
					<p><strong>Nama Pelaku TTA:</strong> ${getUserFullNameFromIdentifier(record.namaPelakuTta)}</p>
					<p><strong>Jabatan Pelaku TTA:</strong> ${record.jabatanPelakuTta}</p>
					<p><strong>Departemen Pelaku TTA:</strong> ${record.departemenPelakuTta}</p>
					<p><strong>Perusahaan Pelaku TTA:</strong> ${record.perusahaanPelakuTta || "-"}</p>
					<p><strong>Perbaikan Langsung:</strong> ${record.perbaikanLangsung}</p>
					<p><strong>Status:</strong> ${record.status || "-"}</p>
					<p><strong>Tanggal Perbaikan:</strong> ${record.tanggalPerbaikan || "-"}</p>
				</div>
				<p><strong>Detail Temuan:</strong> ${record.detailTemuan}</p>
				<p><strong>Tindakan Perbaikan:</strong> ${record.tindakanPerbaikan || "-"}</p>
				<h4>Foto Temuan</h4>
				${renderPhotos(record.fotoTemuan)}
				<h4>Foto Perbaikan</h4>
				${renderPhotos(record.fotoPerbaikan)}
			`;

			const closeTtaDetail = document.getElementById("closeTtaDetail");
			closeTtaDetail.addEventListener("click", () => {
				ttaDetailPanel.classList.add("hidden");
				ttaDetailPanel.innerHTML = "";
			});
		}

		function renderTtaHistory() {
			const records = getTtaRecords();

			if (records.length === 0) {
				ttaHistory.innerHTML = `<p class="subtitle">Belum ada data TTA tersimpan.</p>`;
				return;
			}

			const rows = records
				.map((item, index) => ({ item, index }))
				.reverse()
				.map(
					(entry) => `
						<tr>
							<td>${entry.item.noId}</td>
							<td>${entry.item.tanggalLaporan}</td>
							<td>${entry.item.namaPelapor}</td>
							<td>${entry.item.namaPja || entry.item.namaPic || "-"}</td>
							<td>${getUserFullNameFromIdentifier(entry.item.namaPelakuTta)}</td>
							<td>${entry.item.riskLevel}</td>
							<td>${entry.item.status || "-"}</td>
							<td>
								<button type="button" class="btn-small btn-edit tta-detail-btn" data-index="${entry.index}">Detail</button>
								<button type="button" class="btn-small btn-edit tta-edit-btn" data-index="${entry.index}">Edit</button>
								<button type="button" class="btn-small btn-delete tta-delete-btn" data-index="${entry.index}">Hapus</button>
							</td>
						</tr>
					`,
				)
				.join("");

			ttaHistory.innerHTML = `
				<table class="data-table">
					<thead>
						<tr>
							<th>No ID</th>
							<th>Tanggal Laporan</th>
							<th>Nama Pelapor</th>
							<th>Nama PIC</th>
							<th>Pelaku TTA</th>
							<th>Risk Level</th>
							<th>Status</th>
							<th>Aksi</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			`;

			const detailButtons = ttaHistory.querySelectorAll(".tta-detail-btn");
			const editButtons = ttaHistory.querySelectorAll(".tta-edit-btn");
			const deleteButtons = ttaHistory.querySelectorAll(".tta-delete-btn");

			detailButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					const selected = getTtaRecords()[index];
					if (selected) {
						showTtaDetail(selected);
					}
				});
			});

			editButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					const selected = getTtaRecords()[index];
					if (!selected) {
						return;
					}

					editIndex = index;
					existingTemuanPhotos = Array.isArray(selected.fotoTemuan) ? selected.fotoTemuan : [];
					existingPerbaikanPhotos = Array.isArray(selected.fotoPerbaikan) ? selected.fotoPerbaikan : [];

					document.getElementById("ttaNoId").value = selected.noId;
					document.getElementById("ttaTanggalLaporan").value = selected.tanggalLaporan;
					document.getElementById("ttaNamaPelapor").value = selected.namaPelapor;
					document.getElementById("ttaJabatan").value = selected.jabatan;
					document.getElementById("ttaDepartemen").value = selected.departemen;
						document.getElementById("ttaPerusahaan").value = selected.perusahaan || profile.perusahaan;
					document.getElementById("ttaTanggalTemuan").value = selected.tanggalTemuan;
					document.getElementById("ttaJamTemuan").value = selected.jamTemuan;
					document.getElementById("ttaKategoriTemuan").value = selected.kategoriTemuan;
						document.getElementById("ttaLokasiTemuan").value = selected.lokasiTemuan || "";
						document.getElementById("ttaDetailLokasi").value = selected.detailLokasiTemuan;
					document.getElementById("ttaRiskLevel").value = selected.riskLevel;
						document.getElementById("ttaPja").value = selected.namaPja || selected.namaPic || "";
					const selectedPelakuUser = userOptions.find(
						(item) => item.username === selected.namaPelakuTta || item.namaLengkap === selected.namaPelakuTta,
					);
					document.getElementById("ttaPelaku").value = selectedPelakuUser ? selectedPelakuUser.username : "";
					document.getElementById("ttaDetailTemuan").value = selected.detailTemuan;
					document.getElementById("ttaPerbaikanLangsung").value = selected.perbaikanLangsung;
					document.getElementById("ttaTindakanPerbaikan").value = selected.tindakanPerbaikan || "";
					document.getElementById("ttaTanggalPerbaikan").value = selected.tanggalPerbaikan || "";
					document.getElementById("ttaStatus").value = selected.status || "";

					updatePelakuInfo();
					toggleDirectFixFields();
					ttaSubmitBtn.textContent = "Simpan Perubahan";
					ttaCancelEditBtn.classList.remove("hidden");
					ttaSuccess.textContent = "Mode edit TTA aktif. Upload foto baru jika ingin mengganti foto lama.";
				});
			});

			deleteButtons.forEach((button) => {
				button.addEventListener("click", async () => {
					ttaError.textContent = "";
					ttaSuccess.textContent = "";
					const index = Number(button.dataset.index);
					const recordsNow = getTtaRecords();
					const selectedRecord = recordsNow[index];
					if (!selectedRecord) {
						return;
					}

					const deleteResult = await deleteTtaRecord(selectedRecord.noId);
					if (!deleteResult.ok) {
						ttaError.textContent = getApiErrorMessage(deleteResult, "Gagal menghapus data TTA di backend.");
						return;
					}

					recordsNow.splice(index, 1);
					writeLocalArray(TTA_KEY, recordsNow);

					if (editIndex === index) {
						resetTtaForm();
					}

					ttaSuccess.textContent = "Data TTA berhasil dihapus.";
					renderTtaHistory();
				});
			});
		}

		function resetTtaForm() {
			ttaForm.reset();
			editIndex = -1;
			existingTemuanPhotos = [];
			existingPerbaikanPhotos = [];
			document.getElementById("ttaNoId").value = createTtaId();
			document.getElementById("ttaTanggalLaporan").value = getTodayDate();
			document.getElementById("ttaNamaPelapor").value = profile.namaPelapor;
			document.getElementById("ttaJabatan").value = profile.jabatan;
			document.getElementById("ttaDepartemen").value = profile.departemen;
			document.getElementById("ttaPerusahaan").value = profile.perusahaan;
			ttaSubmitBtn.textContent = "Simpan TTA";
			ttaCancelEditBtn.classList.add("hidden");
			updatePelakuInfo();
			toggleDirectFixFields();
		}

		function toggleDirectFixFields() {
			const isDirectFix = perbaikanLangsung.value === "Ya";
			directFixSection.classList.toggle("hidden", !isDirectFix);
			tindakanPerbaikan.required = isDirectFix;
			tanggalPerbaikan.required = isDirectFix;
			statusField.required = isDirectFix;
		}

		pelakuField.addEventListener("change", updatePelakuInfo);
		perbaikanLangsung.addEventListener("change", toggleDirectFixFields);

		ttaForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			ttaError.textContent = "";
			ttaSuccess.textContent = "";

			await runWithButtonLoading(ttaSubmitBtn, "Menyimpan...", async () => {
			await runWithFormControlsDisabled(ttaForm, async () => {

			const formData = new FormData(ttaForm);
			const fotoTemuanFiles = document.getElementById("ttaFotoTemuan").files || [];
			const fotoPerbaikanFiles = document.getElementById("ttaFotoPerbaikan").files || [];

			const payload = {
				noId: String(formData.get("noId") || "").trim(),
				tanggalLaporan: String(formData.get("tanggalLaporan") || "").trim(),
				namaPelapor: String(formData.get("namaPelapor") || "").trim(),
				jabatan: String(formData.get("jabatan") || "").trim(),
				departemen: String(formData.get("departemen") || "").trim(),
				perusahaan: String(formData.get("perusahaan") || "").trim(),
				tanggalTemuan: String(formData.get("tanggalTemuan") || "").trim(),
				jamTemuan: String(formData.get("jamTemuan") || "").trim(),
				kategoriTemuan: String(formData.get("kategoriTemuan") || "").trim(),
				lokasiTemuan: String(formData.get("lokasiTemuan") || "").trim(),
				detailLokasiTemuan: String(formData.get("detailLokasiTemuan") || "").trim(),
				riskLevel: String(formData.get("riskLevel") || "").trim(),
				namaPja: String(formData.get("namaPja") || "").trim(),
				namaPelakuTta: String(formData.get("namaPelakuTta") || "").trim(),
				jabatanPelakuTta: String(formData.get("jabatanPelakuTta") || "").trim(),
				departemenPelakuTta: String(formData.get("departemenPelakuTta") || "").trim(),
				perusahaanPelakuTta: String(formData.get("perusahaanPelakuTta") || "").trim(),
				detailTemuan: String(formData.get("detailTemuan") || "").trim(),
				fotoTemuan: [],
				perbaikanLangsung: String(formData.get("perbaikanLangsung") || "").trim(),
				tindakanPerbaikan: String(formData.get("tindakanPerbaikan") || "").trim(),
				fotoPerbaikan: [],
				tanggalPerbaikan: String(formData.get("tanggalPerbaikan") || "").trim(),
				status: String(formData.get("status") || "").trim(),
			};

			const requiredBase = [
				"noId",
				"tanggalLaporan",
				"namaPelapor",
				"jabatan",
				"departemen",
				"perusahaan",
				"tanggalTemuan",
				"jamTemuan",
				"kategoriTemuan",
				"lokasiTemuan",
				"detailLokasiTemuan",
				"riskLevel",
				"namaPja",
				"namaPelakuTta",
				"jabatanPelakuTta",
				"departemenPelakuTta",
				"perusahaanPelakuTta",
				"detailTemuan",
				"perbaikanLangsung",
			];

			if (requiredBase.some((field) => !payload[field])) {
				ttaError.textContent = "Lengkapi seluruh field wajib pada form TTA.";
				return;
			}

			if (!kategoriTemuanOptions.includes(payload.kategoriTemuan)) {
				ttaError.textContent = "Kategori Temuan harus dipilih dari daftar yang tersedia.";
				return;
			}

			if (!getPics().includes(payload.namaPja)) {
				ttaError.textContent = "Nama PIC harus dipilih dari Daftar PIC.";
				return;
			}

			if (![
				"Mining",
				"Hauling",
				"Port",
				"Workshop",
				"Warehouse",
				"CHPP",
				"Office",
				"Camp",
				"Others",
			].includes(payload.lokasiTemuan)) {
				ttaError.textContent = "Lokasi Temuan harus dipilih dari daftar yang tersedia.";
				return;
			}

			const selectedPelaku = userOptions.find((item) => item.username === payload.namaPelakuTta);
			if (!selectedPelaku) {
				ttaError.textContent = "Nama Pelaku TTA harus dipilih dari Daftar User.";
				return;
			}

			payload.namaPelakuTta = String(selectedPelaku.namaLengkap || selectedPelaku.username || "").trim();

			if (
				payload.jabatanPelakuTta !== selectedPelaku.jabatan ||
				payload.departemenPelakuTta !== selectedPelaku.departemen ||
				payload.perusahaanPelakuTta !== (selectedPelaku.perusahaan || "-")
			) {
				ttaError.textContent = "Jabatan/Departemen/Perusahaan pelaku harus sesuai dengan data Daftar User.";
				return;
			}

			if (payload.perbaikanLangsung === "Ya") {
				if (!payload.tindakanPerbaikan || !payload.tanggalPerbaikan || !payload.status) {
					ttaError.textContent = "Lengkapi field perbaikan langsung (Tindakan, Tanggal, dan Status).";
					return;
				}

				if (!["Open", "Progress", "Close"].includes(payload.status)) {
					ttaError.textContent = "Status perbaikan tidak valid.";
					return;
				}
			}

			if (payload.perbaikanLangsung === "Tidak") {
				payload.tindakanPerbaikan = "";
				payload.fotoPerbaikan = [];
				payload.tanggalPerbaikan = "";
				payload.status = "Open";
			}

			payload.fotoTemuan = await readFilesAsDataUrls(fotoTemuanFiles);
			if (editIndex >= 0 && payload.fotoTemuan.length === 0) {
				payload.fotoTemuan = existingTemuanPhotos;
			}

			if (payload.perbaikanLangsung === "Ya") {
				payload.fotoPerbaikan = await readFilesAsDataUrls(fotoPerbaikanFiles);
				if (editIndex >= 0 && payload.fotoPerbaikan.length === 0) {
					payload.fotoPerbaikan = existingPerbaikanPhotos;
				}
			}

			const records = getTtaRecords();
			if (editIndex >= 0) {
				const currentRecord = records[editIndex];
				if (!currentRecord) {
					ttaError.textContent = "Data TTA yang akan diperbarui tidak ditemukan.";
					return;
				}

				const updateResult = await updateTtaRecord(currentRecord.noId, payload);
				if (!updateResult.ok) {
					ttaError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui data TTA di backend.");
					return;
				}

				records[editIndex] = payload;
				writeLocalArray(TTA_KEY, records);
			} else {
				const createResult = await createTtaRecord(payload);
				if (!createResult.ok) {
					ttaError.textContent = getApiErrorMessage(createResult, "Gagal menyimpan data TTA ke backend.");
					return;
				}

				records.push(payload);
				writeLocalArray(TTA_KEY, records);
			}

			ttaSuccess.textContent = editIndex >= 0 ? `Data TTA berhasil diperbarui dengan No ID ${payload.noId}.` : `Data TTA berhasil disimpan dengan No ID ${payload.noId}.`;
			resetTtaForm();
			renderTtaHistory();
			});
			});
		});

		ttaCancelEditBtn.addEventListener("click", () => {
			resetTtaForm();
			ttaSuccess.textContent = "Mode edit TTA dibatalkan.";
		});

		updatePelakuInfo();
		toggleDirectFixFields();
		renderTtaHistory();
	}

	function renderUserContent() {
		const departments = getDepartments();
		const jobGroupOptions = ["PENGAWAS", "OPERATOR", "LEVEL 1 MGT"];

		contentArea.innerHTML = `
			<h2>Daftar User</h2>
			<p class="subtitle">Kelola profil user untuk referensi Daftar PIC.</p>
			${departments.length === 0 ? '<p class="error">Daftar Departemen belum tersedia. Tambahkan departemen terlebih dahulu.</p>' : ""}
			<form id="userForm" class="form-grid" novalidate>
				<div class="field">
					<label for="userUsername">Username</label>
					<input id="userUsername" name="username" type="text" required />
				</div>
				<div class="field">
					<label for="userPassword">Password</label>
					<input id="userPassword" name="password" type="text" minlength="8" required />
				</div>
				<div class="field">
					<label for="userKategori">Kategori</label>
					<select id="userKategori" name="kategori" required>
						<option value="">Pilih Kategori</option>
						<option value="Admin">Admin</option>
						<option value="User">User</option>
					</select>
				</div>
				<div class="field">
					<label for="userNamaLengkap">Nama Lengkap</label>
					<input id="userNamaLengkap" name="namaLengkap" type="text" required />
				</div>
				<div class="field">
					<label for="userNoHp">No HP</label>
					<input id="userNoHp" name="noHp" type="text" inputmode="numeric" required />
				</div>
				<div class="field">
					<label for="userEmail">Alamat Email</label>
					<input id="userEmail" name="alamatEmail" type="email" required />
				</div>
				<div class="field">
					<label for="userNoKaryawan">No Karyawan</label>
					<input id="userNoKaryawan" name="noKaryawan" type="text" required />
				</div>
				<div class="field">
					<label for="userJabatan">Jabatan</label>
					<input id="userJabatan" name="jabatan" type="text" required />
				</div>
				<div class="field">
					<label for="userKelompokJabatan">Kelompok Jabatan</label>
					<select id="userKelompokJabatan" name="kelompokJabatan" required>
						<option value="">Pilih Kelompok Jabatan</option>
						${jobGroupOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label for="userPerusahaan">Perusahaan</label>
					<input id="userPerusahaan" name="perusahaan" type="text" required />
				</div>
				<div class="field">
					<label for="userDepartemen">Departemen</label>
					<select id="userDepartemen" name="departemen" required>
						<option value="">Pilih Departemen</option>
						${departments.map((item) => `<option value="${item}">${item}</option>`).join("")}
					</select>
				</div>
				<div class="inline-actions field-full">
					<button type="submit" id="saveUserBtn" class="btn-primary">Tambah</button>
					<button type="button" id="cancelUserEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="userError" class="error"></p>
			<div id="userList" class="list-wrap"></div>
		`;

		const userForm = document.getElementById("userForm");
		const saveUserBtn = document.getElementById("saveUserBtn");
		const cancelUserEditBtn = document.getElementById("cancelUserEditBtn");
		const userError = document.getElementById("userError");
		const userList = document.getElementById("userList");

		let users = getManagedUsers();
		let editIndex = -1;
		let editUsernameKey = "";

		function getFormData() {
			const formData = new FormData(userForm);
			return {
				username: String(formData.get("username") || "").trim(),
				password: String(formData.get("password") || "").trim(),
				kategori: String(formData.get("kategori") || "").trim(),
				namaLengkap: String(formData.get("namaLengkap") || "").trim(),
				noHp: String(formData.get("noHp") || "").trim(),
				alamatEmail: String(formData.get("alamatEmail") || "").trim().toLowerCase(),
				noKaryawan: String(formData.get("noKaryawan") || "").trim(),
				jabatan: String(formData.get("jabatan") || "").trim(),
				kelompokJabatan: String(formData.get("kelompokJabatan") || "").trim(),
				perusahaan: String(formData.get("perusahaan") || "").trim(),
				departemen: String(formData.get("departemen") || "").trim(),
			};
		}

		function validateUserData(userData) {
			const requiredFields = [
				"username",
				"password",
				"kategori",
				"namaLengkap",
				"noHp",
				"alamatEmail",
				"noKaryawan",
				"jabatan",
				"kelompokJabatan",
				"perusahaan",
				"departemen",
			];

			if (requiredFields.some((field) => !userData[field])) {
				return "Semua field wajib diisi.";
			}

			const usernameLower = userData.username.toLowerCase();
			const reservedUsers = Object.keys(USERS);
			if (reservedUsers.includes(usernameLower)) {
				return "Username sudah digunakan oleh akun sistem.";
			}

			const duplicate = users.some((item, index) => index !== editIndex && item.username.toLowerCase() === usernameLower);
			if (duplicate) {
				return "Username tidak boleh duplikasi.";
			}

			if (userData.password.length < 8) {
				return "Password minimal 8 huruf.";
			}

			if (!["Admin", "User"].includes(userData.kategori)) {
				return "Kategori harus Admin atau User.";
			}

			if (!/^\d{1,13}$/.test(userData.noHp)) {
				return "No HP harus angka dan maksimal 13 angka.";
			}

			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.alamatEmail)) {
				return "Format alamat email tidak valid.";
			}

			const emailLower = userData.alamatEmail.toLowerCase();
			const duplicateEmail = users.some(
				(item, index) => index !== editIndex && String(item.alamatEmail || "").trim().toLowerCase() === emailLower,
			);
			if (duplicateEmail) {
				return "Alamat email tidak boleh duplikasi.";
			}

			if (!departments.includes(userData.departemen)) {
				return "Departemen harus dipilih dari Daftar Departemen.";
			}

			if (!jobGroupOptions.includes(userData.kelompokJabatan)) {
				return "Kelompok Jabatan harus dipilih dari daftar yang tersedia.";
			}

			return "";
		}

		function fillForm(userData) {
			Object.entries(userData).forEach(([key, value]) => {
				const field = userForm.elements.namedItem(key);
				if (field) {
					field.value = value;
				}
			});
		}

		function resetForm() {
			userForm.reset();
			editIndex = -1;
			editUsernameKey = "";
			saveUserBtn.textContent = "Tambah";
			cancelUserEditBtn.classList.add("hidden");
			userError.textContent = "";
		}

		function renderUserList() {
			if (users.length === 0) {
				userList.innerHTML = `<p class="subtitle">Belum ada data user.</p>`;
				return;
			}

			const rows = users
				.map(
					(item, index) => `
						<div class="list-item">
							<div>
								<div class="list-text">Nama Lengkap: <strong>${item.namaLengkap || "(Tidak Tersedia)"}</strong></div>
								<div class="subtitle">Username: ${item.username || "(Tidak Tersedia)"}</div>
								<div class="subtitle">Kategori: ${item.kategori || "(Tidak Tersedia)"} • Perusahaan: ${item.perusahaan || "(Tidak Tersedia)"} • Departemen: ${item.departemen || "(Tidak Tersedia)"}</div>
							</div>
							<div class="list-actions">
								<button type="button" class="btn-small btn-edit" data-index="${index}">Ubah</button>
								<button type="button" class="btn-small btn-delete" data-index="${index}">Hapus</button>
							</div>
						</div>
					`,
				)
				.join("");

			userList.innerHTML = rows;

			const editButtons = userList.querySelectorAll(".btn-edit");
			const deleteButtons = userList.querySelectorAll(".btn-delete");

			editButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					editIndex = index;
					editUsernameKey = String(users[index]?.username || "").trim();
					fillForm(users[index]);
					saveUserBtn.textContent = "Simpan Perubahan";
					cancelUserEditBtn.classList.remove("hidden");
				});
			});

			deleteButtons.forEach((button) => {
				button.addEventListener("click", async () => {
					userError.textContent = "";
					const index = Number(button.dataset.index);
					const selectedUser = users[index];
					if (!selectedUser) {
						return;
					}

					const deleteResult = await deleteManagedUser(selectedUser.username);
					if (!deleteResult.ok) {
						userError.textContent = getApiErrorMessage(deleteResult, "Gagal menghapus user di backend.");
						return;
					}

					users.splice(index, 1);
					writeLocalArray(USER_MASTER_KEY, users);

					if (editIndex === index) {
						resetForm();
					}

					renderUserList();
				});
			});
		}

		userForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			userError.textContent = "";

			await runWithButtonLoading(saveUserBtn, "Menyimpan...", async () => {
				await runWithFormControlsDisabled(userForm, async () => {
				const userData = getFormData();
				const validationError = validateUserData(userData);
				if (validationError) {
					userError.textContent = validationError;
					return;
				}

				if (editIndex >= 0) {
					const targetUsername = editUsernameKey || userData.username;
					const updateResult = await updateManagedUser(targetUsername, userData);
					if (!updateResult.ok) {
						userError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui user di backend.");
						return;
					}

					users[editIndex] = userData;
					writeLocalArray(USER_MASTER_KEY, users);
				} else {
					const createResult = await createManagedUser(userData);
					if (!createResult.ok) {
						userError.textContent = getApiErrorMessage(createResult, "Gagal menambah user ke backend.");
						return;
					}

					users.push(userData);
					writeLocalArray(USER_MASTER_KEY, users);
				}

				resetForm();
				renderUserList();
				});
			});
		});

		cancelUserEditBtn.addEventListener("click", () => {
			resetForm();
		});

		renderUserList();
	}

	function renderDepartmentContent() {
		if (session.role !== "Super Admin") {
			renderDefaultContent("Daftar Departemen");
			return;
		}

		contentArea.innerHTML = `
			<h2>Daftar Departemen</h2>
			<p class="subtitle">Kelola data departemen (format teks).</p>
			<form id="departmentForm" class="form-inline" novalidate>
				<div class="field inline-grow">
					<label for="departmentName">Departemen</label>
					<input id="departmentName" name="departmentName" type="text" placeholder="Masukkan nama departemen" required />
				</div>
				<div class="inline-actions">
					<button type="submit" id="saveDepartmentBtn" class="btn-primary">Tambah</button>
					<button type="button" id="cancelEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="departmentError" class="error"></p>
			<div id="departmentList" class="list-wrap"></div>
		`;

		const departmentForm = document.getElementById("departmentForm");
		const departmentName = document.getElementById("departmentName");
		const saveDepartmentBtn = document.getElementById("saveDepartmentBtn");
		const cancelEditBtn = document.getElementById("cancelEditBtn");
		const departmentError = document.getElementById("departmentError");
		const departmentList = document.getElementById("departmentList");

		let departments = getDepartments();
		let editIndex = -1;
		let editDepartmentName = "";

		function resetForm() {
			departmentForm.reset();
			editIndex = -1;
			editDepartmentName = "";
			saveDepartmentBtn.textContent = "Tambah";
			cancelEditBtn.classList.add("hidden");
			departmentError.textContent = "";
		}

		function renderDepartmentList() {
			if (departments.length === 0) {
				departmentList.innerHTML = `<p class="subtitle">Belum ada data departemen.</p>`;
				return;
			}

			const rows = departments
				.map(
					(item, index) => `
						<div class="list-item">
							<span class="list-text">${item}</span>
							<div class="list-actions">
								<button type="button" class="btn-small btn-edit" data-index="${index}">Ubah</button>
								<button type="button" class="btn-small btn-delete" data-index="${index}">Hapus</button>
							</div>
						</div>
					`,
				)
				.join("");

			departmentList.innerHTML = rows;

			const editButtons = departmentList.querySelectorAll(".btn-edit");
			const deleteButtons = departmentList.querySelectorAll(".btn-delete");

			editButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					editIndex = index;
					editDepartmentName = String(departments[index] || "").trim();
					departmentName.value = departments[index];
					saveDepartmentBtn.textContent = "Simpan Perubahan";
					cancelEditBtn.classList.remove("hidden");
					departmentName.focus();
				});
			});

			deleteButtons.forEach((button) => {
				button.addEventListener("click", async () => {
					departmentError.textContent = "";
					const index = Number(button.dataset.index);
					const selectedDepartment = String(departments[index] || "").trim();
					if (!selectedDepartment) {
						return;
					}

					const deleteResult = await deleteDepartment(selectedDepartment);
					if (!deleteResult.ok) {
						departmentError.textContent = getApiErrorMessage(deleteResult, "Gagal menghapus departemen di backend.");
						return;
					}

					departments.splice(index, 1);
					writeLocalArray(DEPARTMENTS_KEY, departments);

					if (editIndex === index) {
						resetForm();
					}

					renderDepartmentList();
				});
			});
		}

		departmentForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			departmentError.textContent = "";

			await runWithButtonLoading(saveDepartmentBtn, "Menyimpan...", async () => {
				await runWithFormControlsDisabled(departmentForm, async () => {
				const value = departmentName.value.trim();

				if (!value) {
					departmentError.textContent = "Field Departemen wajib diisi.";
					return;
				}

				if (editIndex >= 0) {
					const updateResult = await updateDepartment(editDepartmentName || value, value);
					if (!updateResult.ok) {
						departmentError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui departemen di backend.");
						return;
					}

					departments[editIndex] = value;
					writeLocalArray(DEPARTMENTS_KEY, departments);
				} else {
					const createResult = await createDepartment(value);
					if (!createResult.ok) {
						departmentError.textContent = getApiErrorMessage(createResult, "Gagal menambah departemen ke backend.");
						return;
					}

					departments.push(value);
					writeLocalArray(DEPARTMENTS_KEY, departments);
				}

				resetForm();
				renderDepartmentList();
				});
			});
		});

		cancelEditBtn.addEventListener("click", () => {
			resetForm();
		});

		renderDepartmentList();
	}

	function renderPicContent() {
		if (session.role !== "Super Admin") {
			renderDefaultContent("Daftar PIC");
			return;
		}

		const users = getManagedUsers();
		const picOptions = users
			.map((item) => String(item.namaLengkap || item.username || "").trim())
			.filter((item, index, array) => item && array.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index);

		contentArea.innerHTML = `
			<h2>Daftar PIC</h2>
			<p class="subtitle">Kelola data PIC dari pilihan Daftar User.</p>
			${picOptions.length === 0 ? '<p class="error">Daftar User belum tersedia. Tambahkan user pada menu Daftar User terlebih dahulu.</p>' : ""}
			<form id="picForm" class="form-inline" novalidate>
				<div class="field inline-grow">
					<label for="picName">PIC</label>
					<select id="picName" name="picName" required>
						<option value="">Pilih PIC</option>
						${picOptions.map((name) => `<option value="${name}">${name}</option>`).join("")}
					</select>
				</div>
				<div class="inline-actions">
					<button type="submit" id="savePicBtn" class="btn-primary">Tambah</button>
					<button type="button" id="cancelPicEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="picError" class="error"></p>
			<div id="picList" class="list-wrap"></div>
		`;

		const picForm = document.getElementById("picForm");
		const picName = document.getElementById("picName");
		const savePicBtn = document.getElementById("savePicBtn");
		const cancelPicEditBtn = document.getElementById("cancelPicEditBtn");
		const picError = document.getElementById("picError");
		const picList = document.getElementById("picList");

		let pics = getPics();
		let editIndex = -1;
		let editPicName = "";

		function resetForm() {
			picForm.reset();
			editIndex = -1;
			editPicName = "";
			savePicBtn.textContent = "Tambah";
			cancelPicEditBtn.classList.add("hidden");
			picError.textContent = "";
		}

		function renderPicList() {
			if (pics.length === 0) {
				picList.innerHTML = `<p class="subtitle">Belum ada data PIC.</p>`;
				return;
			}

			const rows = pics
				.map(
					(item, index) => `
						<div class="list-item">
							<span class="list-text">${item}</span>
							<div class="list-actions">
								<button type="button" class="btn-small btn-edit" data-index="${index}">Ubah</button>
								<button type="button" class="btn-small btn-delete" data-index="${index}">Hapus</button>
							</div>
						</div>
					`,
				)
				.join("");

			picList.innerHTML = rows;

			const editButtons = picList.querySelectorAll(".btn-edit");
			const deleteButtons = picList.querySelectorAll(".btn-delete");

			editButtons.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					editIndex = index;
					editPicName = String(pics[index] || "").trim();
					picName.value = pics[index];
					savePicBtn.textContent = "Simpan Perubahan";
					cancelPicEditBtn.classList.remove("hidden");
					picName.focus();
				});
			});

			deleteButtons.forEach((button) => {
				button.addEventListener("click", async () => {
					picError.textContent = "";
					const index = Number(button.dataset.index);
					const selectedPic = String(pics[index] || "").trim();
					if (!selectedPic) {
						return;
					}

					const deleteResult = await deletePic(selectedPic);
					if (!deleteResult.ok) {
						picError.textContent = getApiErrorMessage(deleteResult, "Gagal menghapus PIC di backend.");
						return;
					}

					pics.splice(index, 1);
					writeLocalArray(PICS_KEY, pics);

					if (editIndex === index) {
						resetForm();
					}

					renderPicList();
				});
			});
		}

		picForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			picError.textContent = "";

			await runWithButtonLoading(savePicBtn, "Menyimpan...", async () => {
				await runWithFormControlsDisabled(picForm, async () => {
				const value = picName.value.trim();

				if (!value) {
					picError.textContent = "Field PIC wajib dipilih.";
					return;
				}

				if (editIndex >= 0) {
					const updateResult = await updatePic(editPicName || value, value);
					if (!updateResult.ok) {
						picError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui PIC di backend.");
						return;
					}

					pics[editIndex] = value;
					writeLocalArray(PICS_KEY, pics);
				} else {
					const createResult = await createPic(value);
					if (!createResult.ok) {
						picError.textContent = getApiErrorMessage(createResult, "Gagal menambah PIC ke backend.");
						return;
					}

					pics.push(value);
					writeLocalArray(PICS_KEY, pics);
				}

				resetForm();
				renderPicList();
				});
			});
		});

		cancelPicEditBtn.addEventListener("click", () => {
			resetForm();
		});

		renderPicList();
	}

	function renderTasklistContent() {
		const profile = getReporterProfile(session);
		const sessionUsername = String(session.username || "").trim().toLowerCase();
		const reporterName = String(profile.namaPelapor || "").trim().toLowerCase();
		const loginFullName = String(getUserFullNameFromIdentifier(session.username) || "").trim().toLowerCase();
		const loginMatcher = new Set([sessionUsername, reporterName, loginFullName].filter(Boolean));

		function isOwnedByCurrentLogin(item) {
			const pelapor = String(item.namaPelapor || "").trim().toLowerCase();
			return loginMatcher.has(pelapor);
		}

		function getTaskStatusClass(statusValue) {
			const status = String(statusValue || "").trim().toLowerCase();
			if (status === "open") {
				return "task-status-open";
			}

			if (status === "progress") {
				return "task-status-progress";
			}

			if (status === "close") {
				return "task-status-close";
			}

			return "task-status-default";
		}

		function isOpenOrProgress(statusValue) {
			const status = String(statusValue || "").trim().toLowerCase();
			return status === "open" || status === "progress";
		}

		function isAssignedToCurrentPic(picName) {
			return loginMatcher.has(String(picName || "").trim().toLowerCase());
		}

		function createTaskItem(item, typeLabel, source, sourceIndex, canProcessByPic) {
			const firstPhoto = Array.isArray(item.fotoTemuan) && item.fotoTemuan.length > 0 ? item.fotoTemuan[0] : null;
			return {
				typeLabel,
				source,
				sourceIndex,
				canProcessByPic,
				noId: String(item.noId || "-").trim() || "-",
				tanggalLaporan: String(item.tanggalLaporan || "-").trim() || "-",
				namaPelapor: String(item.namaPelapor || "-").trim() || "-",
				perusahaanPelaporan: String(item.perusahaan || "-").trim() || "-",
				status: String(item.status || "-").trim() || "-",
				thumbnailUrl: firstPhoto && firstPhoto.dataUrl ? String(firstPhoto.dataUrl) : "",
				thumbnailName: firstPhoto && firstPhoto.name ? String(firstPhoto.name) : "Foto Temuan",
			};
		}

		const taskMap = new Map();

		function pushTask(item, typeLabel, source, sourceIndex, canProcessByPic) {
			const key = `${source}-${sourceIndex}`;
			if (!taskMap.has(key)) {
				taskMap.set(key, createTaskItem(item, typeLabel, source, sourceIndex, canProcessByPic));
				return;
			}

			if (canProcessByPic) {
				const current = taskMap.get(key);
				taskMap.set(key, {
					...current,
					canProcessByPic: true,
				});
			}
		}

		getKtaRecords().forEach((item, index) => {
			if (isOwnedByCurrentLogin(item)) {
				pushTask(item, "KTA", "kta", index, false);
			}

			if (isAssignedToCurrentPic(item.namaPic) && isOpenOrProgress(item.status)) {
				pushTask(item, "KTA", "kta", index, true);
			}
		});

		getTtaRecords().forEach((item, index) => {
			if (isOwnedByCurrentLogin(item)) {
				pushTask(item, "TTA", "tta", index, false);
			}

			const assignedPic = item.namaPja || item.namaPic;
			if (isAssignedToCurrentPic(assignedPic) && isOpenOrProgress(item.status)) {
				pushTask(item, "TTA", "tta", index, true);
			}
		});

		const taskItems = Array.from(taskMap.values()).sort((a, b) => b.tanggalLaporan.localeCompare(a.tanggalLaporan));

		contentArea.innerHTML = `
			<h2>Tasklist</h2>
			<p class="subtitle">Notifikasi hasil input KTA dan TTA sesuai login username, termasuk notifikasi ke PIC untuk status Open/Progress.</p>
			<div class="tasklist-grid">
				${
					taskItems.length === 0
						? '<p class="subtitle">Belum ada notifikasi KTA/TTA untuk user login saat ini.</p>'
						: taskItems
								.map(
									(item) => `
										<article class="task-card ${item.canProcessByPic ? "task-card-clickable" : ""}" data-source="${item.source}" data-source-index="${item.sourceIndex}" data-can-process="${item.canProcessByPic ? "1" : "0"}">
											<div class="task-card-head">
												<span class="task-type">${item.typeLabel}</span>
												<span class="task-status ${getTaskStatusClass(item.status)}">${item.status}</span>
											</div>
											<div class="task-thumb-wrap">
												${
													item.thumbnailUrl
														? `<img src="${item.thumbnailUrl}" alt="${item.thumbnailName}" class="task-thumb" />`
														: '<div class="task-thumb task-thumb-empty">Tidak ada foto</div>'
												}
											</div>
											<div class="task-meta">
												<p><strong>No ID:</strong> ${item.noId}</p>
												<p><strong>Tanggal Laporan:</strong> ${item.tanggalLaporan}</p>
												<p><strong>Nama Pelapor:</strong> ${item.namaPelapor}</p>
												<p><strong>Perusahaan Pelaporan:</strong> ${item.perusahaanPelaporan}</p>
												<p><strong>Status:</strong> ${item.status}</p>
												${item.canProcessByPic ? '<p class="task-edit-hint"><strong>Aksi:</strong> Klik card untuk proses tindak lanjut.</p>' : ""}
											</div>
										</article>
									`,
								)
								.join("")
				}
			</div>
			<div id="taskProcessPanel" class="task-process-panel hidden"></div>
		`;

		const taskCards = contentArea.querySelectorAll(".task-card[data-can-process='1']");
		const taskProcessPanel = document.getElementById("taskProcessPanel");

		taskCards.forEach((card) => {
			card.addEventListener("click", () => {
				const source = String(card.dataset.source || "").trim();
				const sourceIndex = Number(card.dataset.sourceIndex);
				if (!source || Number.isNaN(sourceIndex)) {
					return;
				}

				const records = source === "kta" ? getKtaRecords() : getTtaRecords();
				const record = records[sourceIndex];
				if (!record) {
					return;
				}

				taskProcessPanel.classList.remove("hidden");
				taskProcessPanel.innerHTML = `
					<div class="detail-header">
						<h3>Proses ${source.toUpperCase()} - ${record.noId || "-"}</h3>
						<button type="button" class="btn-small" id="closeTaskProcess">Tutup</button>
					</div>
					<form id="taskProcessForm" class="form-grid" novalidate>
						<div class="field field-full">
							<label for="taskTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="taskTindakanPerbaikan" name="tindakanPerbaikan" rows="3" required>${record.tindakanPerbaikan || ""}</textarea>
						</div>
						<div class="field field-full">
							<label for="taskFotoPerbaikan">Foto Perbaikan</label>
							<input id="taskFotoPerbaikan" name="fotoPerbaikan" type="file" accept="image/*" multiple />
						</div>
						<div class="field">
							<label for="taskTanggalPerbaikan">Tanggal Perbaikan</label>
							<input id="taskTanggalPerbaikan" name="tanggalPerbaikan" type="date" value="${record.tanggalPerbaikan || ""}" required />
						</div>
						<div class="field">
							<label for="taskStatus">Status</label>
							<select id="taskStatus" name="status" required>
								<option value="">Pilih Status</option>
								<option value="Open" ${record.status === "Open" ? "selected" : ""}>Open</option>
								<option value="Progress" ${record.status === "Progress" ? "selected" : ""}>Progress</option>
								<option value="Close" ${record.status === "Close" ? "selected" : ""}>Close</option>
							</select>
						</div>
						<div class="inline-actions field-full">
							<button type="submit" class="btn-primary">Simpan Perubahan</button>
						</div>
					</form>
					<p id="taskProcessError" class="error"></p>
					<div id="taskProcessSuccess" class="subtitle"></div>
				`;

				const closeTaskProcess = document.getElementById("closeTaskProcess");
				const taskProcessForm = document.getElementById("taskProcessForm");
				const taskProcessError = document.getElementById("taskProcessError");
				const taskProcessSuccess = document.getElementById("taskProcessSuccess");
				const taskProcessSubmitBtn = taskProcessForm.querySelector('button[type="submit"]');

				closeTaskProcess.addEventListener("click", () => {
					taskProcessPanel.classList.add("hidden");
					taskProcessPanel.innerHTML = "";
				});

				taskProcessForm.addEventListener("submit", async (event) => {
					event.preventDefault();
					taskProcessError.textContent = "";
					taskProcessSuccess.textContent = "";

					await runWithButtonLoading(taskProcessSubmitBtn, "Menyimpan...", async () => {
					await runWithFormControlsDisabled(taskProcessForm, async () => {

					const formData = new FormData(taskProcessForm);
					const tindakanPerbaikan = String(formData.get("tindakanPerbaikan") || "").trim();
					const tanggalPerbaikan = String(formData.get("tanggalPerbaikan") || "").trim();
					const status = String(formData.get("status") || "").trim();
					const fotoPerbaikanFiles = document.getElementById("taskFotoPerbaikan").files || [];

					if (!tindakanPerbaikan || !tanggalPerbaikan || !status) {
						taskProcessError.textContent = "Lengkapi Tindakan Perbaikan, Foto Perbaikan (opsional), Tanggal Perbaikan, dan Status.";
						return;
					}

					if (!["Open", "Progress", "Close"].includes(status)) {
						taskProcessError.textContent = "Status tidak valid.";
						return;
					}

					const recordsNow = source === "kta" ? getKtaRecords() : getTtaRecords();
					const target = recordsNow[sourceIndex];
					if (!target) {
						taskProcessError.textContent = "Data tidak ditemukan.";
						return;
					}

					const newPhotos = await readFilesAsDataUrls(fotoPerbaikanFiles);
					const payload = {
						...target,
						tindakanPerbaikan,
						tanggalPerbaikan,
						status,
						fotoPerbaikan:
							newPhotos.length > 0
								? newPhotos
								: Array.isArray(target.fotoPerbaikan)
									? target.fotoPerbaikan
									: [],
					};

					if (source === "kta") {
						const updateResult = await updateKtaRecord(target.noId, payload);
						if (!updateResult.ok) {
							taskProcessError.textContent = getApiErrorMessage(updateResult, "Gagal menyimpan tindak lanjut KTA.");
							return;
						}
						recordsNow[sourceIndex] = payload;
						writeLocalArray(KTA_KEY, recordsNow);
					} else {
						const updateResult = await updateTtaRecord(target.noId, payload);
						if (!updateResult.ok) {
							taskProcessError.textContent = getApiErrorMessage(updateResult, "Gagal menyimpan tindak lanjut TTA.");
							return;
						}
						recordsNow[sourceIndex] = payload;
						writeLocalArray(TTA_KEY, recordsNow);
					}

					taskProcessSuccess.textContent = "Tindak lanjut berhasil disimpan.";
					renderTasklistContent();
					});
					});
				});
			});
		});
	}

	function handleMenu(menuName) {
		if (menuName === "Achievement") {
			renderAchievementContent();
			return;
		}

		if (menuName === "Tasklist") {
			renderTasklistContent();
			return;
		}

		if (menuName === "KTA") {
			renderKtaContent();
			return;
		}

		if (menuName === "TTA") {
			renderTtaContent();
			return;
		}

		if (menuName === "Daftar User") {
			renderUserContent();
			return;
		}

		if (menuName === "Daftar Departemen") {
			renderDepartmentContent();
			return;
		}

		if (menuName === "Daftar PIC") {
			renderPicContent();
			return;
		}

		renderDefaultContent(menuName);
	}

	sidebarButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const menuName = button.dataset.menu;

			if (menuName === "Logout") {
				clearSession();
				renderApp();
				return;
			}

			sidebarButtons.forEach((item) => item.classList.remove("active"));
			button.classList.add("active");
			handleMenu(menuName);
		});
	});

	const firstNonLogoutButton = Array.from(sidebarButtons).find((button) => button.dataset.menu !== "Logout");
	if (firstNonLogoutButton) {
		firstNonLogoutButton.classList.add("active");
		handleMenu(firstNonLogoutButton.dataset.menu);
	}
}

function renderApp() {
	const session = getSession();

	if (!session) {
		renderLogin();
		return;
	}

	renderDashboard(session);
}

async function startApp() {
	const session = getSession();
	if (session) {
		await hydrateRecordsFromBackend();
	}
	renderApp();
	updateBackendStatus();
	setInterval(updateBackendStatus, 30000);
}

startApp();
