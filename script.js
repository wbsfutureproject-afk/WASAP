const app = document.getElementById("app");
const SESSION_KEY = "she_wbs_session";
const DEPARTMENTS_KEY = "she_wbs_departments";
const PICS_KEY = "she_wbs_pics";
const USER_MASTER_KEY = "she_wbs_user_master";
const LEAVE_SETTINGS_KEY = "she_wbs_leave_settings";
const KTA_KEY = "she_wbs_kta";
const TTA_KEY = "she_wbs_tta";
const KTA_BACKUP_KEY = "she_wbs_kta_backup";
const TTA_BACKUP_KEY = "she_wbs_tta_backup";
const FATIGUE_HISTORY_KEY = "she_wbs_fatigue_history";
const UNITS_KEY = "she_wbs_units";
const LAPORAN_FATIGUE_TENGAH_KEY = "she_wbs_laporan_fatigue_tengah";
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
		"Pengaturan Cuti",
		"Daftar User",
		"Daftar Departemen",
		"Daftar PIC",
		"Daftar Unit",
		"History Fatigue",
		"Laporan Fatigue Tengah Shift",
		"Logout",
	],
	Admin: ["My Profile", "Achievement", "Tasklist", "Pengaturan Cuti", "Daftar User", "Logout"],
	User: ["My Profile", "Achievement", "Tasklist", "Logout"],
};

const FATIGUE_MENU_USERNAMES = ["0236900038"];

function canAccessHistoryFatigue(session) {
	const role = String(session?.role || "").trim();
	if (role === "Super Admin") {
		return true;
	}

	const username = String(session?.username || "").trim();
	return FATIGUE_MENU_USERNAMES.includes(username);
}

function getMenuItemsForSession(session) {
	const baseItems = [...(ROLE_MENUS[session?.role] || [])];
	if (!canAccessHistoryFatigue(session)) {
		return baseItems;
	}

	if (baseItems.includes("History Fatigue")) {
		return baseItems;
	}

	const logoutIndex = baseItems.indexOf("Logout");
	if (logoutIndex === -1) {
		baseItems.push("History Fatigue");
		baseItems.push("Laporan Fatigue Tengah Shift");
		return baseItems;
	}

	baseItems.splice(logoutIndex, 0, "History Fatigue", "Laporan Fatigue Tengah Shift");
	return baseItems;
}

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

function getBackupStorageKey(localStorageKey) {
	if (localStorageKey === KTA_KEY) {
		return KTA_BACKUP_KEY;
	}

	if (localStorageKey === TTA_KEY) {
		return TTA_BACKUP_KEY;
	}

	return "";
}

function readBackupArray(localStorageKey) {
	const backupKey = getBackupStorageKey(localStorageKey);
	if (!backupKey) {
		return [];
	}

	const raw = localStorage.getItem(backupKey);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter((item) => item && Array.isArray(item.records));
	} catch (error) {
		return [];
	}
}

function getLatestBackupRecords(localStorageKey) {
	const backups = readBackupArray(localStorageKey);
	if (backups.length === 0) {
		return [];
	}

	const latest = backups[backups.length - 1];
	return Array.isArray(latest.records) ? latest.records : [];
}

function isQuotaExceededError(error) {
	if (!error) {
		return false;
	}

	if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") {
		return true;
	}

	const message = String(error.message || "").toLowerCase();
	return message.includes("quota") || message.includes("exceeded");
}

function compactRecordForBackup(record) {
	const nextRecord = { ...(record || {}) };

	const compactPhotos = (photos) => {
		if (!Array.isArray(photos)) {
			return [];
		}

		return photos.map((photo) => ({
			name: String(photo?.name || "foto"),
		}));
	};

	nextRecord.fotoTemuan = compactPhotos(nextRecord.fotoTemuan);
	nextRecord.fotoPerbaikan = compactPhotos(nextRecord.fotoPerbaikan);

	return nextRecord;
}

function appendBackupSnapshot(localStorageKey, records) {
	const backupKey = getBackupStorageKey(localStorageKey);
	if (!backupKey) {
		return;
	}

	const normalizedRecords = Array.isArray(records) ? records : [];
	if (normalizedRecords.length === 0) {
		return;
	}

	const backups = readBackupArray(localStorageKey);
	const today = new Date().toISOString().slice(0, 10);
	const nextEntry = {
		date: today,
		timestamp: new Date().toISOString(),
		records: normalizedRecords,
	};

	if (backups.length > 0) {
		const latest = backups[backups.length - 1];
		if (latest?.date === today) {
			backups[backups.length - 1] = nextEntry;
		} else {
			backups.push(nextEntry);
		}
	} else {
		backups.push(nextEntry);
	}

	const limitedBackups = backups.slice(-14);

	try {
		localStorage.setItem(backupKey, JSON.stringify(limitedBackups));
		return;
	} catch (error) {
		if (!isQuotaExceededError(error)) {
			console.warn("[Backup] Gagal menyimpan snapshot:", error);
			return;
		}
	}

	try {
		const compactBackups = limitedBackups
			.slice(-7)
			.map((entry) => ({
				...entry,
				records: Array.isArray(entry.records) ? entry.records.map((item) => compactRecordForBackup(item)) : [],
			}));
		localStorage.setItem(backupKey, JSON.stringify(compactBackups));
		console.warn("[Backup] Quota penuh, backup disimpan dalam mode compact.");
		return;
	} catch (error) {
		if (!isQuotaExceededError(error)) {
			console.warn("[Backup] Gagal menyimpan backup compact:", error);
			return;
		}
	}

	try {
		const latestCompact = {
			date: today,
			timestamp: new Date().toISOString(),
			records: normalizedRecords.map((item) => compactRecordForBackup(item)),
		};
		localStorage.setItem(backupKey, JSON.stringify([latestCompact]));
		console.warn("[Backup] Quota sangat terbatas, hanya snapshot terbaru yang disimpan.");
	} catch (error) {
		console.warn("[Backup] Backup dilewati karena quota storage penuh:", error);
	}
}

function mergeRecordsByNoId(primaryRecords, secondaryRecords) {
	const primary = Array.isArray(primaryRecords) ? primaryRecords : [];
	const secondary = Array.isArray(secondaryRecords) ? secondaryRecords : [];
	const byNoId = new Map();

	primary.forEach((item) => {
		const key = String(item?.noId || "").trim();
		if (key) {
			byNoId.set(key, item);
		}
	});

	secondary.forEach((item) => {
		const key = String(item?.noId || "").trim();
		if (key && !byNoId.has(key)) {
			byNoId.set(key, item);
		}
	});

	return Array.from(byNoId.values());
}

function writeLocalArray(localStorageKey, records) {
	const normalizedRecords = Array.isArray(records) ? records : [];
	localStorage.setItem(localStorageKey, JSON.stringify(normalizedRecords));
	appendBackupSnapshot(localStorageKey, normalizedRecords);
}

async function syncArrayData(endpoint, localStorageKey) {
	const backendRecords = await fetchRecordsFromBackend(endpoint);
	const localRecords = readLocalArray(localStorageKey);

	// Backend tidak tersedia — pertahankan data lokal, coba push jika ada
	if (!Array.isArray(backendRecords)) {
		if (localRecords.length > 0) {
			await pushRecordsToBackend(endpoint, localRecords);
		}
		return;
	}

	// Backend kosong dan lokal kosong — coba pulihkan dari backup lokal
	if (backendRecords.length === 0 && localRecords.length === 0) {
		const latestBackup = getLatestBackupRecords(localStorageKey);
		if (latestBackup.length > 0) {
			writeLocalArray(localStorageKey, latestBackup);
			await pushRecordsToBackend(endpoint, latestBackup);
		}
		return;
	}

	// Backend kosong tapi lokal punya data — push lokal ke backend
	if (backendRecords.length === 0) {
		writeLocalArray(localStorageKey, localRecords);
		await pushRecordsToBackend(endpoint, localRecords);
		return;
	}

	// Merge: backend sebagai sumber utama, tambah record lokal yang tidak ada di backend
	const backendMap = new Map();
	backendRecords.forEach((item) => {
		const key = String(item?.noId || "").trim();
		if (key) {
			backendMap.set(key, item);
		}
	});

	const localOnlyRecords = localRecords.filter((item) => {
		const key = String(item?.noId || "").trim();
		return key && !backendMap.has(key);
	});

	if (localOnlyRecords.length === 0) {
		// Tidak ada record lokal eksklusif — simpan backend ke lokal
		writeLocalArray(localStorageKey, backendRecords);
		return;
	}

	// Ada record lokal yang belum ada di backend — merge dan sync
	const merged = mergeRecordsByNoId(backendRecords, localOnlyRecords);
	writeLocalArray(localStorageKey, merged);
	await pushRecordsToBackend(endpoint, merged);
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
			leaveSettings: Array.isArray(data.leaveSettings) ? data.leaveSettings : [],
			units: Array.isArray(data.units) ? data.units : [],
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
		leaveSettings: readLocalArray(LEAVE_SETTINGS_KEY),
		units: readLocalArray(UNITS_KEY),
	};
}

async function hydrateMasterFromBackend() {
	const backendMaster = await fetchMasterFromBackend();
	const localMaster = getLocalMasterData();
	const hasLocalUnits = localMaster.units.length > 0;
	const hasBackendUnits = Boolean(backendMaster && backendMaster.units.length > 0);

	if (
		backendMaster &&
		(backendMaster.users.length > 0 ||
			backendMaster.departments.length > 0 ||
			backendMaster.pics.length > 0 ||
			backendMaster.leaveSettings.length > 0 ||
			backendMaster.units.length > 0)
	) {
		writeLocalArray(USER_MASTER_KEY, backendMaster.users);
		writeLocalArray(DEPARTMENTS_KEY, backendMaster.departments);
		writeLocalArray(PICS_KEY, backendMaster.pics);
		writeLocalArray(LEAVE_SETTINGS_KEY, backendMaster.leaveSettings);
		writeLocalArray(UNITS_KEY, hasBackendUnits ? backendMaster.units : localMaster.units);

		if (!hasBackendUnits && hasLocalUnits) {
			await pushMasterToBackend({
				users: backendMaster.users,
				departments: backendMaster.departments,
				pics: backendMaster.pics,
				leaveSettings: backendMaster.leaveSettings,
				units: localMaster.units,
			});
		}
		return;
	}

	if (
		localMaster.users.length > 0 ||
		localMaster.departments.length > 0 ||
		localMaster.pics.length > 0 ||
		localMaster.leaveSettings.length > 0 ||
		localMaster.units.length > 0
	) {
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
		leaveSettings: getLeaveSettings(),
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
		leaveSettings: getLeaveSettings(),
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
		leaveSettings: getLeaveSettings(),
	});
}

function normalizeLeaveSettings(rawLeaveSettings) {
	if (!Array.isArray(rawLeaveSettings)) {
		return [];
	}

	const normalizedMap = new Map();

	rawLeaveSettings.forEach((item) => {
		if (!item || typeof item !== "object") {
			return;
		}

		const username = String(item.username || "").trim().toLowerCase();
		if (!username) {
			return;
		}

		const currentDates = normalizedMap.get(username) || new Set();
		const dates = Array.isArray(item.dates) ? item.dates : [];
		dates.forEach((dateValue) => {
			const isoDate = String(dateValue || "").trim();
			if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
				currentDates.add(isoDate);
			}
		});

		normalizedMap.set(username, currentDates);
	});

	return Array.from(normalizedMap.entries())
		.map(([username, dateSet]) => ({
			username,
			dates: Array.from(dateSet).sort((a, b) => a.localeCompare(b)),
		}))
		.filter((item) => item.dates.length > 0)
		.sort((a, b) => a.username.localeCompare(b.username));
}

function getLeaveSettings() {
	const raw = localStorage.getItem(LEAVE_SETTINGS_KEY);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		const normalized = normalizeLeaveSettings(parsed);
		const normalizedRaw = JSON.stringify(normalized);
		if (normalizedRaw !== raw) {
			localStorage.setItem(LEAVE_SETTINGS_KEY, normalizedRaw);
		}
		return normalized;
	} catch (error) {
		localStorage.removeItem(LEAVE_SETTINGS_KEY);
		return [];
	}
}

function setLeaveSettings(leaveSettings) {
	const normalized = normalizeLeaveSettings(leaveSettings);
	localStorage.setItem(LEAVE_SETTINGS_KEY, JSON.stringify(normalized));
	pushMasterToBackend({
		users: getManagedUsers(),
		departments: getDepartments(),
		pics: getPics(),
		leaveSettings: normalized,
	});
}

function getLeaveDatesByUsername(username) {
	const usernameKey = String(username || "").trim().toLowerCase();
	if (!usernameKey) {
		return new Set();
	}

	const leave = getLeaveSettings().find((item) => item.username === usernameKey);
	return new Set(Array.isArray(leave?.dates) ? leave.dates : []);
}

function getDaysInMonth(year, monthNumber) {
	return new Date(year, monthNumber, 0).getDate();
}

function getDaysInYear(year) {
	return new Date(year, 11, 31).getDate();
}

function countLeaveDaysInMonth(leaveDatesSet, year, monthNumber) {
	if (!(leaveDatesSet instanceof Set) || leaveDatesSet.size === 0) {
		return 0;
	}

	const monthText = String(monthNumber).padStart(2, "0");
	const prefix = `${year}-${monthText}-`;
	let count = 0;

	leaveDatesSet.forEach((dateValue) => {
		if (String(dateValue).startsWith(prefix)) {
			count += 1;
		}
	});

	return count;
}

function countLeaveDaysInYear(leaveDatesSet, year) {
	if (!(leaveDatesSet instanceof Set) || leaveDatesSet.size === 0) {
		return 0;
	}

	const prefix = `${year}-`;
	let count = 0;

	leaveDatesSet.forEach((dateValue) => {
		if (String(dateValue).startsWith(prefix)) {
			count += 1;
		}
	});

	return count;
}

function countLeaveDaysInRange(leaveDatesSet, startDate, endDate) {
	if (!(leaveDatesSet instanceof Set) || leaveDatesSet.size === 0) {
		return 0;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ""))) {
		return 0;
	}

	const minDate = startDate <= endDate ? startDate : endDate;
	const maxDate = startDate <= endDate ? endDate : startDate;
	let count = 0;

	leaveDatesSet.forEach((dateValue) => {
		const isoDate = String(dateValue || "");
		if (isoDate >= minDate && isoDate <= maxDate) {
			count += 1;
		}
	});

	return count;
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

			const currentPic = String(nextItem.namaPic || "").trim();
			if (currentPic) {
				const mappedFullName = getUserFullNameFromIdentifier(currentPic);
				if (mappedFullName && mappedFullName !== "-" && mappedFullName !== currentPic) {
					shouldPersistCleanup = true;
					nextItem = {
						...nextItem,
						namaPic: mappedFullName,
					};
				}
			}

			return nextItem;
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

function getFatigueHistoryRecords() {
	const raw = localStorage.getItem(FATIGUE_HISTORY_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		localStorage.removeItem(FATIGUE_HISTORY_KEY);
		return [];
	}
}

function setFatigueHistoryRecords(records) {
	localStorage.setItem(FATIGUE_HISTORY_KEY, JSON.stringify(Array.isArray(records) ? records : []));
}

function getUnits() {
	const raw = localStorage.getItem(UNITS_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		localStorage.removeItem(UNITS_KEY);
		return [];
	}
}

function setUnits(units) {
	const normalizedUnits = Array.isArray(units) ? units : [];
	localStorage.setItem(UNITS_KEY, JSON.stringify(normalizedUnits));
	pushMasterToBackend({
		users: getManagedUsers(),
		departments: getDepartments(),
		pics: getPics(),
		leaveSettings: getLeaveSettings(),
		units: normalizedUnits,
	});
}

function getLaporanFatigueTengah() {
	const raw = localStorage.getItem(LAPORAN_FATIGUE_TENGAH_KEY);
	if (!raw) {
		return [];
	}

	try {
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		localStorage.removeItem(LAPORAN_FATIGUE_TENGAH_KEY);
		return [];
	}
}

function setLaporanFatigueTengah(records) {
	localStorage.setItem(LAPORAN_FATIGUE_TENGAH_KEY, JSON.stringify(Array.isArray(records) ? records : []));
}

function getTodayDate() {
	return new Date().toISOString().slice(0, 10);
}

function getNextRunningNumberByPrefix(records, prefix, month, year) {
	const expectedPrefix = `${prefix} - ${month}/${year} - `;
	const highest = records.reduce((max, item) => {
		const noId = String(item?.noId || "").trim();
		if (!noId.startsWith(expectedPrefix)) {
			return max;
		}

		const runningPart = noId.slice(expectedPrefix.length).trim();
		const value = Number.parseInt(runningPart, 10);
		if (!Number.isFinite(value) || value <= 0) {
			return max;
		}

		return Math.max(max, value);
	}, 0);

	return highest + 1;
}

function createKtaId() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const year = String(now.getFullYear());
	const runningNumber = String(getNextRunningNumberByPrefix(getKtaRecords(), "KTA", month, year)).padStart(4, "0");
	return `KTA - ${month}/${year} - ${runningNumber}`;
}

function createTtaId() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const year = String(now.getFullYear());
	const runningNumber = String(getNextRunningNumberByPrefix(getTtaRecords(), "TTA", month, year)).padStart(4, "0");
	return `TTA - ${month}/${year} - ${runningNumber}`;
}

const IMAGE_COMPRESSION_MAX_DIMENSION = 1600;
const IMAGE_COMPRESSION_TARGET_BYTES = 900 * 1024;
const IMAGE_COMPRESSION_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52];
const IMAGE_COMPRESSION_SCALE_STEPS = [1, 0.85, 0.7, 0.55];

function fileToDataUrl(file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(String(reader.result || ""));
		};
		reader.onerror = () => {
			resolve("");
		};
		reader.readAsDataURL(file);
	});
}

function estimateDataUrlBytes(dataUrl) {
	const payload = String(dataUrl || "");
	const commaIndex = payload.indexOf(",");
	const base64 = commaIndex >= 0 ? payload.slice(commaIndex + 1) : payload;
	const paddingLength = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	return Math.max(0, Math.floor((base64.length * 3) / 4) - paddingLength);
}

function loadImageFromDataUrl(dataUrl) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Gagal memuat gambar untuk kompresi."));
		image.src = dataUrl;
	});
}

async function compressImageFile(file) {
	const originalDataUrl = await fileToDataUrl(file);
	if (!String(file?.type || "").toLowerCase().startsWith("image/") || !originalDataUrl) {
		return {
			name: String(file?.name || "file"),
			dataUrl: originalDataUrl,
		};
	}

	try {
		const image = await loadImageFromDataUrl(originalDataUrl);
		const originalWidth = Number(image.naturalWidth || image.width || 0);
		const originalHeight = Number(image.naturalHeight || image.height || 0);
		if (!originalWidth || !originalHeight) {
			return {
				name: String(file.name || "file"),
				dataUrl: originalDataUrl,
			};
		}

		const baseScale = Math.min(1, IMAGE_COMPRESSION_MAX_DIMENSION / Math.max(originalWidth, originalHeight));
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) {
			return {
				name: String(file.name || "file"),
				dataUrl: originalDataUrl,
			};
		}

		let bestDataUrl = originalDataUrl;
		let bestBytes = estimateDataUrlBytes(originalDataUrl);

		for (const scaleStep of IMAGE_COMPRESSION_SCALE_STEPS) {
			const scale = Math.min(1, baseScale * scaleStep);
			const width = Math.max(1, Math.round(originalWidth * scale));
			const height = Math.max(1, Math.round(originalHeight * scale));

			canvas.width = width;
			canvas.height = height;
			context.clearRect(0, 0, width, height);
			context.drawImage(image, 0, 0, width, height);

			for (const quality of IMAGE_COMPRESSION_QUALITY_STEPS) {
				const candidateDataUrl = canvas.toDataURL("image/jpeg", quality);
				const candidateBytes = estimateDataUrlBytes(candidateDataUrl);
				if (candidateBytes < bestBytes) {
					bestDataUrl = candidateDataUrl;
					bestBytes = candidateBytes;
				}

				if (bestBytes <= IMAGE_COMPRESSION_TARGET_BYTES) {
					break;
				}
			}

			if (bestBytes <= IMAGE_COMPRESSION_TARGET_BYTES) {
				break;
			}
		}

		return {
			name: String(file.name || "file"),
			dataUrl: bestDataUrl,
		};
	} catch (error) {
		return {
			name: String(file.name || "file"),
			dataUrl: originalDataUrl,
		};
	}
}

function readFilesAsDataUrls(fileList) {
	const files = Array.from(fileList || []);
	if (files.length === 0) {
		return Promise.resolve([]);
	}

	const promises = files.map((file) => compressImageFile(file));

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

function getManagedUserByNik(nik) {
	const normalizedNik = String(nik || "").trim();
	if (!normalizedNik) {
		return null;
	}

	return (
		getManagedUsers().find((item) => {
			const userNik = String(item.noKaryawan || item.nik || "").trim();
			return userNik === normalizedNik;
		}) || null
	);
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
	try {
		if (!app) {
			console.error("Login render error: app element not found");
			return;
		}

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

		// Verify elements exist before using them
		const loginForm = document.getElementById("loginForm");
		const usernameInput = document.getElementById("username");
		const passwordInput = document.getElementById("password");
		const errorText = document.getElementById("errorText");

		if (!loginForm) {
			console.error("Login render error: loginForm not found");
			return;
		}

		if (!usernameInput || !passwordInput || !errorText) {
			console.error("Login render error: form elements not found", {
				usernameInput: !!usernameInput,
				passwordInput: !!passwordInput,
				errorText: !!errorText,
			});
			return;
		}

		const loginSubmitButton = loginForm.querySelector('button[type="submit"]');
		if (!loginSubmitButton) {
			console.error("Login render error: submit button not found");
			return;
		}

		if (pendingSessionNotice) {
			errorText.textContent = pendingSessionNotice;
			pendingSessionNotice = "";
		}

		// Handler untuk form submission
		const handleLoginSubmit = async (event) => {
			try {
				if (event) {
					event.preventDefault();
				}
				errorText.textContent = "";
				console.log("[Login] Submit dimulai");

				await runWithButtonLoading(loginSubmitButton, "Login...", async () => {
					try {
						const loginIdentifier = usernameInput.value.trim();
						const password = passwordInput.value.trim();
						console.log("[Login] Identifier:", loginIdentifier);

						if (!loginIdentifier || !password) {
							errorText.textContent = "Username/email dan password harus diisi.";
							console.warn("[Login] Field kosong");
							return;
						}

						console.log("[Login] Resolve account...");
						const account = await resolveLoginAccount(loginIdentifier, password);

						if (!account) {
							errorText.textContent = "Username/email atau password tidak valid.";
							console.error("[Login] Account tidak ditemukan");
							return;
						}

						console.log("[Login] Account found:", account.username, account.role);
						setSession(account);
						console.log("[Login] Session set, mulai hydrate records...");
						
						await hydrateRecordsFromBackend();
						console.log("[Login] Hydrate complete, render app...");
						
						renderApp();
						console.log("[Login] SUCCESS");
					} catch (innerError) {
						console.error("[Login] Error dalam login process:", innerError);
						errorText.textContent = `Login error: ${innerError.message}`;
					}
				});
			} catch (error) {
				console.error("[Login] Outer error:", error);
				errorText.textContent = `Error: ${error.message}`;
			}
		};

		// Attach form submit event
		loginForm.addEventListener("submit", handleLoginSubmit);

		// Fallback: juga attach ke button click untuk memastikan login bekerja
		loginSubmitButton.addEventListener("click", async (event) => {
			event.preventDefault();
			await handleLoginSubmit(event);
		});

		// Allow Enter key to trigger login
		usernameInput.addEventListener("keypress", async (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				await handleLoginSubmit(event);
			}
		});

		passwordInput.addEventListener("keypress", async (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				await handleLoginSubmit(event);
			}
		});
	} catch (error) {
		console.error("renderLogin error:", error);
	}
}

function getTasklistCount(session) {
	const profile = getReporterProfile(session);
	const sessionUsername = String(session.username || "").trim().toLowerCase();
	const reporterName = String(profile.namaPelapor || "").trim().toLowerCase();
	const loginFullName = String(getUserFullNameFromIdentifier(session.username) || "").trim().toLowerCase();
	const loginMatcher = new Set([sessionUsername, reporterName, loginFullName].filter(Boolean));

	function isOwnedByLogin(item) {
		return loginMatcher.has(String(item.namaPelapor || "").trim().toLowerCase());
	}
	function isAssignedAsPic(picName) {
		return loginMatcher.has(String(picName || "").trim().toLowerCase());
	}
	function isOpenOrProgress(statusValue) {
		const s = String(statusValue || "").trim().toLowerCase();
		return s === "open" || s === "progress";
	}

	const keys = new Set();
	getKtaRecords().forEach((item, index) => {
		if (!isOpenOrProgress(item.status)) return;
		if (isOwnedByLogin(item) || isAssignedAsPic(item.namaPic)) {
			keys.add(`kta-${index}`);
		}
	});
	getTtaRecords().forEach((item, index) => {
		if (!isOpenOrProgress(item.status)) return;
		const assignedPic = item.namaPja || item.namaPic;
		if (isOwnedByLogin(item) || isAssignedAsPic(assignedPic)) {
			keys.add(`tta-${index}`);
		}
	});
	return keys.size;
}

function renderDashboard(session) {
	const menuItems = getMenuItemsForSession(session);
	const menuHtml = menuItems
		.map((item) => {
			const isLogout = item === "Logout";
			if (item === "Tasklist") {
				const count = getTasklistCount(session);
				const badge = count > 0 ? `<span class="nav-badge">${count}</span>` : "";
				return `<button type="button" class="sidebar-item" data-menu="${item}">${item}${badge}</button>`;
			}
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

	function getAchievementValidReportDates(records) {
		return records
			.map((item) => String(item.tanggalLaporan || "").trim())
			.filter((reportDate) => /^\d{4}-\d{2}-\d{2}$/.test(reportDate))
			.sort((a, b) => a.localeCompare(b));
	}

	function resolveAchievementActiveDateRange(records, startDate, endDate) {
		const start = String(startDate || "").trim();
		const end = String(endDate || "").trim();
		const validDates = getAchievementValidReportDates(records);

		if (validDates.length === 0) {
			const today = new Date().toISOString().slice(0, 10);
			return {
				start: start || end || today,
				end: end || start || today,
			};
		}

		return {
			start: start || validDates[0],
			end: end || validDates[validDates.length - 1],
		};
	}

	function getAchievementWeekSpan(startDate, endDate) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
			return 1;
		}

		const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
		const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
		const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
		const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
		const diffInDays = Math.floor((endUtc - startUtc) / 86400000) + 1;

		if (diffInDays <= 0) {
			return 1;
		}

		return Math.max(1, Math.ceil(diffInDays / 7));
	}

	function getAchievementDaySpan(startDate, endDate) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
			return 1;
		}

		const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
		const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
		const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
		const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
		const diffInDays = Math.floor((endUtc - startUtc) / 86400000) + 1;

		if (diffInDays <= 0) {
			return 1;
		}

		return diffInDays;
	}

	function getAchievementPercentage(achievement, target) {
		const safeTarget = Number(target) || 0;
		const safeAchievement = Number(achievement) || 0;
		if (safeTarget <= 0) {
			return 0;
		}

		return (safeAchievement / safeTarget) * 100;
	}

	function formatAchievementPercentage(achievement, target) {
		return `${getAchievementPercentage(achievement, target).toFixed(2)}%`;
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

	function isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername) {
		const recordReporterRaw = String(record?.namaPelapor || "").trim();
		const recordReporterFullName = String(getUserFullNameFromIdentifier(recordReporterRaw) || "")
			.trim()
			.toLowerCase();
		const recordReporter = recordReporterRaw.toLowerCase();

		return (
			recordReporter === normalizedReporterName ||
			recordReporter === normalizedUsername ||
			recordReporterFullName === normalizedReporterName ||
			recordReporterFullName === normalizedUsername
		);
	}

	function getKtaTargetMultiplierByJobGroup(jobGroup) {
		const normalizedGroup = normalizeJobGroup(jobGroup);

		if (normalizedGroup === "OPERATOR") {
			return 1;
		}

		if (normalizedGroup === "PENGAWAS") {
			return 1;
		}

		if (normalizedGroup === "LEVEL 1 MGT") {
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
		const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
		const daysInCurrentYear = getDaysInYear(currentYear);

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const targetMultiplier = getKtaTargetMultiplierByJobGroup(normalizedGroup);
				const leaveDatesSet = getLeaveDatesByUsername(username);
				const activeMonthDays = Math.max(0, daysInCurrentMonth - countLeaveDaysInMonth(leaveDatesSet, currentYear, currentMonth));
				const activeYearDays = Math.max(0, daysInCurrentYear - countLeaveDaysInYear(leaveDatesSet, currentYear));

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

				const monthlyTarget = targetMultiplier * activeMonthDays;
				const yearlyTarget = targetMultiplier > 0 ? targetMultiplier * activeYearDays : 0;

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

	function getTtaTargetByJobGroup(jobGroup, daysInCurrentMonth, daysInCurrentYear = 365) {
		const normalizedGroup = normalizeJobGroup(jobGroup);
		if (normalizedGroup === "PENGAWAS") {
			return {
				monthlyTarget: 2 * daysInCurrentMonth,
				yearlyTarget: 2 * daysInCurrentYear,
			};
		}

		if (normalizedGroup === "LEVEL 1 MGT") {
			return {
				monthlyTarget: 2 * daysInCurrentMonth,
				yearlyTarget: 2 * daysInCurrentYear,
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
		const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
		const daysInCurrentYear = getDaysInYear(currentYear);

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const leaveDatesSet = getLeaveDatesByUsername(username);
				const activeMonthDays = Math.max(0, daysInCurrentMonth - countLeaveDaysInMonth(leaveDatesSet, currentYear, currentMonth));
				const activeYearDays = Math.max(0, daysInCurrentYear - countLeaveDaysInYear(leaveDatesSet, currentYear));
				const targets = getTtaTargetByJobGroup(normalizedGroup, activeMonthDays, activeYearDays);

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

	function renderOperatorCombinedPerformanceTable(ktaRecords, ttaRecords, startDate, endDate) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung target gabungan KTA/TTA per pelapor.</p>';
		}

		const combinedRecords = [...ktaRecords, ...ttaRecords];
		const activeRange = resolveAchievementActiveDateRange(combinedRecords, startDate, endDate);
		const activeDayCount = getAchievementDaySpan(activeRange.start, activeRange.end);
		const weeklyTarget = 1;

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const leaveDatesSet = getLeaveDatesByUsername(username);
				const leaveDaysInRange = countLeaveDaysInRange(leaveDatesSet, activeRange.start, activeRange.end);
				const activeDaysWithoutLeave = Math.max(0, activeDayCount - leaveDaysInRange);
				const activeRangeTarget = Math.ceil((weeklyTarget * activeDaysWithoutLeave) / 7);

				let activeRangeAchievement = 0;

				combinedRecords.forEach((record) => {
					if (!isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername)) {
						return;
					}

					activeRangeAchievement += 1;
				});

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					weeklyTarget,
					activeRangeTarget,
					activeRangeAchievement,
					achievementPercentage: getAchievementPercentage(activeRangeAchievement, activeRangeTarget),
					isAchieved: activeRangeAchievement >= activeRangeTarget,
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
						<td>${item.activeRangeTarget}</td>
						<td>${item.activeRangeAchievement}</td>
						<td>${item.achievementPercentage.toFixed(2)}%</td>
						<td><span class="task-status ${item.isAchieved ? "task-status-close" : "task-status-open"}">${item.isAchieved ? "Tercapai" : "Tidak Tercapai"}</span></td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.activeRangeTarget += item.activeRangeTarget;
				accumulator.activeRangeAchievement += item.activeRangeAchievement;
				return accumulator;
			},
			{ activeRangeTarget: 0, activeRangeAchievement: 0 },
		);

		const totalStatus = totals.activeRangeAchievement >= totals.activeRangeTarget ? "Tercapai" : "Tidak Tercapai";
		const totalStatusClass = totals.activeRangeAchievement >= totals.activeRangeTarget ? "task-status-close" : "task-status-open";

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Target KTA / TTA (Date Range Aktif)</th>
						<th>Pencapaian Date Range Aktif</th>
						<th>% Pencapaian</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>${totals.activeRangeTarget}</th>
						<th>${totals.activeRangeAchievement}</th>
						<th>${formatAchievementPercentage(totals.activeRangeAchievement, totals.activeRangeTarget)}</th>
						<th><span class="task-status ${totalStatusClass}">${totalStatus}</span></th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderJobGroupShortageTable(ktaRecords, ttaRecords, startDate, endDate) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung kekurangan target per kelompok jabatan.</p>';
		}

		const combinedRecords = [...ktaRecords, ...ttaRecords];
		const activeRange = resolveAchievementActiveDateRange(combinedRecords, startDate, endDate);
		const activeDayCount = getAchievementDaySpan(activeRange.start, activeRange.end);

		const groupOrder = ["OPERATOR", "PENGAWAS", "LEVEL 1 MGT"];
		const groupTargetBasis = {
			OPERATOR: "1 / minggu (gabungan KTA+TTA)",
			PENGAWAS: "KTA 1 + TTA 2 / hari",
			"LEVEL 1 MGT": "KTA 1 + TTA 2 / hari",
		};

		const grouped = new Map(groupOrder.map((group) => [group, { group, personCount: 0, target: 0, achievement: 0 }]));

		users.forEach((user) => {
			const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
			if (!grouped.has(normalizedGroup)) {
				return;
			}

			const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
			const username = String(user.username || "").trim();
			const normalizedReporterName = reporterName.toLowerCase();
			const normalizedUsername = username.toLowerCase();
			const leaveDatesSet = getLeaveDatesByUsername(username);
			const leaveDaysInRange = countLeaveDaysInRange(leaveDatesSet, activeRange.start, activeRange.end);
			const activeDaysWithoutLeave = Math.max(0, activeDayCount - leaveDaysInRange);

			const ktaAchievement = ktaRecords.reduce(
				(accumulator, record) =>
					accumulator + (isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername) ? 1 : 0),
				0,
			);
			const ttaAchievement = ttaRecords.reduce(
				(accumulator, record) =>
					accumulator + (isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername) ? 1 : 0),
				0,
			);

			const perUserTarget = normalizedGroup === "OPERATOR" ? Math.ceil(activeDaysWithoutLeave / 7) : 3 * activeDaysWithoutLeave;

			const groupData = grouped.get(normalizedGroup);
			groupData.personCount += 1;
			groupData.target += perUserTarget;
			groupData.achievement += ktaAchievement + ttaAchievement;
		});

		const rows = groupOrder
			.map((group) => {
				const item = grouped.get(group);
				const shortage = Math.max(0, item.target - item.achievement);
				const isAchieved = item.achievement >= item.target;

				return {
					...item,
					targetBasis: groupTargetBasis[group],
					shortage,
					isAchieved,
				};
			})
			.filter((item) => item.personCount > 0);

		if (rows.length === 0) {
			return '<p class="subtitle">Tidak ada data user pada kelompok jabatan target (OPERATOR, PENGAWAS, LEVEL 1 MGT).</p>';
		}

		const rowHtml = rows
			.map(
				(item) => `
					<tr>
						<td>${escapeAchievementHtml(item.group)}</td>
						<td>${item.personCount}</td>
						<td>${escapeAchievementHtml(item.targetBasis)}</td>
						<td>${item.target}</td>
						<td>${item.achievement}</td>
						<td>${item.shortage}</td>
						<td>${formatAchievementPercentage(item.achievement, item.target)}</td>
						<td><span class="task-status ${item.isAchieved ? "task-status-close" : "task-status-open"}">${item.isAchieved ? "Tercapai" : "Tidak Tercapai"}</span></td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.personCount += item.personCount;
				accumulator.target += item.target;
				accumulator.achievement += item.achievement;
				accumulator.shortage += item.shortage;
				return accumulator;
			},
			{ personCount: 0, target: 0, achievement: 0, shortage: 0 },
		);

		const totalAchieved = totals.achievement >= totals.target;

		return `
			<table class="data-table">
				<thead>
					<tr>
						<th>Kelompok Jabatan</th>
						<th>Jumlah Personel</th>
						<th>Dasar Target</th>
						<th>Target Date Range Aktif</th>
						<th>Pencapaian KTA / TTA</th>
						<th>Kekurangan</th>
						<th>% Pencapaian</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>${totals.personCount}</th>
						<th>-</th>
						<th>${totals.target}</th>
						<th>${totals.achievement}</th>
						<th>${totals.shortage}</th>
						<th>${formatAchievementPercentage(totals.achievement, totals.target)}</th>
						<th><span class="task-status ${totalAchieved ? "task-status-close" : "task-status-open"}">${
							totalAchieved ? "Tercapai" : "Tidak Tercapai"
						}</span></th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderKtaReporterDateRangeAchievementTable(records, startDate, endDate) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung pencapaian KTA berdasarkan rentang tanggal.</p>';
		}

		const activeRange = resolveAchievementActiveDateRange(records, startDate, endDate);
		const activeDayCount = getAchievementDaySpan(activeRange.start, activeRange.end);

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const leaveDatesSet = getLeaveDatesByUsername(username);
				const leaveDaysInRange = countLeaveDaysInRange(leaveDatesSet, activeRange.start, activeRange.end);
				const activeDaysWithoutLeave = Math.max(0, activeDayCount - leaveDaysInRange);

				let achievementCount = 0;

				records.forEach((record) => {
					const reportDate = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
						return;
					}

					if (!isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername)) {
						return;
					}

					achievementCount += 1;
				});

				const targetCount = getKtaTargetMultiplierByJobGroup(normalizedGroup) * activeDaysWithoutLeave;
				const shortage = Math.max(0, targetCount - achievementCount);
				const isAchieved = achievementCount >= targetCount;

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					department: String(user.departemen || "-").trim() || "-",
					targetCount,
					achievementCount,
					shortage,
					isAchieved,
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
						<td class="${item.isAchieved ? "" : "reporter-low-achievement"}">${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${escapeAchievementHtml(item.department)}</td>
						<td>${item.targetCount}</td>
						<td>${item.achievementCount}</td>
						<td>${item.shortage}</td>
						<td>${formatAchievementPercentage(item.achievementCount, item.targetCount)}</td>
						<td><span class="task-status ${item.isAchieved ? "task-status-close" : "task-status-open"}">${item.isAchieved ? "Tercapai" : "Tidak Tercapai"}</span></td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.targetCount += item.targetCount;
				accumulator.achievementCount += item.achievementCount;
				accumulator.shortage += item.shortage;
				return accumulator;
			},
			{ targetCount: 0, achievementCount: 0, shortage: 0 },
		);
		const totalStatus = totals.achievementCount >= totals.targetCount ? "Tercapai" : "Tidak Tercapai";
		const totalStatusClass = totals.achievementCount >= totals.targetCount ? "task-status-close" : "task-status-open";

		return `
			<table class="data-table" id="ktaReporterDateRangeTable">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Departemen</th>
						<th>Target KTA (Date Range Aktif)</th>
						<th>Pencapaian KTA (Date Range Aktif)</th>
						<th>Kekurangan</th>
						<th>% Pencapaian</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>-</th>
						<th>${totals.targetCount}</th>
						<th>${totals.achievementCount}</th>
						<th>${totals.shortage}</th>
						<th>${formatAchievementPercentage(totals.achievementCount, totals.targetCount)}</th>
						<th><span class="task-status ${totalStatusClass}">${totalStatus}</span></th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderTtaReporterDateRangeAchievementTable(records, startDate, endDate) {
		const users = getManagedUsers();
		if (users.length === 0) {
			return '<p class="subtitle">Daftar User belum tersedia untuk menghitung pencapaian TTA berdasarkan rentang tanggal.</p>';
		}

		const activeRange = resolveAchievementActiveDateRange(records, startDate, endDate);
		const activeDayCount = getAchievementDaySpan(activeRange.start, activeRange.end);

		const rows = users
			.map((user) => {
				const reporterName = String(user.namaLengkap || user.username || "-").trim() || "-";
				const username = String(user.username || "").trim();
				const normalizedReporterName = reporterName.toLowerCase();
				const normalizedUsername = username.toLowerCase();
				const normalizedGroup = normalizeJobGroup(user.kelompokJabatan);
				const leaveDatesSet = getLeaveDatesByUsername(username);
				const leaveDaysInRange = countLeaveDaysInRange(leaveDatesSet, activeRange.start, activeRange.end);
				const activeDaysWithoutLeave = Math.max(0, activeDayCount - leaveDaysInRange);

				let achievementCount = 0;

				records.forEach((record) => {
					const reportDate = String(record.tanggalLaporan || "").trim();
					if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
						return;
					}

					if (!isRecordOwnedByReporter(record, normalizedReporterName, normalizedUsername)) {
						return;
					}

					achievementCount += 1;
				});

				const targetCount = getTtaTargetByJobGroup(normalizedGroup, activeDaysWithoutLeave, activeDaysWithoutLeave).monthlyTarget;
				const shortage = Math.max(0, targetCount - achievementCount);
				const isAchieved = achievementCount >= targetCount;

				return {
					reporterName,
					jobGroup: normalizedGroup || "-",
					department: String(user.departemen || "-").trim() || "-",
					targetCount,
					achievementCount,
					shortage,
					isAchieved,
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
						<td class="${item.isAchieved ? "" : "reporter-low-achievement"}">${escapeAchievementHtml(item.reporterName)}</td>
						<td>${escapeAchievementHtml(item.jobGroup)}</td>
						<td>${escapeAchievementHtml(item.department)}</td>
						<td>${item.targetCount}</td>
						<td>${item.achievementCount}</td>
						<td>${item.shortage}</td>
						<td>${formatAchievementPercentage(item.achievementCount, item.targetCount)}</td>
						<td><span class="task-status ${item.isAchieved ? "task-status-close" : "task-status-open"}">${item.isAchieved ? "Tercapai" : "Tidak Tercapai"}</span></td>
					</tr>
				`,
			)
			.join("");

		const totals = rows.reduce(
			(accumulator, item) => {
				accumulator.targetCount += item.targetCount;
				accumulator.achievementCount += item.achievementCount;
				accumulator.shortage += item.shortage;
				return accumulator;
			},
			{ targetCount: 0, achievementCount: 0, shortage: 0 },
		);
		const totalStatus = totals.achievementCount >= totals.targetCount ? "Tercapai" : "Tidak Tercapai";
		const totalStatusClass = totals.achievementCount >= totals.targetCount ? "task-status-close" : "task-status-open";

		return `
			<table class="data-table" id="ttaReporterDateRangeTable">
				<thead>
					<tr>
						<th>Nama Pelapor</th>
						<th>Kelompok Jabatan</th>
						<th>Departemen</th>
						<th>Target TTA (Date Range Aktif)</th>
						<th>Pencapaian TTA (Date Range Aktif)</th>
						<th>Kekurangan</th>
						<th>% Pencapaian</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${rowHtml}</tbody>
				<tfoot>
					<tr>
						<th>Total</th>
						<th>-</th>
						<th>-</th>
						<th>${totals.targetCount}</th>
						<th>${totals.achievementCount}</th>
						<th>${totals.shortage}</th>
						<th>${formatAchievementPercentage(totals.achievementCount, totals.targetCount)}</th>
						<th><span class="task-status ${totalStatusClass}">${totalStatus}</span></th>
					</tr>
				</tfoot>
			</table>
		`;
	}

	function renderUserAchievementContent() {
		const profile = getReporterProfile(session);
		const reporterName = String(profile.namaPelapor || "").trim().toLowerCase();
		const username = String(session.username || "").trim().toLowerCase();
		let selectedMonthKey = "";

		const ownKtaRecords = getKtaRecords().filter((record) => isRecordOwnedByReporter(record, reporterName, username));
		const ownTtaRecords = getTtaRecords().filter((record) => isRecordOwnedByReporter(record, reporterName, username));

		function applyUserMonthFilter(records) {
			if (!selectedMonthKey) {
				return records;
			}

			return records.filter((record) => toMonthKey(record.tanggalLaporan) === selectedMonthKey);
		}

		function renderUserAchievementView() {
			const ktaRecords = applyUserMonthFilter(ownKtaRecords);
			const ttaRecords = applyUserMonthFilter(ownTtaRecords);
			const ktaSummary = getAchievementStatusSummary(ktaRecords);
			const ttaSummary = getAchievementStatusSummary(ttaRecords);
			const activeMonthText = selectedMonthKey ? getAchievementMonthLabel(selectedMonthKey) : "Semua Bulan";

			contentArea.innerHTML = `
				<h2>Achievement</h2>
				<p class="subtitle">Dashboard pencapaian bulanan KTA dan TTA milik user login, dengan detail status Open, Progress, dan Close.</p>
				<div class="form-grid" id="userAchievementMonthFilter">
					<div class="field">
						<label for="userAchievementMonth">Pilih Bulan</label>
						<input id="userAchievementMonth" type="month" value="${selectedMonthKey}" />
					</div>
					<div class="inline-actions field-full">
						<button type="button" class="btn-small btn-edit" id="userAchievementApplyMonth">Terapkan Bulan</button>
						<button type="button" class="btn-small" id="userAchievementResetMonth">Reset Bulan</button>
					</div>
				</div>
				<div class="achievement-filter-info">
					<p><strong>Bulan Aktif:</strong> ${escapeAchievementHtml(activeMonthText)}</p>
				</div>
				<div class="achievement-legend">
					<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-open"></span>Open</span>
					<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-progress"></span>Progress</span>
					<span class="achievement-legend-item"><span class="achievement-legend-dot achievement-close"></span>Close</span>
				</div>
				<section class="achievement-section">
					<h3>Ringkasan Status KTA</h3>
					<div class="achievement-stat-grid">
						<div class="achievement-stat-card"><h4>Open</h4><p>${ktaSummary.openCount}</p></div>
						<div class="achievement-stat-card"><h4>Progress</h4><p>${ktaSummary.progressCount}</p></div>
						<div class="achievement-stat-card"><h4>Close</h4><p>${ktaSummary.closeCount}</p></div>
						<div class="achievement-stat-card"><h4>Total KTA</h4><p>${ktaSummary.totalCount}</p></div>
					</div>
				</section>
				${renderAchievementChart("Grafik Bulanan KTA", ktaRecords)}
				<section class="achievement-section">
					<h3>Ringkasan Status TTA</h3>
					<div class="achievement-stat-grid">
						<div class="achievement-stat-card"><h4>Open</h4><p>${ttaSummary.openCount}</p></div>
						<div class="achievement-stat-card"><h4>Progress</h4><p>${ttaSummary.progressCount}</p></div>
						<div class="achievement-stat-card"><h4>Close</h4><p>${ttaSummary.closeCount}</p></div>
						<div class="achievement-stat-card"><h4>Total TTA</h4><p>${ttaSummary.totalCount}</p></div>
					</div>
				</section>
				${renderAchievementChart("Grafik Bulanan TTA", ttaRecords)}
			`;

			const userAchievementMonth = document.getElementById("userAchievementMonth");
			const userAchievementApplyMonth = document.getElementById("userAchievementApplyMonth");
			const userAchievementResetMonth = document.getElementById("userAchievementResetMonth");

			userAchievementApplyMonth.addEventListener("click", () => {
				selectedMonthKey = String(userAchievementMonth.value || "").trim();
				renderUserAchievementView();
			});

			userAchievementResetMonth.addEventListener("click", () => {
				selectedMonthKey = "";
				renderUserAchievementView();
			});
		}

		renderUserAchievementView();
	}

	function renderAchievementContent() {
		if (session.role === "User") {
			renderUserAchievementContent();
			return;
		}

		let activeDashboard = "KTA";
		let activeKtaFilter = null;
		let activeTtaFilter = null;
		let activeKtaStatusFilter = null;
		let activeTtaStatusFilter = null;
		let dateRangeStart = "";
		let dateRangeEnd = "";

		function buildAchievementExportFileName(type) {
			const startPart = dateRangeStart || "all";
			const endPart = dateRangeEnd || "all";
			return `pencapaian_${type.toLowerCase()}_${startPart}_sd_${endPart}.xlsx`;
		}

		function downloadAchievementTableAsXlsx(tableId, fileName) {
			if (typeof XLSX === "undefined") {
				window.alert("Library Excel belum termuat. Silakan refresh halaman dan coba lagi.");
				return;
			}

			const table = document.getElementById(tableId);
			if (!table) {
				window.alert("Tabel tidak ditemukan untuk di-download.");
				return;
			}

			const workbook = XLSX.utils.table_to_book(table, { sheet: "Pencapaian" });
			XLSX.writeFile(workbook, fileName);
		}

		function renderAdminAchievementView() {
			const allKtaRecords = getKtaRecords();
			const allTtaRecords = getTtaRecords();
			const rangedKtaRecords = applyAchievementDateRange(allKtaRecords, dateRangeStart, dateRangeEnd);
			const rangedTtaRecords = applyAchievementDateRange(allTtaRecords, dateRangeStart, dateRangeEnd);
			const filteredKtaRecords = applyAchievementFilter(rangedKtaRecords, activeKtaFilter);
			const filteredTtaRecords = applyAchievementFilter(rangedTtaRecords, activeTtaFilter);
			const ktaRecords = activeKtaStatusFilter
				? filteredKtaRecords.filter((r) => r.status === activeKtaStatusFilter)
				: filteredKtaRecords;
			const ttaRecords = activeTtaStatusFilter
				? filteredTtaRecords.filter((r) => r.status === activeTtaStatusFilter)
				: filteredTtaRecords;

			const ktaSummary = getAchievementStatusSummary(filteredKtaRecords);
			const ttaSummary = getAchievementStatusSummary(filteredTtaRecords);

			const activeFilter = activeDashboard === "KTA" ? activeKtaFilter : activeTtaFilter;
			const activeStatusFilter = activeDashboard === "KTA" ? activeKtaStatusFilter : activeTtaStatusFilter;
			const activeFilterText = activeFilter
				? `${getAchievementDimensionLabel(activeFilter.dimension)}: ${activeFilter.value}`
				: "Tanpa filter";
			const statusFilterText = activeStatusFilter ? activeStatusFilter : "Semua status";
			const dateFilterText = dateRangeStart || dateRangeEnd ? `${dateRangeStart || "-"} s.d. ${dateRangeEnd || "-"}` : "Semua tanggal";

			const ktaDashboardHtml = `
				<div class="achievement-stat-grid">
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeKtaStatusFilter === "Open" ? "active" : ""}" data-status-dashboard="KTA" data-status="Open"><h4>Open</h4><p>${ktaSummary.openCount}</p></button>
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeKtaStatusFilter === "Progress" ? "active" : ""}" data-status-dashboard="KTA" data-status="Progress"><h4>Progress</h4><p>${ktaSummary.progressCount}</p></button>
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeKtaStatusFilter === "Close" ? "active" : ""}" data-status-dashboard="KTA" data-status="Close"><h4>Close</h4><p>${ktaSummary.closeCount}</p></button>
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
				<section class="achievement-section">
					<h3>Target dan Pencapaian Gabungan KTA / TTA (OPERATOR)</h3>
					<p class="subtitle">Menampilkan Kelompok Jabatan OPERATOR dengan target 1 per minggu. Total target otomatis mengikuti date range aktif.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderOperatorCombinedPerformanceTable(rangedKtaRecords, rangedTtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
				<section class="achievement-section">
					<h3>Jumlah Kekurangan Pembuatan KTA / TTA per Kelompok Jabatan</h3>
					<p class="subtitle">Menampilkan target, pencapaian, persentase, dan jumlah kekurangan berdasarkan date range aktif untuk OPERATOR, PENGAWAS, dan LEVEL 1 MGT.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderJobGroupShortageTable(rangedKtaRecords, rangedTtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
				<section class="achievement-section">
					<h3>Pencapaian Pembuatan KTA per Pelapor (Date Range)</h3>
					<p class="subtitle">Menampilkan target, pencapaian, persentase, dan status Kelompok Jabatan PENGAWAS dan LEVEL 1 MGT pada Dashboard KTA berdasarkan date range aktif.</p>
					<div class="inline-actions">
						<button type="button" class="btn-small btn-edit" id="downloadKtaAchievementXlsx">Download Excel (.xlsx)</button>
					</div>
					<div class="table-wrap kta-performance-table-wrap">
						${renderKtaReporterDateRangeAchievementTable(rangedKtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
			`;

			const ttaDashboardHtml = `
				<div class="achievement-stat-grid">
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeTtaStatusFilter === "Open" ? "active" : ""}" data-status-dashboard="TTA" data-status="Open"><h4>Open</h4><p>${ttaSummary.openCount}</p></button>
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeTtaStatusFilter === "Progress" ? "active" : ""}" data-status-dashboard="TTA" data-status="Progress"><h4>Progress</h4><p>${ttaSummary.progressCount}</p></button>
					<button type="button" class="achievement-stat-card achievement-stat-clickable ${activeTtaStatusFilter === "Close" ? "active" : ""}" data-status-dashboard="TTA" data-status="Close"><h4>Close</h4><p>${ttaSummary.closeCount}</p></button>
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
				<section class="achievement-section">
					<h3>Target dan Pencapaian Gabungan KTA / TTA (OPERATOR)</h3>
					<p class="subtitle">Menampilkan Kelompok Jabatan OPERATOR dengan target 1 per minggu. Total target otomatis mengikuti date range aktif.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderOperatorCombinedPerformanceTable(rangedKtaRecords, rangedTtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
				<section class="achievement-section">
					<h3>Jumlah Kekurangan Pembuatan KTA / TTA per Kelompok Jabatan</h3>
					<p class="subtitle">Menampilkan target, pencapaian, persentase, dan jumlah kekurangan berdasarkan date range aktif untuk OPERATOR, PENGAWAS, dan LEVEL 1 MGT.</p>
					<div class="table-wrap kta-performance-table-wrap">
						${renderJobGroupShortageTable(rangedKtaRecords, rangedTtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
				<section class="achievement-section">
					<h3>Pencapaian Pembuatan TTA per Pelapor (Date Range)</h3>
					<p class="subtitle">Menampilkan target, pencapaian, persentase, dan status Kelompok Jabatan PENGAWAS dan LEVEL 1 MGT pada Dashboard TTA berdasarkan date range aktif.</p>
					<div class="inline-actions">
						<button type="button" class="btn-small btn-edit" id="downloadTtaAchievementXlsx">Download Excel (.xlsx)</button>
					</div>
					<div class="table-wrap kta-performance-table-wrap">
						${renderTtaReporterDateRangeAchievementTable(rangedTtaRecords, dateRangeStart, dateRangeEnd)}
					</div>
				</section>
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
					<p><strong>Filter Status:</strong> ${escapeAchievementHtml(statusFilterText)}</p>
					<p><strong>Rentang Tanggal:</strong> ${escapeAchievementHtml(dateFilterText)}</p>
					<button type="button" class="btn-small" id="achievementResetFilter">Reset Filter</button>
				</div>
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
					activeKtaStatusFilter = null;
				} else {
					activeTtaFilter = null;
					activeTtaStatusFilter = null;
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

			const statusCards = contentArea.querySelectorAll("[data-status]");
			statusCards.forEach((card) => {
				card.addEventListener("click", () => {
					const dashboard = card.dataset.statusDashboard;
					const status = card.dataset.status;
					if (dashboard === "KTA") {
						activeKtaStatusFilter = activeKtaStatusFilter === status ? null : status;
					} else {
						activeTtaStatusFilter = activeTtaStatusFilter === status ? null : status;
					}
					renderAdminAchievementView();
				});
			});

			const downloadKtaAchievementXlsx = document.getElementById("downloadKtaAchievementXlsx");
			if (downloadKtaAchievementXlsx) {
				downloadKtaAchievementXlsx.addEventListener("click", () => {
					downloadAchievementTableAsXlsx("ktaReporterDateRangeTable", buildAchievementExportFileName("KTA"));
				});
			}

			const downloadTtaAchievementXlsx = document.getElementById("downloadTtaAchievementXlsx");
			if (downloadTtaAchievementXlsx) {
				downloadTtaAchievementXlsx.addEventListener("click", () => {
					downloadAchievementTableAsXlsx("ttaReporterDateRangeTable", buildAchievementExportFileName("TTA"));
				});
			}

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
				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Informasi Pelapor</h3>
						<p class="form-section-note">Data ini diisi otomatis dari akun yang sedang login.</p>
					</div>
					<div class="form-section-grid form-grid">
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
					</div>
				</section>

				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Detail Temuan</h3>
						<p class="form-section-note">Lengkapi informasi lokasi, kategori, dan deskripsi temuan.</p>
					</div>
					<div class="form-section-grid form-grid">
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
							<label for="ktaFotoTemuan">Foto Temuan (Opsional)</label>
							<input id="ktaFotoTemuan" name="fotoTemuan" type="file" accept="image/*" multiple />
						</div>
					</div>
				</section>

				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Tindak Lanjut</h3>
						<p class="form-section-note">Isi perbaikan langsung, tindak lanjut, dan status penyelesaian.</p>
					</div>
					<div class="form-section-grid form-grid">
						<div class="field">
							<label for="ktaPerbaikanLangsung">Perbaikan Langsung</label>
							<select id="ktaPerbaikanLangsung" name="perbaikanLangsung" required>
								<option value="">Pilih</option>
								<option value="Ya">Ya</option>
								<option value="Tidak">Tidak</option>
							</select>
						</div>
					</div>
				</section>

				<div id="directFixSection" class="form-section field-full hidden">
					<div class="form-section-header">
						<h3 class="form-section-title">Detail Perbaikan</h3>
						<p class="form-section-note">Bagian ini muncul saat perbaikan langsung dilakukan.</p>
					</div>
					<div class="form-section-grid form-grid">
						<div class="field field-full">
							<label for="ktaTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="ktaTindakanPerbaikan" name="tindakanPerbaikan" rows="3"></textarea>
						</div>
						<div class="field field-full">
							<label for="ktaFotoPerbaikan">Foto Perbaikan (Opsional)</label>
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
			${isSuperAdmin
				? `<div class="form-grid" id="ktaBulkDeletePanel">
					<div class="field field-full">
						<label for="ktaBulkDeleteIds">Hapus Massal KTA (No ID)</label>
						<textarea id="ktaBulkDeleteIds" rows="2" placeholder="Contoh: KTA - 02/2026 - 0001, KTA - 02/2026 - 0002"></textarea>
					</div>
					<div class="inline-actions field-full">
						<button type="button" id="ktaBulkDeleteBtn" class="btn-delete">Hapus Sesuai No ID</button>
					</div>
					<div class="field field-full">
						<label>Pemulihan Backup</label>
						<p class="subtitle">Pulihkan snapshot backup lokal terbaru untuk KTA/TTA lalu sinkron ke backend.</p>
					</div>
					<div class="inline-actions field-full">
						<button type="button" id="restoreKtaBackupBtn" class="btn-secondary">Restore Backup KTA</button>
						<button type="button" id="restoreTtaBackupBtn" class="btn-secondary">Restore Backup TTA</button>
					</div>
				</div>`
				: ""}
			<div id="ktaHistory" class="table-wrap"></div>
			<div id="ktaDetailPanel" class="detail-panel hidden"></div>
		`;

		const ktaForm = document.getElementById("ktaForm");
		const perbaikanLangsung = document.getElementById("ktaPerbaikanLangsung");
		const directFixSection = document.getElementById("directFixSection");
		const tindakanPerbaikan = document.getElementById("ktaTindakanPerbaikan");
		const fotoTemuanField = document.getElementById("ktaFotoTemuan");
		const fotoPerbaikanField = document.getElementById("ktaFotoPerbaikan");
		const tanggalPerbaikan = document.getElementById("ktaTanggalPerbaikan");
		const statusField = document.getElementById("ktaStatus");
		const ktaError = document.getElementById("ktaError");
		const ktaSuccess = document.getElementById("ktaSuccess");
		const ktaHistory = document.getElementById("ktaHistory");
		const ktaDetailPanel = document.getElementById("ktaDetailPanel");
		const ktaSubmitBtn = document.getElementById("ktaSubmitBtn");
		const ktaCancelEditBtn = document.getElementById("ktaCancelEditBtn");
		const ktaBulkDeleteIds = document.getElementById("ktaBulkDeleteIds");
		const ktaBulkDeleteBtn = document.getElementById("ktaBulkDeleteBtn");
		const restoreKtaBackupBtn = document.getElementById("restoreKtaBackupBtn");
		const restoreTtaBackupBtn = document.getElementById("restoreTtaBackupBtn");

		let editIndex = -1;

		function setShiftReadonly(isReadonly) {
			lftShift.disabled = Boolean(isReadonly);
		}
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
			const statusBadgeMarkup = (() => {
				const label = String(record.status || "-").trim() || "-";
				const modifier = label === "-" ? "status-empty" : `status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
				return `<span class="tta-status-badge ${modifier}">${label}</span>`;
			})();

			ktaDetailPanel.classList.remove("hidden");
			ktaDetailPanel.innerHTML = `
				<div class="detail-header">
					<div>
						<h3>Detail KTA</h3>
						<p class="detail-meta">${record.noId}</p>
					</div>
					<button type="button" id="closeKtaDetail" class="btn-small">Tutup</button>
				</div>
				<div class="detail-grid">
					<div class="detail-item"><span class="detail-label">Tanggal Laporan</span><span class="detail-value">${record.tanggalLaporan}</span></div>
					<div class="detail-item"><span class="detail-label">Nama Pelapor</span><span class="detail-value">${record.namaPelapor}</span></div>
					<div class="detail-item"><span class="detail-label">Jabatan</span><span class="detail-value">${record.jabatan}</span></div>
					<div class="detail-item"><span class="detail-label">Departemen</span><span class="detail-value">${record.departemen}</span></div>
					<div class="detail-item"><span class="detail-label">Perusahaan</span><span class="detail-value">${record.perusahaan || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Tanggal Temuan</span><span class="detail-value">${record.tanggalTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Kategori Temuan</span><span class="detail-value">${record.kategoriTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Lokasi Temuan</span><span class="detail-value">${record.lokasiTemuan || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Detail Lokasi Temuan</span><span class="detail-value">${record.detailLokasiTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Risk Level</span><span class="detail-value">${record.riskLevel}</span></div>
					<div class="detail-item"><span class="detail-label">Nama PIC</span><span class="detail-value">${record.namaPic}</span></div>
					<div class="detail-item"><span class="detail-label">Perbaikan Langsung</span><span class="detail-value">${record.perbaikanLangsung}</span></div>
					<div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${statusBadgeMarkup}</span></div>
					<div class="detail-item"><span class="detail-label">Tanggal Perbaikan</span><span class="detail-value">${record.tanggalPerbaikan || "-"}</span></div>
				</div>
				<div class="detail-copy-block">
					<h4 class="detail-section-title">Detail Temuan</h4>
					<p class="detail-copy">${record.detailTemuan}</p>
				</div>
				<div class="detail-copy-block">
					<h4 class="detail-section-title">Tindakan Perbaikan</h4>
					<p class="detail-copy">${record.tindakanPerbaikan || "-"}</p>
				</div>
				<h4 class="detail-section-title">Foto Temuan</h4>
				${renderPhotos(record.fotoTemuan)}
				<h4 class="detail-section-title">Foto Perbaikan</h4>
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

			const getStatusBadgeMarkup = (status) => {
				const label = String(status || "-").trim() || "-";
				const modifier = label === "-" ? "status-empty" : `status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
				return `<span class="tta-status-badge ${modifier}">${label}</span>`;
			};

			const rows = records
				.map((item, index) => ({ item, index }))
				.reverse()
				.map(
					(entry) => `
						<tr class="kta-history-row">
							<td data-label="No ID"><span class="tta-cell-primary">${entry.item.noId}</span></td>
							<td data-label="Tanggal Laporan">${entry.item.tanggalLaporan}</td>
							<td data-label="Nama Pelapor">${entry.item.namaPelapor}</td>
							<td data-label="Departemen">${entry.item.departemen}</td>
							<td data-label="Risk Level">${entry.item.riskLevel}</td>
							<td data-label="Nama PIC">${entry.item.namaPic}</td>
							<td data-label="Perbaikan Langsung">${entry.item.perbaikanLangsung}</td>
							<td data-label="Status">${getStatusBadgeMarkup(entry.item.status)}</td>
							<td data-label="Aksi">
								<div class="table-actions">
									<button type="button" class="btn-small btn-edit kta-detail-btn" data-index="${entry.index}">Detail</button>
								${
									isSuperAdmin
										? `<button type="button" class="btn-small btn-edit kta-edit-btn" data-index="${entry.index}">Edit</button>
										   <button type="button" class="btn-small btn-delete kta-delete-btn" data-index="${entry.index}">Hapus</button>`
										: ""
								}
								</div>
							</td>
						</tr>
					`,
				)
				.join("");

			ktaHistory.innerHTML = `
				<table class="data-table kta-history-table">
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
			fotoTemuanField.required = false;
			fotoPerbaikanField.required = false;
			tanggalPerbaikan.required = isDirectFix;
			statusField.required = isDirectFix;
		}

		perbaikanLangsung.addEventListener("change", toggleDirectFixFields);

		ktaForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			ktaError.textContent = "";
			ktaSuccess.textContent = "";

			await runWithButtonLoading(ktaSubmitBtn, "Menyimpan...", async () => {
			try {
				console.log("[KTA Submit] Form submit dimulai");
				const formData = new FormData(ktaForm);
				const fotoTemuanFiles = document.getElementById("ktaFotoTemuan").files || [];
				const fotoPerbaikanFiles = document.getElementById("ktaFotoPerbaikan").files || [];
				console.log("[KTA Submit] Foto temuan:", fotoTemuanFiles.length, "file(s)");
				console.log("[KTA Submit] Foto perbaikan:", fotoPerbaikanFiles.length, "file(s)");

			await runWithFormControlsDisabled(ktaForm, async () => {

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
			console.log("[KTA Submit] Payload base:", payload);

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
				console.error("[KTA Submit] Validasi gagal: field wajib tidak lengkap");
				return;
			}

			if (!kategoriTemuanOptions.includes(payload.kategoriTemuan)) {
				ktaError.textContent = "Kategori Temuan harus dipilih dari daftar yang tersedia.";
				console.error("[KTA Submit] Kategori temuan tidak valid:", payload.kategoriTemuan);
				return;
			}

			if (!["Critical", "High", "Medium", "Low"].includes(payload.riskLevel)) {
				ktaError.textContent = "Risk Level tidak valid.";
				console.error("[KTA Submit] Risk level tidak valid:", payload.riskLevel);
				return;
			}

			if (!getPics().includes(payload.namaPic)) {
				ktaError.textContent = "Nama PIC harus dipilih dari Daftar PIC.";
				console.error("[KTA Submit] PIC tidak valid:", payload.namaPic);
				return;
			}

			if (!DEFAULT_LOKASI_TEMUAN.includes(payload.lokasiTemuan)) {
				ktaError.textContent = "Lokasi Temuan harus dipilih dari daftar yang tersedia.";
				console.error("[KTA Submit] Lokasi tidak valid:", payload.lokasiTemuan);
				return;
			}

			if (payload.perbaikanLangsung === "Ya") {
				if (!payload.tindakanPerbaikan || !payload.tanggalPerbaikan || !payload.status) {
					ktaError.textContent = "Lengkapi field perbaikan langsung (Tindakan, Tanggal, dan Status).";
					console.error("[KTA Submit] Perbaikan langsung field tidak lengkap");
					return;
				}

				if (!["Open", "Progress", "Close"].includes(payload.status)) {
					ktaError.textContent = "Status perbaikan tidak valid.";
					console.error("[KTA Submit] Status tidak valid:", payload.status);
					return;
				}
			}

			if (payload.perbaikanLangsung === "Tidak") {
				payload.tindakanPerbaikan = "";
				payload.fotoPerbaikan = [];
				payload.tanggalPerbaikan = "";
				payload.status = "Open";
			}

			console.log("[KTA Submit] Mulai kompresi foto temuan...");
			payload.fotoTemuan = await readFilesAsDataUrls(fotoTemuanFiles);
			console.log("[KTA Submit] Foto temuan setelah kompresi:", payload.fotoTemuan.length);
			if (editIndex >= 0 && payload.fotoTemuan.length === 0) {
				payload.fotoTemuan = existingTemuanPhotos;
				console.log("[KTA Submit] Menggunakan existing foto temuan:", payload.fotoTemuan.length);
			}

			if (payload.perbaikanLangsung === "Ya") {
				console.log("[KTA Submit] Mulai kompresi foto perbaikan...");
				payload.fotoPerbaikan = await readFilesAsDataUrls(fotoPerbaikanFiles);
				console.log("[KTA Submit] Foto perbaikan setelah kompresi:", payload.fotoPerbaikan.length);
				if (editIndex >= 0 && payload.fotoPerbaikan.length === 0) {
					payload.fotoPerbaikan = existingPerbaikanPhotos;
					console.log("[KTA Submit] Menggunakan existing foto perbaikan:", payload.fotoPerbaikan.length);
				}
			}

			const records = getKtaRecords();
			console.log("[KTA Submit] Total records sebelumnya:", records.length);

			if (editIndex >= 0 && isSuperAdmin) {
				console.log("[KTA Submit] Mode EDIT, editIndex:", editIndex);
				const currentRecord = records[editIndex];
				if (!currentRecord) {
					ktaError.textContent = "Data KTA yang akan diperbarui tidak ditemukan.";
					console.error("[KTA Submit] Edit mode: record tidak ditemukan");
					return;
				}

				console.log("[KTA Submit] Panggil updateKtaRecord untuk noId:", currentRecord.noId);
				const updateResult = await updateKtaRecord(currentRecord.noId, payload);
				console.log("[KTA Submit] Update result:", updateResult.ok, updateResult.status);
				if (!updateResult.ok) {
					ktaError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui data KTA di backend.");
					console.error("[KTA Submit] Update gagal:", updateResult);
					return;
				}

				records[editIndex] = payload;
				writeLocalArray(KTA_KEY, records);
				console.log("[KTA Submit] Update berhasil disimpan ke lokal");
			} else {
				console.log("[KTA Submit] Mode CREATE");
				let createPayload = { ...payload };
				console.log("[KTA Submit] Panggil createKtaRecord untuk noId:", createPayload.noId);
				let createResult = await createKtaRecord(createPayload);
				console.log("[KTA Submit] Create result:", createResult.ok, createResult.status, createResult.payload);

				if (!createResult.ok && createResult.status === 409) {
					console.warn("[KTA Submit] 409 Conflict detected, sync dan retry...");
					await syncArrayData(KTA_SYNC_ENDPOINT, KTA_KEY);
					createPayload = {
						...createPayload,
						noId: createKtaId(),
					};
					console.log("[KTA Submit] NoId baru setelah 409:", createPayload.noId);
					document.getElementById("ktaNoId").value = createPayload.noId;
					createResult = await createKtaRecord(createPayload);
					console.log("[KTA Submit] Retry result:", createResult.ok, createResult.status);
				}

				if (!createResult.ok) {
					ktaError.textContent = getApiErrorMessage(createResult, "Gagal menyimpan data KTA ke backend.");
					console.error("[KTA Submit] Create gagal:", createResult);
					return;
				}

				const latestRecords = getKtaRecords();
				latestRecords.push(createPayload);
				writeLocalArray(KTA_KEY, latestRecords);
				payload.noId = createPayload.noId;
				console.log("[KTA Submit] Create berhasil, total records sekarang:", latestRecords.length);
			}

			ktaSuccess.textContent =
				editIndex >= 0 && isSuperAdmin
					? `Data KTA berhasil diperbarui dengan No ID ${payload.noId}.`
					: `Data KTA berhasil disimpan dengan No ID ${payload.noId}.`;
			console.log("[KTA Submit] SUCCESS:", ktaSuccess.textContent);
			resetKtaForm();
			renderKtaHistory();
			});
			} catch (error) {
				console.error("[KTA Submit] EXCEPTION:", error);
				ktaError.textContent = `Error: ${error.message}`;
			}
			});
		});

		if (ktaCancelEditBtn) {
			ktaCancelEditBtn.addEventListener("click", () => {
				resetKtaForm();
				ktaSuccess.textContent = "Mode edit dibatalkan.";
			});
		}

		if (ktaBulkDeleteIds && ktaBulkDeleteBtn) {
			ktaBulkDeleteBtn.addEventListener("click", async () => {
				ktaError.textContent = "";
				ktaSuccess.textContent = "";

				const requestedIds = Array.from(
					new Set(
						String(ktaBulkDeleteIds.value || "")
							.split(/[\n,;]+/)
							.map((value) => String(value || "").trim())
							.filter(Boolean),
					),
				);

				if (requestedIds.length === 0) {
					ktaError.textContent = "Masukkan minimal satu No ID KTA untuk dihapus.";
					return;
				}

				await runWithButtonLoading(ktaBulkDeleteBtn, "Menghapus...", async () => {
					const recordsNow = getKtaRecords();
					const requestedIdSet = new Set(requestedIds.map((item) => item.toLowerCase()));
					const matchedRecords = recordsNow.filter((item) => requestedIdSet.has(String(item.noId || "").trim().toLowerCase()));

					if (matchedRecords.length === 0) {
						ktaError.textContent = "No ID yang dimasukkan tidak ditemukan di Riwayat KTA.";
						return;
					}

					const successfulDeletes = new Set();
					let failedDeleteCount = 0;

					for (const record of matchedRecords) {
						const result = await deleteKtaRecord(record.noId);
						if (result.ok) {
							successfulDeletes.add(String(record.noId || "").trim().toLowerCase());
						} else {
							failedDeleteCount += 1;
						}
					}

					const remainingRecords = recordsNow.filter(
						(item) => !successfulDeletes.has(String(item.noId || "").trim().toLowerCase()),
					);
					writeLocalArray(KTA_KEY, remainingRecords);

					if (editIndex >= 0) {
						const editedRecord = recordsNow[editIndex];
						const editedNoId = String(editedRecord?.noId || "").trim().toLowerCase();
						if (editedNoId && successfulDeletes.has(editedNoId)) {
							resetKtaForm();
						}
					}

					const notFoundCount = requestedIds.length - matchedRecords.length;
					ktaSuccess.textContent = `Hapus massal selesai. Berhasil: ${successfulDeletes.size}, Gagal: ${failedDeleteCount}, Tidak ditemukan: ${notFoundCount}.`;
					ktaBulkDeleteIds.value = "";
					renderKtaHistory();
				});
			});
		}

		if (restoreKtaBackupBtn) {
			restoreKtaBackupBtn.addEventListener("click", async () => {
				ktaError.textContent = "";
				ktaSuccess.textContent = "";

				await runWithButtonLoading(restoreKtaBackupBtn, "Memulihkan...", async () => {
					const backupRecords = getLatestBackupRecords(KTA_KEY);
					if (backupRecords.length === 0) {
						ktaError.textContent = "Backup KTA lokal belum tersedia.";
						return;
					}

					const mergedRecords = mergeRecordsByNoId(getKtaRecords(), backupRecords);
					writeLocalArray(KTA_KEY, mergedRecords);
					await pushRecordsToBackend(KTA_SYNC_ENDPOINT, mergedRecords);
					ktaSuccess.textContent = `Backup KTA berhasil dipulihkan (${mergedRecords.length} record).`;
					renderKtaHistory();
				});
			});
		}

		if (restoreTtaBackupBtn) {
			restoreTtaBackupBtn.addEventListener("click", async () => {
				ktaError.textContent = "";
				ktaSuccess.textContent = "";

				await runWithButtonLoading(restoreTtaBackupBtn, "Memulihkan...", async () => {
					const backupRecords = getLatestBackupRecords(TTA_KEY);
					if (backupRecords.length === 0) {
						ktaError.textContent = "Backup TTA lokal belum tersedia.";
						return;
					}

					const mergedRecords = mergeRecordsByNoId(getTtaRecords(), backupRecords);
					writeLocalArray(TTA_KEY, mergedRecords);
					await pushRecordsToBackend(TTA_SYNC_ENDPOINT, mergedRecords);
					ktaSuccess.textContent = `Backup TTA berhasil dipulihkan (${mergedRecords.length} record).`;
				});
			});
		}

		toggleDirectFixFields();
		renderKtaHistory();
	}

	function renderTtaContent() {
		const reportDate = getTodayDate();
		const noId = createTtaId();
		const isSuperAdmin = session.role === "Super Admin";
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
				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Informasi Pelapor</h3>
						<p class="form-section-note">Data pelapor otomatis diambil dari akun aktif.</p>
					</div>
					<div class="form-section-grid form-grid">
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
					</div>
				</section>

				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Detail Temuan</h3>
						<p class="form-section-note">Isi waktu, lokasi, kategori, PIC, dan pelaku TTA.</p>
					</div>
					<div class="form-section-grid form-grid">
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
								<option value="-">-</option>
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
							<label for="ttaFotoTemuan">Foto Temuan (Opsional)</label>
							<input id="ttaFotoTemuan" name="fotoTemuan" type="file" accept="image/*" multiple />
						</div>
					</div>
				</section>

				<section class="form-section field-full">
					<div class="form-section-header">
						<h3 class="form-section-title">Tindak Lanjut</h3>
						<p class="form-section-note">Atur perbaikan langsung dan status penyelesaian temuan.</p>
					</div>
					<div class="form-section-grid form-grid">
						<div class="field">
							<label for="ttaPerbaikanLangsung">Perbaikan Langsung</label>
							<select id="ttaPerbaikanLangsung" name="perbaikanLangsung" required>
								<option value="">Pilih</option>
								<option value="Ya">Ya</option>
								<option value="Tidak">Tidak</option>
							</select>
						</div>
					</div>
				</section>

				<div id="ttaDirectFixSection" class="form-section field-full hidden">
					<div class="form-section-header">
						<h3 class="form-section-title">Detail Perbaikan</h3>
						<p class="form-section-note">Bagian ini aktif saat perbaikan langsung dilakukan.</p>
					</div>
					<div class="form-section-grid form-grid">
						<div class="field field-full">
							<label for="ttaTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="ttaTindakanPerbaikan" name="tindakanPerbaikan" rows="3"></textarea>
						</div>
						<div class="field field-full">
							<label for="ttaFotoPerbaikan">Foto Perbaikan (Opsional)</label>
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
		const fotoTemuanField = document.getElementById("ttaFotoTemuan");
		const fotoPerbaikanField = document.getElementById("ttaFotoPerbaikan");
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
			if (pelakuField.value === "-") {
				jabatanPelakuField.value = "-";
				departemenPelakuField.value = "-";
				perusahaanPelakuField.value = "-";
				return;
			}

			const selected = userOptions.find((item) => item.username === pelakuField.value);
			jabatanPelakuField.value = selected ? selected.jabatan : "";
			departemenPelakuField.value = selected ? selected.departemen : "";
			perusahaanPelakuField.value = selected ? selected.perusahaan || "-" : "";
		}

		function showTtaDetail(record) {
			const statusBadgeMarkup = (() => {
				const label = String(record.status || "-").trim() || "-";
				const modifier = label === "-" ? "status-empty" : `status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
				return `<span class="tta-status-badge ${modifier}">${label}</span>`;
			})();

			ttaDetailPanel.classList.remove("hidden");
			ttaDetailPanel.innerHTML = `
				<div class="detail-header">
					<div>
						<h3>Detail TTA</h3>
						<p class="detail-meta">${record.noId}</p>
					</div>
					<button type="button" id="closeTtaDetail" class="btn-small">Tutup</button>
				</div>
				<div class="detail-grid">
					<div class="detail-item"><span class="detail-label">Tanggal Laporan</span><span class="detail-value">${record.tanggalLaporan}</span></div>
					<div class="detail-item"><span class="detail-label">Nama Pelapor</span><span class="detail-value">${record.namaPelapor}</span></div>
					<div class="detail-item"><span class="detail-label">Jabatan</span><span class="detail-value">${record.jabatan}</span></div>
					<div class="detail-item"><span class="detail-label">Departemen</span><span class="detail-value">${record.departemen}</span></div>
					<div class="detail-item"><span class="detail-label">Perusahaan</span><span class="detail-value">${record.perusahaan || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Tanggal Temuan</span><span class="detail-value">${record.tanggalTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Jam Temuan</span><span class="detail-value">${record.jamTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Kategori Temuan</span><span class="detail-value">${record.kategoriTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Lokasi Temuan</span><span class="detail-value">${record.lokasiTemuan || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Detail Lokasi Temuan</span><span class="detail-value">${record.detailLokasiTemuan}</span></div>
					<div class="detail-item"><span class="detail-label">Risk Level</span><span class="detail-value">${record.riskLevel}</span></div>
					<div class="detail-item"><span class="detail-label">Nama PIC</span><span class="detail-value">${record.namaPja || record.namaPic || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Nama Pelaku TTA</span><span class="detail-value">${getUserFullNameFromIdentifier(record.namaPelakuTta)}</span></div>
					<div class="detail-item"><span class="detail-label">Jabatan Pelaku TTA</span><span class="detail-value">${record.jabatanPelakuTta}</span></div>
					<div class="detail-item"><span class="detail-label">Departemen Pelaku TTA</span><span class="detail-value">${record.departemenPelakuTta}</span></div>
					<div class="detail-item"><span class="detail-label">Perusahaan Pelaku TTA</span><span class="detail-value">${record.perusahaanPelakuTta || "-"}</span></div>
					<div class="detail-item"><span class="detail-label">Perbaikan Langsung</span><span class="detail-value">${record.perbaikanLangsung}</span></div>
					<div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${statusBadgeMarkup}</span></div>
					<div class="detail-item"><span class="detail-label">Tanggal Perbaikan</span><span class="detail-value">${record.tanggalPerbaikan || "-"}</span></div>
				</div>
				<div class="detail-copy-block">
					<h4 class="detail-section-title">Detail Temuan</h4>
					<p class="detail-copy">${record.detailTemuan}</p>
				</div>
				<div class="detail-copy-block">
					<h4 class="detail-section-title">Tindakan Perbaikan</h4>
					<p class="detail-copy">${record.tindakanPerbaikan || "-"}</p>
				</div>
				<h4 class="detail-section-title">Foto Temuan</h4>
				${renderPhotos(record.fotoTemuan)}
				<h4 class="detail-section-title">Foto Perbaikan</h4>
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

			const getStatusBadgeMarkup = (status) => {
				const label = String(status || "-").trim() || "-";
				const modifier = label === "-" ? "status-empty" : `status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
				return `<span class="tta-status-badge ${modifier}">${label}</span>`;
			};

			const rows = records
				.map((item, index) => ({ item, index }))
				.reverse()
				.map(
					(entry) => `
						<tr class="tta-history-row">
							<td data-label="No ID"><span class="tta-cell-primary">${entry.item.noId}</span></td>
							<td data-label="Tanggal Laporan">${entry.item.tanggalLaporan}</td>
							<td data-label="Nama Pelapor">${entry.item.namaPelapor}</td>
							<td data-label="Nama PIC">${entry.item.namaPja || entry.item.namaPic || "-"}</td>
							<td data-label="Pelaku TTA">${getUserFullNameFromIdentifier(entry.item.namaPelakuTta)}</td>
							<td data-label="Risk Level">${entry.item.riskLevel}</td>
							<td data-label="Status">${getStatusBadgeMarkup(entry.item.status)}</td>
							<td data-label="Aksi">
								<div class="table-actions">
									<button type="button" class="btn-small btn-edit tta-detail-btn" data-index="${entry.index}">Detail</button>
									<button type="button" class="btn-small btn-edit tta-edit-btn" data-index="${entry.index}">Edit</button>
									${isSuperAdmin ? `<button type="button" class="btn-small btn-delete tta-delete-btn" data-index="${entry.index}">Hapus</button>` : ""}
								</div>
							</td>
						</tr>
					`,
				)
				.join("");

			ttaHistory.innerHTML = `
				<table class="data-table tta-history-table">
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
						console.warn("[TTA Edit] Record tidak ditemukan di index", index);
						return;
					}

					console.log("[TTA Edit] Setting editIndex to", index, "for noId:", selected.noId);
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
					document.getElementById("ttaPelaku").value =
						selectedPelakuUser ? selectedPelakuUser.username : selected.namaPelakuTta === "-" ? "-" : "";
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
					console.log("[TTA Edit] Form filled, editIndex now:", editIndex);
				});
			});

			deleteButtons.forEach((button) => {
				button.addEventListener("click", async () => {
					ttaError.textContent = "";
					ttaSuccess.textContent = "";
					if (!isSuperAdmin) {
						ttaError.textContent = "Hanya Super Admin yang dapat menghapus tiket TTA.";
						return;
					}

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
			console.log("[TTA Reset] Resetting form, editIndex before:", editIndex);
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
			console.log("[TTA Reset] Form reset complete, editIndex now:", editIndex);
		}

		function toggleDirectFixFields() {
			const isDirectFix = perbaikanLangsung.value === "Ya";
			directFixSection.classList.toggle("hidden", !isDirectFix);
			tindakanPerbaikan.required = isDirectFix;
			fotoTemuanField.required = false;
			fotoPerbaikanField.required = false;
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
			const formData = new FormData(ttaForm);
			const fotoTemuanFiles = document.getElementById("ttaFotoTemuan").files || [];
			const fotoPerbaikanFiles = document.getElementById("ttaFotoPerbaikan").files || [];

			await runWithFormControlsDisabled(ttaForm, async () => {

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

			if (!DEFAULT_LOKASI_TEMUAN.includes(payload.lokasiTemuan)) {
				ttaError.textContent = "Lokasi Temuan harus dipilih dari daftar yang tersedia.";
				return;
			}

			if (payload.namaPelakuTta === "-") {
				payload.jabatanPelakuTta = "-";
				payload.departemenPelakuTta = "-";
				payload.perusahaanPelakuTta = "-";
			} else {
				const selectedPelaku = userOptions.find((item) => item.username === payload.namaPelakuTta);
				if (!selectedPelaku) {
					ttaError.textContent = "Nama Pelaku TTA harus dipilih dari Daftar User atau '-' .";
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
			console.log("[TTA Form Submit] editIndex:", editIndex, "buttonText:", ttaSubmitBtn.textContent, "payloadNoId:", payload.noId);

			// Determine if this is edit or create mode
			let isEditMode = editIndex >= 0;
			const currentRecord = isEditMode ? records[editIndex] : null;

			if (isEditMode && !currentRecord) {
				console.warn("[TTA Form Submit] Edit mode set tapi record tidak ditemukan di index", editIndex, "- fallback ke create mode");
				isEditMode = false;
			}

			if (isEditMode) {
				console.log("[TTA Form Submit] Executing UPDATE for noId:", currentRecord.noId);
				const updateResult = await updateTtaRecord(currentRecord.noId, payload);
				if (!updateResult.ok) {
					ttaError.textContent = getApiErrorMessage(updateResult, "Gagal memperbarui data TTA di backend.");
					console.error("[TTA Form Submit] Update failed:", updateResult);
					return;
				}

				records[editIndex] = payload;
				writeLocalArray(TTA_KEY, records);
				ttaSuccess.textContent = `Data TTA berhasil diperbarui dengan No ID ${payload.noId}.`;
			} else {
				console.log("[TTA Form Submit] Executing CREATE for noId:", payload.noId);
				const createResult = await createTtaRecord(payload);
				if (!createResult.ok) {
					ttaError.textContent = getApiErrorMessage(createResult, "Gagal menyimpan data TTA ke backend.");
					console.error("[TTA Form Submit] Create failed:", createResult);
					return;
				}

				records.push(payload);
				writeLocalArray(TTA_KEY, records);
				ttaSuccess.textContent = `Data TTA berhasil disimpan dengan No ID ${payload.noId}.`;
			}

			resetTtaForm();
			renderTtaHistory();
			});
			});
		});

		ttaCancelEditBtn.addEventListener("click", () => {
			console.log("[TTA Cancel] Cancelling edit mode, current editIndex:", editIndex);
			resetTtaForm();
			ttaSuccess.textContent = "Mode edit TTA dibatalkan.";
		});

		updatePelakuInfo();
		toggleDirectFixFields();
		renderTtaHistory();
	}

	function renderLeaveSettingsContent() {
		if (session.role !== "Super Admin" && session.role !== "Admin") {
			renderDefaultContent("Pengaturan Cuti");
			return;
		}

		const users = getManagedUsers();
		const normalizeGroupKey = (value) =>
			String(value || "")
				.trim()
				.toUpperCase()
				.replace(/\s+/g, " ");
		const preferredGroupOrder = ["OPERATOR", "PENGAWAS", "LEVEL 1 MGT"];

		const availableGroups = Array.from(
			new Set(
				users
					.map((item) => normalizeGroupKey(item.kelompokJabatan))
					.filter(Boolean),
			),
		).sort((a, b) => {
			const aIndex = preferredGroupOrder.indexOf(a);
			const bIndex = preferredGroupOrder.indexOf(b);
			if (aIndex >= 0 && bIndex >= 0) {
				return aIndex - bIndex;
			}
			if (aIndex >= 0) {
				return -1;
			}
			if (bIndex >= 0) {
				return 1;
			}
			return a.localeCompare(b);
		});

		if (availableGroups.length === 0) {
			contentArea.innerHTML = `
				<h2>Pengaturan Cuti</h2>
				<p class="subtitle">Atur tanggal cuti user per kelompok jabatan agar target KTA/TTA pada tanggal tersebut tidak dihitung.</p>
				<p class="error">Belum ada data user dengan Kelompok Jabatan. Tambahkan user terlebih dahulu pada menu Daftar User.</p>
			`;
			return;
		}

		const leaveMap = new Map();
		getLeaveSettings().forEach((item) => {
			leaveMap.set(item.username, new Set(Array.isArray(item.dates) ? item.dates : []));
		});

		users.forEach((user) => {
			const key = String(user.username || "").trim().toLowerCase();
			if (!key) {
				return;
			}

			if (!leaveMap.has(key)) {
				leaveMap.set(key, new Set());
			}
		});

		let selectedGroup = "";
		let usernameSearch = "";
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;
		const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);
		const monthOptions = [
			{ value: 1, label: "Januari" },
			{ value: 2, label: "Februari" },
			{ value: 3, label: "Maret" },
			{ value: 4, label: "April" },
			{ value: 5, label: "Mei" },
			{ value: 6, label: "Juni" },
			{ value: 7, label: "Juli" },
			{ value: 8, label: "Agustus" },
			{ value: 9, label: "September" },
			{ value: 10, label: "Oktober" },
			{ value: 11, label: "November" },
			{ value: 12, label: "Desember" },
		];

		const calendarStateByUser = new Map();
		users.forEach((user) => {
			const key = String(user.username || "").trim().toLowerCase();
			if (!key) {
				return;
			}

			calendarStateByUser.set(key, {
				year: currentYear,
				month: currentMonth,
			});
		});

		contentArea.innerHTML = `
			<h2>Pengaturan Cuti</h2>
			<p class="subtitle">Pilih kelompok jabatan, lalu atur tahun, bulan, dan tanggal cuti tiap user. Tanggal cuti yang dipilih tidak dihitung sebagai target KTA/TTA.</p>
			<div id="leaveGroupList" class="leave-group-list"></div>
			<p id="leaveError" class="error"></p>
			<p id="leaveSuccess" class="subtitle"></p>
			<div id="leaveUserList" class="leave-user-list"></div>
			<div class="inline-actions">
				<button type="button" id="saveLeaveSettingsBtn" class="btn-primary">Simpan Pengaturan Cuti</button>
			</div>
		`;

		const leaveGroupList = document.getElementById("leaveGroupList");
		const leaveUserList = document.getElementById("leaveUserList");
		const leaveError = document.getElementById("leaveError");
		const leaveSuccess = document.getElementById("leaveSuccess");
		const saveLeaveSettingsBtn = document.getElementById("saveLeaveSettingsBtn");

		function getUserLeaveSet(username) {
			const key = String(username || "").trim().toLowerCase();
			if (!key) {
				return new Set();
			}

			if (!leaveMap.has(key)) {
				leaveMap.set(key, new Set());
			}

			return leaveMap.get(key);
		}

		function getUsersBySelectedGroup() {
			if (!selectedGroup) {
				return [];
			}

			const normalizedSearch = String(usernameSearch || "").trim().toLowerCase();
			if (!normalizedSearch) {
				return [];
			}

			const filteredUsers = users
				.filter((item) => normalizeGroupKey(item.kelompokJabatan) === selectedGroup)
				.sort((a, b) => {
					const nameA = String(a.namaLengkap || a.username || "");
					const nameB = String(b.namaLengkap || b.username || "");
					return nameA.localeCompare(nameB);
				});

			return filteredUsers.filter((item) => String(item.username || "").trim().toLowerCase() === normalizedSearch);
		}

		function renderFilterControls() {
			const usernamesInSelectedGroup = users
				.filter((item) => normalizeGroupKey(item.kelompokJabatan) === selectedGroup)
				.map((item) => String(item.username || "").trim())
				.filter(Boolean)
				.sort((a, b) => a.localeCompare(b));

			leaveGroupList.innerHTML = `
				<div class="form-grid">
					<div class="field">
						<label for="leaveGroupSelect">Kelompok Jabatan</label>
						<select id="leaveGroupSelect">
							<option value="">Pilih Kelompok Jabatan</option>
							${availableGroups.map((group) => `<option value="${group}" ${group === selectedGroup ? "selected" : ""}>${group}</option>`).join("")}
						</select>
					</div>
					<div class="field">
						<label for="leaveUsernameSearch">Cari User (Username)</label>
						<input id="leaveUsernameSearch" type="text" value="${usernameSearch}" list="leaveUsernameOptions" placeholder="Masukkan username user terdaftar" ${selectedGroup ? "" : "disabled"} />
						<datalist id="leaveUsernameOptions">
							${usernamesInSelectedGroup.map((username) => `<option value="${username}"></option>`).join("")}
						</datalist>
						<div class="inline-actions leave-search-actions">
							<button type="button" id="leaveResetSearchBtn" class="btn-small" ${selectedGroup ? "" : "disabled"}>Reset Cari User</button>
						</div>
					</div>
				</div>
			`;

			const leaveGroupSelect = document.getElementById("leaveGroupSelect");
			const leaveUsernameSearch = document.getElementById("leaveUsernameSearch");
			const leaveResetSearchBtn = document.getElementById("leaveResetSearchBtn");

			leaveGroupSelect.addEventListener("change", () => {
				selectedGroup = String(leaveGroupSelect.value || "").trim();
				usernameSearch = "";
				leaveError.textContent = "";
				leaveSuccess.textContent = "";
				renderFilterControls();
				renderLeaveUsers();
			});

			if (leaveUsernameSearch) {
				leaveUsernameSearch.addEventListener("input", () => {
					usernameSearch = String(leaveUsernameSearch.value || "").trim();
					leaveError.textContent = "";
					leaveSuccess.textContent = "";
					renderLeaveUsers();
				});
			}

			if (leaveResetSearchBtn) {
				leaveResetSearchBtn.addEventListener("click", () => {
					usernameSearch = "";
					leaveError.textContent = "";
					leaveSuccess.textContent = "";
					renderFilterControls();
					renderLeaveUsers();
				});
			}
		}

		function buildLeaveDate(year, month, day) {
			const monthText = String(month).padStart(2, "0");
			const dayText = String(day).padStart(2, "0");
			return `${year}-${monthText}-${dayText}`;
		}

		function renderLeaveUsers() {
			if (!selectedGroup) {
				leaveUserList.innerHTML = `<p class="subtitle">Pilih Kelompok Jabatan terlebih dahulu, lalu cari user dengan username.</p>`;
				return;
			}

			if (!String(usernameSearch || "").trim()) {
				leaveUserList.innerHTML = `<p class="subtitle">Isi kolom Cari User (Username) untuk menampilkan user pada kelompok jabatan ${selectedGroup}.</p>`;
				return;
			}

			const selectedUsers = getUsersBySelectedGroup();
			if (selectedUsers.length === 0) {
				const searchText = String(usernameSearch || "").trim();
				leaveUserList.innerHTML = `<p class="subtitle">User dengan username "${searchText}" tidak ditemukan pada kelompok jabatan ${selectedGroup}.</p>`;
				return;
			}

			leaveUserList.innerHTML = selectedUsers
				.map((user) => {
					const username = String(user.username || "").trim().toLowerCase();
					const state = calendarStateByUser.get(username) || { year: currentYear, month: currentMonth };
					const year = Number(state.year) || currentYear;
					const month = Number(state.month) || currentMonth;
					const daysInMonth = getDaysInMonth(year, month);
					const leaveSet = getUserLeaveSet(username);

					const dayButtons = Array.from({ length: daysInMonth }, (_, index) => {
						const day = index + 1;
						const isoDate = buildLeaveDate(year, month, day);
						const isActive = leaveSet.has(isoDate);
						return `<button type="button" class="leave-day-button ${isActive ? "active" : ""}" data-username="${username}" data-date="${isoDate}">${day}</button>`;
					}).join("");

					const monthlySelectedCount = Array.from(leaveSet).filter((item) => item.startsWith(`${year}-${String(month).padStart(2, "0")}-`)).length;

					return `
						<section class="leave-user-card">
							<div class="leave-user-header">
								<div>
									<h3>${String(user.namaLengkap || user.username || "-")}</h3>
									<p class="subtitle">Username: ${user.username || "-"} • Jabatan: ${user.jabatan || "-"}</p>
								</div>
							</div>
							<div class="leave-period-controls">
								<div class="field">
									<label>Tahun</label>
									<select class="leave-year-select" data-username="${username}">
										${yearOptions.map((item) => `<option value="${item}" ${item === year ? "selected" : ""}>${item}</option>`).join("")}
									</select>
								</div>
								<div class="field">
									<label>Bulan</label>
									<select class="leave-month-select" data-username="${username}">
										${monthOptions
											.map((item) => `<option value="${item.value}" ${item.value === month ? "selected" : ""}>${item.label}</option>`)
											.join("")}
									</select>
								</div>
							</div>
							<p class="subtitle">Tanggal cuti terpilih pada periode ini: ${monthlySelectedCount}</p>
							<div class="leave-day-grid">${dayButtons}</div>
						</section>
					`;
				})
				.join("");

			leaveUserList.querySelectorAll(".leave-year-select, .leave-month-select").forEach((selectElement) => {
				selectElement.addEventListener("change", () => {
					const username = String(selectElement.dataset.username || "").trim().toLowerCase();
					if (!username) {
						return;
					}

					const userCard = selectElement.closest(".leave-user-card");
					if (!userCard) {
						return;
					}

					const yearSelect = userCard.querySelector(`.leave-year-select[data-username="${username}"]`);
					const monthSelect = userCard.querySelector(`.leave-month-select[data-username="${username}"]`);
					const selectedYear = Number(yearSelect?.value || currentYear);
					const selectedMonth = Number(monthSelect?.value || currentMonth);

					calendarStateByUser.set(username, {
						year: selectedYear,
						month: selectedMonth,
					});
					renderLeaveUsers();
				});
			});

			leaveUserList.querySelectorAll(".leave-day-button").forEach((button) => {
				button.addEventListener("click", () => {
					const username = String(button.dataset.username || "").trim().toLowerCase();
					const dateValue = String(button.dataset.date || "").trim();
					if (!username || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
						return;
					}

					const leaveSet = getUserLeaveSet(username);
					if (leaveSet.has(dateValue)) {
						leaveSet.delete(dateValue);
					} else {
						leaveSet.add(dateValue);
					}

					renderLeaveUsers();
				});
			});
		}

		saveLeaveSettingsBtn.addEventListener("click", async () => {
			leaveError.textContent = "";
			leaveSuccess.textContent = "";

			await runWithButtonLoading(saveLeaveSettingsBtn, "Menyimpan...", async () => {
				const normalizedPayload = Array.from(leaveMap.entries())
					.map(([username, dateSet]) => ({
						username,
						dates: Array.from(dateSet || []).sort((a, b) => a.localeCompare(b)),
					}))
					.filter((item) => item.dates.length > 0)
					.sort((a, b) => a.username.localeCompare(b.username));

				setLeaveSettings(normalizedPayload);
				leaveSuccess.textContent = "Pengaturan cuti berhasil disimpan.";
			});
		});

		renderFilterControls();
		renderLeaveUsers();
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
				const userData = getFormData();
				const validationError = validateUserData(userData);
				if (validationError) {
					userError.textContent = validationError;
					return;
				}

				await runWithFormControlsDisabled(userForm, async () => {
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

	function renderUnitContent() {
		if (session.role !== "Super Admin") {
			renderDefaultContent("Daftar Unit");
			return;
		}

		let units = getUnits();
		let editIndex = -1;

		function escapeHtmlUnit(value) {
			return String(value || "")
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;")
				.replaceAll("'", "&#39;");
		}

		contentArea.innerHTML = `
			<h2>Daftar Unit</h2>
			<p class="subtitle">Kelola data unit. Nomor unit akan tersedia sebagai pilihan di kolom Settingan Unit pada History Fatigue.</p>
			<form id="unitForm" class="form-grid" novalidate>
				<div class="field">
					<label for="unitNomor">Nomor Unit</label>
					<input id="unitNomor" name="nomor" type="text" placeholder="Masukkan nomor unit" required />
				</div>
				<div class="field">
					<label for="unitEgi">EGI</label>
					<input id="unitEgi" name="egi" type="text" placeholder="Masukkan EGI" />
				</div>
				<div class="inline-actions field-full">
					<button type="submit" id="saveUnitBtn" class="btn-primary">Tambah</button>
					<button type="button" id="cancelUnitEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="unitError" class="error"></p>
			<div id="unitList" class="list-wrap"></div>
		`;

		const unitForm = document.getElementById("unitForm");
		const unitNomor = document.getElementById("unitNomor");
		const unitEgi = document.getElementById("unitEgi");
		const saveUnitBtn = document.getElementById("saveUnitBtn");
		const cancelUnitEditBtn = document.getElementById("cancelUnitEditBtn");
		const unitError = document.getElementById("unitError");
		const unitList = document.getElementById("unitList");

		function resetUnitForm() {
			unitForm.reset();
			editIndex = -1;
			saveUnitBtn.textContent = "Tambah";
			cancelUnitEditBtn.classList.add("hidden");
			unitError.textContent = "";
		}

		function renderUnitList() {
			if (units.length === 0) {
				unitList.innerHTML = `<p class="subtitle">Belum ada data unit.</p>`;
				return;
			}

			const rows = units
				.map(
					(item, index) => `
						<div class="list-item">
							<span class="list-text"><strong>${escapeHtmlUnit(item.nomor)}</strong>${item.egi ? " &ndash; " + escapeHtmlUnit(item.egi) : ""}</span>
							<div class="list-actions">
								<button type="button" class="btn-small btn-edit" data-index="${index}">Ubah</button>
								<button type="button" class="btn-small btn-delete" data-index="${index}">Hapus</button>
							</div>
						</div>
					`,
				)
				.join("");

			unitList.innerHTML = rows;

			unitList.querySelectorAll(".btn-edit").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					editIndex = index;
					unitNomor.value = units[index].nomor || "";
					unitEgi.value = units[index].egi || "";
					saveUnitBtn.textContent = "Simpan Perubahan";
					cancelUnitEditBtn.classList.remove("hidden");
					unitNomor.focus();
				});
			});

			unitList.querySelectorAll(".btn-delete").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					const isConfirmed = window.confirm("Yakin ingin menghapus unit ini?");
					if (!isConfirmed) {
						return;
					}

					units.splice(index, 1);
					setUnits(units);
					if (editIndex === index) {
						resetUnitForm();
					}
					renderUnitList();
				});
			});
		}

		unitForm.addEventListener("submit", (event) => {
			event.preventDefault();
			unitError.textContent = "";

			const nomor = String(unitNomor.value || "").trim();
			const egi = String(unitEgi.value || "").trim();

			if (!nomor) {
				unitError.textContent = "Nomor Unit wajib diisi.";
				return;
			}

			const isDuplicate = units.some(
				(u, i) => String(u.nomor || "").trim().toLowerCase() === nomor.toLowerCase() && i !== editIndex,
			);
			if (isDuplicate) {
				unitError.textContent = "Nomor Unit sudah ada dalam daftar.";
				return;
			}

			if (editIndex >= 0) {
				units[editIndex] = { nomor, egi };
			} else {
				units.push({ nomor, egi });
			}

			setUnits(units);
			resetUnitForm();
			renderUnitList();
		});

		cancelUnitEditBtn.addEventListener("click", () => {
			resetUnitForm();
		});

		renderUnitList();
	}

	function renderLaporanFatigueTengahShiftContent() {
		if (!canAccessHistoryFatigue(session)) {
			renderDefaultContent("Laporan Fatigue Tengah Shift");
			return;
		}

		let records = getLaporanFatigueTengah();

		const fatigueRecords = getFatigueHistoryRecords();
		const nikOptions = [...new Set(fatigueRecords.map((r) => String(r.nik || "").trim()).filter(Boolean))];

		function escapeHtml(value) {
			return String(value || "")
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;")
				.replaceAll("'", "&#39;");
		}

		contentArea.innerHTML = `
			<h2>Laporan Fatigue Tengah Shift</h2>
			<p class="subtitle">Isi NIK untuk sinkron otomatis data dari History Fatigue.</p>
			<form id="lftForm" class="form-grid" novalidate>
				<div class="field">
					<label for="lftNama">Nama</label>
					<input id="lftNama" name="nama" type="text" readonly />
				</div>
				<div class="field">
					<label for="lftNik">NIK</label>
					<input id="lftNik" name="nik" type="text" list="lftNikOptions" placeholder="Masukkan NIK" autocomplete="off" />
					<datalist id="lftNikOptions">
						${nikOptions.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("")}
					</datalist>
				</div>
				<div class="field">
					<label for="lftJabatan">Jabatan</label>
					<input id="lftJabatan" name="jabatan" type="text" readonly />
				</div>
				<div class="field">
					<label for="lftDepartemen">Departemen</label>
					<input id="lftDepartemen" name="departemen" type="text" readonly />
				</div>
				<div class="field">
					<label for="lftSettinganUnit">Settingan Unit</label>
					<input id="lftSettinganUnit" name="settinganUnit" type="text" readonly />
				</div>
				<div class="field">
					<label for="lftTanggal">Tanggal</label>
					<input id="lftTanggal" name="tanggal" type="date" required />
				</div>
				<div class="field">
					<label for="lftShift">Shift</label>
					<select id="lftShift" name="shift" required>
						<option value="">Pilih Shift</option>
						<option value="Shift 1">Shift 1</option>
						<option value="Shift 2">Shift 2</option>
					</select>
				</div>
				<div class="field">
					<label for="lftJamMulai">Jam Mulai Istirahat</label>
					<input id="lftJamMulai" name="jamMulaiIstirahat" type="time" required />
				</div>
				<div class="field">
					<label for="lftJamMulaiOperasi">Jam Mulai Operasi Kembali</label>
					<input id="lftJamMulaiOperasi" name="jamMulaiOperasiKembali" type="time" />
				</div>
				<div class="inline-actions field-full">
					<button type="submit" id="lftSubmitBtn" class="btn-primary">Submit</button>
					<button type="button" id="lftCancelEditBtn" class="btn-secondary hidden">Batal</button>
				</div>
			</form>
			<p id="lftError" class="error"></p>
			<p id="lftSuccess" class="subtitle"></p>
			<div id="lftHistory"></div>
		`;

		const lftForm = document.getElementById("lftForm");
		const lftNik = document.getElementById("lftNik");
		const lftNama = document.getElementById("lftNama");
		const lftJabatan = document.getElementById("lftJabatan");
		const lftDepartemen = document.getElementById("lftDepartemen");
		const lftSettinganUnit = document.getElementById("lftSettinganUnit");
		const lftTanggal = document.getElementById("lftTanggal");
		const lftShift = document.getElementById("lftShift");
		const lftJamMulai = document.getElementById("lftJamMulai");
		const lftJamMulaiOperasi = document.getElementById("lftJamMulaiOperasi");
		const lftSubmitBtn = document.getElementById("lftSubmitBtn");
		const lftCancelEditBtn = document.getElementById("lftCancelEditBtn");
		const lftError = document.getElementById("lftError");
		const lftSuccess = document.getElementById("lftSuccess");
		const lftHistory = document.getElementById("lftHistory");

		let editIndex = -1;

		function setShiftReadonly(isReadonly) {
			lftShift.disabled = Boolean(isReadonly);
		}

		function clearSyncedFields() {
			lftNama.value = "";
			lftJabatan.value = "";
			lftDepartemen.value = "";
			lftSettinganUnit.value = "";
			lftShift.value = "";
			setShiftReadonly(false);
		}

		function resetLftForm() {
			lftForm.reset();
			clearSyncedFields();
			setShiftReadonly(false);
			editIndex = -1;
			lftSubmitBtn.textContent = "Submit";
			lftCancelEditBtn.classList.add("hidden");
			lftError.textContent = "";
		}

		function populateEditForm(record) {
			lftNik.value = record.nik || "";
			lftNama.value = record.nama || "";
			lftJabatan.value = record.jabatan || "";
			lftDepartemen.value = record.departemen || "";
			lftSettinganUnit.value = record.settinganUnit || "";
			lftTanggal.value = record.tanggal || "";
			lftShift.value = record.shift || "";
			lftJamMulai.value = record.jamMulaiIstirahat || "";
			lftJamMulaiOperasi.value = record.jamMulaiOperasiKembali || "";
			setShiftReadonly(false);
			lftSubmitBtn.textContent = "Simpan Perubahan";
			lftCancelEditBtn.classList.remove("hidden");
			lftError.textContent = "";
			lftSuccess.textContent = "";
			window.scrollTo({ top: 0, behavior: "smooth" });
		}

		function syncByNik() {
			const normalizeNik = (value) => String(value || "").trim().replace(/[\s-]+/g, "");
			const nik = normalizeNik(lftNik.value);
			if (!nik) {
				clearSyncedFields();
				setShiftReadonly(false);
				return;
			}

			const match = fatigueRecords.find((r) => normalizeNik(r.nik) === nik);
			if (!match) {
				clearSyncedFields();
				setShiftReadonly(false);
				return;
			}

			lftNama.value = String(match.nama || "").trim();
			lftJabatan.value = String(match.jabatan || "").trim();
			lftDepartemen.value = String(match.departemen || "").trim();
			lftSettinganUnit.value = String(match.settinganUnit || "").trim();
			lftShift.value = String(match.shift || "").trim();
			setShiftReadonly(true);
		}

		function renderLftHistory() {
			if (records.length === 0) {
				lftHistory.innerHTML = `<p class="subtitle">Belum ada data laporan yang tersubmit.</p>`;
				return;
			}

			const rows = records
				.map(
					(item, index) => `
						<tr>
							<td>${index + 1}</td>
							<td>${escapeHtml(item.tanggalSubmit)}</td>
							<td>${escapeHtml(item.nama)}</td>
							<td>${escapeHtml(item.nik)}</td>
							<td>${escapeHtml(item.jabatan)}</td>
							<td>${escapeHtml(item.departemen)}</td>
							<td>${escapeHtml(item.settinganUnit)}</td>
							<td>${escapeHtml(item.tanggal)}</td>
							<td>${escapeHtml(item.shift)}</td>
							<td>${escapeHtml(item.jamMulaiIstirahat)}</td>
							<td>${escapeHtml(item.jamMulaiOperasiKembali)}</td>
							<td>
								<div class="table-actions">
									<button type="button" class="btn-small btn-edit lft-edit-btn" data-index="${index}">Edit</button>
									<button type="button" class="btn-small btn-delete lft-delete-btn" data-index="${index}">Hapus</button>
								</div>
							</td>
						</tr>
					`,
				)
				.join("");

			lftHistory.innerHTML = `
				<div class="fatigue-export-panel">
					<button type="button" class="btn-small btn-edit" id="lftExportExcelBtn">Export Excel (.xlsx)</button>
					<p id="lftExportInfo" class="fatigue-export-info"></p>
				</div>
				<div class="table-wrap">
					<table class="data-table" id="lftDataTable">
						<thead>
							<tr>
								<th>No</th>
								<th>Tanggal Submit</th>
								<th>Nama</th>
								<th>NIK</th>
								<th>Jabatan</th>
								<th>Departemen</th>
								<th>Settingan Unit</th>
								<th>Tanggal</th>
								<th>Shift</th>
								<th>Jam Mulai Istirahat</th>
								<th>Jam Mulai Operasi Kembali</th>
								<th>Aksi</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
				</div>
			`;

			lftHistory.querySelectorAll(".lft-edit-btn").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					if (!Number.isInteger(index) || index < 0 || index >= records.length) {
						return;
					}
					editIndex = index;
					populateEditForm(records[index]);
				});
			});

			lftHistory.querySelectorAll(".lft-delete-btn").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					if (!Number.isInteger(index) || index < 0 || index >= records.length) {
						return;
					}
					if (!window.confirm("Yakin ingin menghapus data ini?")) {
						return;
					}
					records.splice(index, 1);
					setLaporanFatigueTengah(records);
					if (editIndex >= index) {
						resetLftForm();
					}
					renderLftHistory();
				});
			});

			const lftExportExcelBtn = document.getElementById("lftExportExcelBtn");
			const lftExportInfo = document.getElementById("lftExportInfo");
			if (lftExportExcelBtn) {
				lftExportExcelBtn.addEventListener("click", () => {
					if (typeof XLSX === "undefined") {
						if (lftExportInfo) lftExportInfo.textContent = "Library Excel belum siap. Coba beberapa detik lagi.";
						return;
					}
					if (records.length === 0) {
						if (lftExportInfo) lftExportInfo.textContent = "Tidak ada data untuk diekspor.";
						return;
					}
					if (lftExportInfo) lftExportInfo.textContent = "";
					const sheetData = records.map((r, i) => ({
						"No": i + 1,
						"Tanggal Submit": r.tanggalSubmit || "",
						"Nama": r.nama || "",
						"NIK": r.nik || "",
						"Jabatan": r.jabatan || "",
						"Departemen": r.departemen || "",
						"Settingan Unit": r.settinganUnit || "",
						"Tanggal": r.tanggal || "",
						"Shift": r.shift || "",
						"Jam Mulai Istirahat": r.jamMulaiIstirahat || "",
						"Jam Mulai Operasi Kembali": r.jamMulaiOperasiKembali || "",
					}));
					const worksheet = XLSX.utils.json_to_sheet(sheetData);
					const workbook = XLSX.utils.book_new();
					XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Fatigue Tengah");
					const dateText = new Date().toISOString().slice(0, 10);
					XLSX.writeFile(workbook, `laporan_fatigue_tengah_shift_${dateText}.xlsx`);
				});
			}
		}

		lftNik.addEventListener("input", syncByNik);
		lftNik.addEventListener("change", syncByNik);
		lftCancelEditBtn.addEventListener("click", resetLftForm);
		lftForm.addEventListener("submit", (event) => {
			event.preventDefault();
			lftError.textContent = "";
			lftSuccess.textContent = "";

			const nik = String(lftNik.value || "").trim();
			if (!nik) {
				lftError.textContent = "NIK wajib diisi.";
				return;
			}

			if (!String(lftTanggal.value || "").trim()) {
				lftError.textContent = "Tanggal wajib diisi.";
				return;
			}

			if (!String(lftShift.value || "").trim()) {
				lftError.textContent = "Shift wajib dipilih.";
				return;
			}

			if (!String(lftJamMulai.value || "").trim()) {
				lftError.textContent = "Jam Mulai Istirahat wajib diisi.";
				return;
			}

			const recordData = {
				nik,
				nama: String(lftNama.value || "").trim(),
				jabatan: String(lftJabatan.value || "").trim(),
				departemen: String(lftDepartemen.value || "").trim(),
				settinganUnit: String(lftSettinganUnit.value || "").trim(),
				tanggal: String(lftTanggal.value || "").trim(),
				shift: String(lftShift.value || "").trim(),
				jamMulaiIstirahat: String(lftJamMulai.value || "").trim(),
				jamMulaiOperasiKembali: String(lftJamMulaiOperasi.value || "").trim(),
			};

			if (editIndex >= 0 && editIndex < records.length) {
				recordData.tanggalSubmit = records[editIndex].tanggalSubmit;
				records[editIndex] = recordData;
				lftSuccess.textContent = "Data laporan berhasil diperbarui.";
			} else {
				recordData.tanggalSubmit = new Date().toLocaleString("id-ID");
				records = [recordData, ...records];
				lftSuccess.textContent = "Data laporan berhasil disubmit.";
			}

			setLaporanFatigueTengah(records);
			resetLftForm();
			renderLftHistory();
		});

		renderLftHistory();
	}

	function renderHistoryFatigueContent() {
		if (!canAccessHistoryFatigue(session)) {
			renderDefaultContent("History Fatigue");
			return;
		}

		const users = getManagedUsers();
		const nikOptions = users
			.map((item) => String(item.noKaryawan || item.nik || "").trim())
			.filter((item, index, array) => item && array.indexOf(item) === index);
		let fatigueRecords = getFatigueHistoryRecords();

		function getFatigueFormMarkup() {
			return `
				<h2>History Fatigue</h2>
				<p class="subtitle">Isi NIK untuk sinkron otomatis Nama, Jabatan, dan Departemen dari Daftar User.</p>
				${users.length === 0 ? '<p class="error">Daftar User belum tersedia. Tambahkan user pada menu Daftar User terlebih dahulu.</p>' : ""}
				<form id="fatigueForm" class="form-grid" novalidate>
					<div class="field">
						<label for="fatigueNama">Nama</label>
						<input id="fatigueNama" name="nama" type="text" readonly />
					</div>
					<div class="field">
						<label for="fatigueNik">NIK</label>
						<input id="fatigueNik" name="nik" type="text" list="fatigueNikOptions" placeholder="Masukkan NIK" autocomplete="off" />
						<datalist id="fatigueNikOptions">
							${nikOptions.map((nik) => `<option value="${nik}"></option>`).join("")}
						</datalist>
					</div>
					<div class="field">
						<label for="fatigueJabatan">Jabatan</label>
						<input id="fatigueJabatan" name="jabatan" type="text" readonly />
					</div>
					<div class="field">
						<label for="fatigueDepartemen">Departemen</label>
						<input id="fatigueDepartemen" name="departemen" type="text" readonly />
					</div>
					<div class="field">
						<label for="fatigueShift">Shift</label>
						<select id="fatigueShift" name="shift" required>
							<option value="">Pilih Shift</option>
							<option value="Shift 1">Shift 1</option>
							<option value="Shift 2">Shift 2</option>
						</select>
					</div>
					<div class="field">
						<label for="fatigueTanggalInput">Tanggal</label>
						<input id="fatigueTanggalInput" name="tanggal" type="date" required />
					</div>
					<div class="field">
						<label for="fatigueSettinganUnit">Settingan Unit</label>
						<input id="fatigueSettinganUnit" name="settinganUnit" type="text" list="fatigueSettinganUnitOptions" placeholder="Ketik atau pilih unit" autocomplete="off" />
						<datalist id="fatigueSettinganUnitOptions">
							<option value=""></option>
							${getUnits().map((u) => `<option value="${escapeHtml(u.nomor)}">${escapeHtml(u.nomor)}${u.egi ? " - " + escapeHtml(u.egi) : ""}</option>`).join("")}
						</datalist>
					</div>
					<div class="field">
						<label for="fatigueJamTidur1">Jam Tidur 1</label>
						<input id="fatigueJamTidur1" name="jamTidur1" type="time" />
					</div>
					<div class="field">
						<label for="fatigueJamBangun1">Jam Bangun 1</label>
						<input id="fatigueJamBangun1" name="jamBangun1" type="time" />
					</div>

					<div class="field">
						<label for="fatigueJamTidur2">Jam Tidur 2</label>
						<input id="fatigueJamTidur2" name="jamTidur2" type="time" />
					</div>
					<div class="field">
						<label for="fatigueJamBangun2">Jam Bangun 2</label>
						<input id="fatigueJamBangun2" name="jamBangun2" type="time" />
					</div>

					<div class="field">
						<label for="fatigueJamTidur3">Jam Tidur 3</label>
						<input id="fatigueJamTidur3" name="jamTidur3" type="time" />
					</div>
					<div class="field">
						<label for="fatigueJamBangun3">Jam Bangun 3</label>
						<input id="fatigueJamBangun3" name="jamBangun3" type="time" />
					</div>

					<div class="field">
						<label for="fatigueMinumObat">Apakah Ada Minum Obat</label>
						<select id="fatigueMinumObat" name="minumObat">
							<option value="">Pilih Opsi</option>
							<option value="YA">YA</option>
							<option value="TIDAK">TIDAK</option>
						</select>
					</div>
					<div class="field">
						<label for="fatigueMasalah">Apakah Ada Masalah</label>
						<select id="fatigueMasalah" name="adaMasalah">
							<option value="">Pilih Opsi</option>
							<option value="YA">YA</option>
							<option value="TIDAK">TIDAK</option>
						</select>
					</div>
					<div class="field field-full hidden" id="fatigueMinumObatKeteranganField">
						<label for="fatigueMinumObatKeterangan">Keterangan Minum Obat</label>
						<textarea id="fatigueMinumObatKeterangan" name="keteranganMinumObat" rows="3" placeholder="Tulis keterangan minum obat..."></textarea>
					</div>
					<div class="field field-full hidden" id="fatigueMasalahKeteranganField">
						<label for="fatigueMasalahKeterangan">Keterangan Masalah</label>
						<textarea id="fatigueMasalahKeterangan" name="keteranganMasalah" rows="3" placeholder="Tulis keterangan masalah..."></textarea>
					</div>
					<div class="field">
						<label for="fatigueNikPengawas">NIK Pengawas Validasi</label>
						<input id="fatigueNikPengawas" name="nikPengawasValidasi" type="text" list="fatigueNikOptions" placeholder="Masukkan NIK Pengawas" autocomplete="off" />
					</div>
					<div class="field">
						<label for="fatigueNamaPengawas">Nama Pengawas Validasi</label>
						<input id="fatigueNamaPengawas" name="namaPengawasValidasi" type="text" readonly />
					</div>

					<div class="field field-full">
						<label for="fatigueTotalJam">Total Jam Tidur 12 Jam Terakhir</label>
						<input id="fatigueTotalJam" name="totalJamTidur12JamTerakhir" type="text" readonly value="0 Jam 0 Menit" />
					</div>
					<div class="field field-full">
						<label for="fatigueKekuranganJam">Hasil Kekurangan Jam Tidur (Minimum 6 Jam)</label>
						<input id="fatigueKekuranganJam" name="hasilKekuranganJamTidur" type="text" readonly value="6 Jam 0 Menit" />
					</div>
					<div class="field field-full">
						<label for="fatigueFollowUp">Follow Up</label>
						<textarea id="fatigueFollowUp" name="followUp" rows="3" placeholder="Tulis follow up..."></textarea>
					</div>
					<div class="inline-actions field-full">
						<button type="submit" id="submitFatigueBtn" class="btn-primary">Submit</button>
					</div>
				</form>
				<p id="fatigueError" class="error"></p>
				<p id="fatigueSuccess" class="subtitle"></p>
				<div id="fatigueHistory"></div>
			`;
		}

		function getFatigueFormElements() {
			return {
				fatigueForm: document.getElementById("fatigueForm"),
				fatigueNik: document.getElementById("fatigueNik"),
				fatigueNama: document.getElementById("fatigueNama"),
				fatigueJabatan: document.getElementById("fatigueJabatan"),
				fatigueDepartemen: document.getElementById("fatigueDepartemen"),
				fatigueShift: document.getElementById("fatigueShift"),
				fatigueTanggalInput: document.getElementById("fatigueTanggalInput"),
				fatigueSettinganUnit: document.getElementById("fatigueSettinganUnit"),
				fatigueMinumObat: document.getElementById("fatigueMinumObat"),
				fatigueMasalah: document.getElementById("fatigueMasalah"),
				fatigueMinumObatKeteranganField: document.getElementById("fatigueMinumObatKeteranganField"),
				fatigueMasalahKeteranganField: document.getElementById("fatigueMasalahKeteranganField"),
				fatigueMinumObatKeterangan: document.getElementById("fatigueMinumObatKeterangan"),
				fatigueMasalahKeterangan: document.getElementById("fatigueMasalahKeterangan"),
				fatigueNikPengawas: document.getElementById("fatigueNikPengawas"),
				fatigueNamaPengawas: document.getElementById("fatigueNamaPengawas"),
				fatigueTotalJam: document.getElementById("fatigueTotalJam"),
				fatigueKekuranganJam: document.getElementById("fatigueKekuranganJam"),
				fatigueFollowUp: document.getElementById("fatigueFollowUp"),
				submitFatigueBtn: document.getElementById("submitFatigueBtn"),
				fatigueError: document.getElementById("fatigueError"),
				fatigueSuccess: document.getElementById("fatigueSuccess"),
				fatigueHistory: document.getElementById("fatigueHistory"),
				fatigueJamTidur1: document.getElementById("fatigueJamTidur1"),
				fatigueJamBangun1: document.getElementById("fatigueJamBangun1"),
				fatigueJamTidur2: document.getElementById("fatigueJamTidur2"),
				fatigueJamBangun2: document.getElementById("fatigueJamBangun2"),
				fatigueJamTidur3: document.getElementById("fatigueJamTidur3"),
				fatigueJamBangun3: document.getElementById("fatigueJamBangun3"),
			};
		}

		contentArea.innerHTML = getFatigueFormMarkup();

		const {
			fatigueForm,
			fatigueNik,
			fatigueNama,
			fatigueJabatan,
			fatigueDepartemen,
			fatigueShift,
			fatigueTanggalInput,
			fatigueSettinganUnit,
			fatigueMinumObat,
			fatigueMasalah,
			fatigueMinumObatKeteranganField,
			fatigueMasalahKeteranganField,
			fatigueMinumObatKeterangan,
			fatigueMasalahKeterangan,
			fatigueNikPengawas,
			fatigueNamaPengawas,
			fatigueTotalJam,
			fatigueKekuranganJam,
			fatigueFollowUp,
			submitFatigueBtn,
			fatigueError,
			fatigueSuccess,
			fatigueHistory,
			fatigueJamTidur1,
			fatigueJamBangun1,
			fatigueJamTidur2,
			fatigueJamBangun2,
			fatigueJamTidur3,
			fatigueJamBangun3,
		} = getFatigueFormElements();

		const sleepPairs = [
			{
				sleep: fatigueJamTidur1,
				wake: fatigueJamBangun1,
			},
			{
				sleep: fatigueJamTidur2,
				wake: fatigueJamBangun2,
			},
			{
				sleep: fatigueJamTidur3,
				wake: fatigueJamBangun3,
			},
		];

		const workerProfileFields = [fatigueNama, fatigueJabatan, fatigueDepartemen];

		function clearFieldValues(fieldElements) {
			fieldElements.forEach((fieldElement) => {
				fieldElement.value = "";
			});
		}

		function clearProfileFields() {
			clearFieldValues(workerProfileFields);
		}

		function clearSupervisorFields() {
			clearFieldValues([fatigueNamaPengawas]);
		}

		function escapeHtml(value) {
			return String(value || "")
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;")
				.replaceAll("'", "&#39;");
		}

		function initFatigueDateSelectors() {
			const now = new Date();
			const yyyy = now.getFullYear();
			const mm = String(now.getMonth() + 1).padStart(2, "0");
			const dd = String(now.getDate()).padStart(2, "0");
			fatigueTanggalInput.value = `${yyyy}-${mm}-${dd}`;
		}

		function getFatigueSelectedDate() {
			return String(fatigueTanggalInput.value || "").trim();
		}

		function formatFatigueDateDisplay(dateValue) {
			const rawDate = String(dateValue || "").trim();
			if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
				return rawDate;
			}

			const [year, month, day] = rawDate.split("-");
			return `${day}-${month}-${year}`;
		}

		function toggleKeteranganField(selectElement, fieldElement, textareaElement) {
			const selectedValue = String(selectElement?.value || "").trim().toUpperCase();
			const showField = selectedValue === "YA";

			fieldElement.classList.toggle("hidden", !showField);
			textareaElement.required = showField;
			if (!showField) {
				textareaElement.value = "";
			}
		}

		function validateConditionalKeterangan() {
			const minumObatYa = String(fatigueMinumObat.value || "").trim().toUpperCase() === "YA";
			const masalahYa = String(fatigueMasalah.value || "").trim().toUpperCase() === "YA";

			if (minumObatYa && !String(fatigueMinumObatKeterangan.value || "").trim()) {
				fatigueError.textContent = "Keterangan Minum Obat wajib diisi jika memilih YA.";
				return false;
			}

			if (masalahYa && !String(fatigueMasalahKeterangan.value || "").trim()) {
				fatigueError.textContent = "Keterangan Masalah wajib diisi jika memilih YA.";
				return false;
			}

			fatigueError.textContent = "";
			return true;
		}

		function syncManagedUserFieldsByNik(nikValue, onClear, onSync) {
			const normalizedNik = String(nikValue || "").trim();

			if (!normalizedNik) {
				onClear();
				return null;
			}

			const selected = getManagedUserByNik(normalizedNik);
			if (!selected) {
				onClear();
				return null;
			}

			onSync(selected);
			return selected;
		}

		function syncUserByNik() {
			return syncManagedUserFieldsByNik(
				fatigueNik.value,
				clearProfileFields,
				(selected) => {
					fatigueNama.value = String(selected.namaLengkap || selected.username || "").trim();
					fatigueJabatan.value = String(selected.jabatan || "").trim();
					fatigueDepartemen.value = String(selected.departemen || "").trim();
				},
			);
		}

		function syncSupervisorByNik() {
			return syncManagedUserFieldsByNik(
				fatigueNikPengawas.value,
				clearSupervisorFields,
				(selected) => {
					fatigueNamaPengawas.value = String(selected.namaLengkap || selected.username || "").trim();
				},
			);
		}

		function getFatigueExportNikOptions() {
			return [...new Set(fatigueRecords.map((record) => String(record.nik || "").trim()).filter(Boolean))];
		}

		function getFatigueExportFilteredRecords() {
			const dariTgl = String(document.getElementById("fatigueExportDariTgl")?.value || "").trim();
			const sampaiTgl = String(document.getElementById("fatigueExportSampaiTgl")?.value || "").trim();
			const filterNik = String(document.getElementById("fatigueExportNik")?.value || "").trim();

			return fatigueRecords.filter((record) => {
				const tanggal = String(record.tanggal || "").trim();
				if (tanggal && dariTgl && tanggal < dariTgl) return false;
				if (tanggal && sampaiTgl && tanggal > sampaiTgl) return false;
				if (filterNik && String(record.nik || "").trim() !== filterNik) return false;
				return true;
			});
		}

		function buildFatigueExportSheetData(records) {
			return records.map((record, index) => ({
				"No": index + 1,
				"Tanggal Submit": record.tanggalSubmit || "",
				"Nama": record.nama || "",
				"NIK": record.nik || "",
				"Jabatan": record.jabatan || "",
				"Departemen": record.departemen || "",
				"Shift": record.shift || "",
				"Settingan Unit": record.settinganUnit || "",
				"Tanggal": formatFatigueDateDisplay(record.tanggal),
				"Jam Tidur 1": record.jamTidur1 || "",
				"Jam Bangun 1": record.jamBangun1 || "",
				"Jam Tidur 2": record.jamTidur2 || "",
				"Jam Bangun 2": record.jamBangun2 || "",
				"Jam Tidur 3": record.jamTidur3 || "",
				"Jam Bangun 3": record.jamBangun3 || "",
				"Total Jam Tidur 12 Jam Terakhir": record.totalJamTidur12JamTerakhir || "",
				"Hasil Kekurangan Jam Tidur": record.hasilKekuranganJamTidur || "",
				"Apakah Ada Minum Obat": record.minumObat || "",
				"Keterangan Minum Obat": record.keteranganMinumObat || "",
				"Apakah Ada Masalah": record.adaMasalah || "",
				"Keterangan Masalah": record.keteranganMasalah || "",
				"NIK Pengawas Validasi": record.nikPengawasValidasi || "",
				"Nama Pengawas Validasi": record.namaPengawasValidasi || "",
				"Follow Up": record.followUp || "",
			}));
		}

		function getFatigueDetailFields(record) {
			return [
				["Tanggal Submit", escapeHtml(record.tanggalSubmit)],
				["Nama", escapeHtml(record.nama)],
				["NIK", escapeHtml(record.nik)],
				["Jabatan", escapeHtml(record.jabatan)],
				["Departemen", escapeHtml(record.departemen)],
				["Shift", escapeHtml(record.shift)],
				["Settingan Unit", escapeHtml(record.settinganUnit)],
				["Tanggal", escapeHtml(formatFatigueDateDisplay(record.tanggal))],
				["Jam Tidur 1", escapeHtml(record.jamTidur1)],
				["Jam Bangun 1", escapeHtml(record.jamBangun1)],
				["Jam Tidur 2", escapeHtml(record.jamTidur2)],
				["Jam Bangun 2", escapeHtml(record.jamBangun2)],
				["Jam Tidur 3", escapeHtml(record.jamTidur3)],
				["Jam Bangun 3", escapeHtml(record.jamBangun3)],
				["Total Jam Tidur 12 Jam Terakhir", escapeHtml(record.totalJamTidur12JamTerakhir)],
				["Hasil Kekurangan Jam Tidur", escapeHtml(record.hasilKekuranganJamTidur)],
				["Apakah Ada Minum Obat", escapeHtml(record.minumObat)],
				["Keterangan Minum Obat", escapeHtml(record.keteranganMinumObat || "-")],
				["Apakah Ada Masalah", escapeHtml(record.adaMasalah)],
				["Keterangan Masalah", escapeHtml(record.keteranganMasalah || "-")],
				["NIK Pengawas Validasi", escapeHtml(record.nikPengawasValidasi)],
				["Nama Pengawas Validasi", escapeHtml(record.namaPengawasValidasi)],
				["Follow Up", escapeHtml(record.followUp || "-")],
			];
		}

		function openFatigueDetailModal(record) {
			const tableRows = getFatigueDetailFields(record)
				.map(
					([label, value]) => `
						<tr>
							<th>${label}</th>
							<td>${value}</td>
						</tr>
					`,
				)
				.join("");

			const existing = document.getElementById("fatigueDetailModal");
			if (existing) {
				existing.remove();
			}

			const modal = document.createElement("div");
			modal.id = "fatigueDetailModal";
			modal.className = "fatigue-detail-modal";
			modal.innerHTML = `
				<div class="fatigue-detail-dialog">
					<div class="fatigue-detail-header">
						<strong>Detail History Fatigue</strong>
						<button id="fatigueDetailModalClose" type="button" class="fatigue-detail-close">&times;</button>
					</div>
					<div class="fatigue-detail-body">
						<table class="fatigue-detail-table">
							<tbody>${tableRows}</tbody>
						</table>
					</div>
				</div>
			`;
			document.body.appendChild(modal);

			const closeModal = () => modal.remove();
			document.getElementById("fatigueDetailModalClose")?.addEventListener("click", closeModal);
			modal.addEventListener("click", (event) => {
				if (event.target === modal) {
					closeModal();
				}
			});
		}

		function renderFatigueHistoryTable() {
			if (fatigueRecords.length === 0) {
				fatigueHistory.innerHTML = `<p class="subtitle">Belum ada data history fatigue yang tersubmit.</p>`;
				return;
			}

			const rows = fatigueRecords
				.map((record, index) => {
					return `
						<tr>
							<td>${index + 1}</td>
							<td>${escapeHtml(record.tanggalSubmit)}</td>
							<td>${escapeHtml(record.nama)}</td>
							<td>${escapeHtml(record.nik)}</td>
							<td>${escapeHtml(record.jabatan)}</td>
							<td>${escapeHtml(record.departemen)}</td>
							<td>${escapeHtml(record.shift)}</td>
							<td>${escapeHtml(record.settinganUnit)}</td>
							<td>${escapeHtml(formatFatigueDateDisplay(record.tanggal))}</td>
							<td>${escapeHtml(record.minumObat)}</td>
							<td>${escapeHtml(record.adaMasalah)}</td>
							<td>${escapeHtml(record.nikPengawasValidasi)}</td>
							<td>${escapeHtml(record.namaPengawasValidasi)}</td>
							<td>${escapeHtml(record.totalJamTidur12JamTerakhir)}</td>
							<td>${escapeHtml(record.hasilKekuranganJamTidur)}</td>
							<td>${escapeHtml(record.followUp)}</td>
							<td>
								<div class="table-actions">
									<button type="button" class="btn-small btn-edit fatigue-detail-btn" data-index="${index}">Detail</button>
									<button type="button" class="btn-small btn-delete fatigue-delete-btn" data-index="${index}">Hapus</button>
								</div>
							</td>
						</tr>
					`;
				})
				.join("");

			const allNikOptions = getFatigueExportNikOptions();

			fatigueHistory.innerHTML = `
				<div class="fatigue-export-panel">
					<strong class="fatigue-export-title">Filter &amp; Export Excel</strong>
					<div class="fatigue-export-filters">
						<div class="fatigue-export-field">
							<label for="fatigueExportDariTgl">Tanggal Dari</label>
							<input type="date" id="fatigueExportDariTgl" />
						</div>
						<div class="fatigue-export-field">
							<label for="fatigueExportSampaiTgl">Tanggal Sampai</label>
							<input type="date" id="fatigueExportSampaiTgl" />
						</div>
						<div class="fatigue-export-field">
							<label for="fatigueExportNik">NIK</label>
							<select id="fatigueExportNik">
								<option value="">Semua NIK</option>
								${allNikOptions.map((nik) => `<option value="${escapeHtml(nik)}">${escapeHtml(nik)}</option>`).join("")}
							</select>
						</div>
						<button type="button" class="btn-small btn-edit fatigue-export-btn" id="fatigueExportExcelBtn">Export Excel (.xlsx)</button>
					</div>
					<p id="fatigueExportInfo" class="fatigue-export-info"></p>
				</div>
				<div class="table-wrap" id="fatigueHistoryTableWrap">
					<table class="data-table" id="fatigueHistoryDataTable">
						<thead>
							<tr>
								<th>No</th>
								<th>Tanggal Submit</th>
								<th>Nama</th>
								<th>NIK</th>
								<th>Jabatan</th>
								<th>Departemen</th>
								<th>Shift</th>
								<th>Settingan Unit</th>
								<th>Tanggal</th>
								<th>Minum Obat</th>
								<th>Ada Masalah</th>
								<th>NIK Pengawas Validasi</th>
								<th>Nama Pengawas Validasi</th>
								<th>Total Jam Tidur 12 Jam Terakhir</th>
								<th>Hasil Kekurangan Jam Tidur</th>
								<th>Follow Up</th>
								<th>Aksi</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
				</div>
			`;

			const fatigueExportExcelBtn = document.getElementById("fatigueExportExcelBtn");
			const fatigueExportInfo = document.getElementById("fatigueExportInfo");
			if (fatigueExportExcelBtn) {
				fatigueExportExcelBtn.addEventListener("click", () => {
					if (typeof XLSX === "undefined") {
						fatigueError.textContent = "Library Excel belum siap. Coba beberapa detik lagi.";
						return;
					}

					const filtered = getFatigueExportFilteredRecords();

					if (filtered.length === 0) {
						if (fatigueExportInfo) fatigueExportInfo.textContent = "Tidak ada data yang sesuai filter.";
						return;
					}
					if (fatigueExportInfo) fatigueExportInfo.textContent = "";

					const worksheet = XLSX.utils.json_to_sheet(buildFatigueExportSheetData(filtered));
					const workbook = XLSX.utils.book_new();
					XLSX.utils.book_append_sheet(workbook, worksheet, "History Fatigue");
					const dateText = new Date().toISOString().slice(0, 10);
					XLSX.writeFile(workbook, `history_fatigue_${dateText}.xlsx`);
				});
			}

			fatigueHistory.querySelectorAll(".fatigue-detail-btn").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					if (!Number.isInteger(index) || index < 0 || index >= fatigueRecords.length) {
						return;
					}
					openFatigueDetailModal(fatigueRecords[index]);
				});
			});

			fatigueHistory.querySelectorAll(".fatigue-delete-btn").forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.dataset.index);
					if (!Number.isInteger(index) || index < 0 || index >= fatigueRecords.length) {
						return;
					}

					const isConfirmed = window.confirm("Yakin ingin menghapus data history fatigue ini?");
					if (!isConfirmed) {
						return;
					}

					fatigueRecords.splice(index, 1);
					setFatigueHistoryRecords(fatigueRecords);
					renderFatigueHistoryTable();
				});
			});
		}

		function toMinutes(value) {
			const text = String(value || "").trim();
			if (!/^\d{2}:\d{2}$/.test(text)) {
				return null;
			}

			const [hoursText, minutesText] = text.split(":");
			const hours = Number(hoursText);
			const minutes = Number(minutesText);
			if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
				return null;
			}

			return hours * 60 + minutes;
		}

		function getSleepMinutes(sleepTime, wakeTime) {
			const sleepMinutes = toMinutes(sleepTime);
			const wakeMinutes = toMinutes(wakeTime);
			if (sleepMinutes === null || wakeMinutes === null) {
				return 0;
			}

			let diff = wakeMinutes - sleepMinutes;
			if (diff < 0) {
				diff += 24 * 60;
			}

			return diff;
		}

		function formatDuration(totalMinutes) {
			const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
			const hours = Math.floor(safeMinutes / 60);
			const minutes = safeMinutes % 60;
			return `${hours} Jam ${minutes} Menit`;
		}

		function updateTotalSleepHours() {
			const totalMinutes = sleepPairs.reduce((total, pair) => {
				return total + getSleepMinutes(pair.sleep.value, pair.wake.value);
			}, 0);
			const minimumSleepMinutes = 6 * 60;
			const sleepDeficitMinutes = Math.max(0, minimumSleepMinutes - totalMinutes);

			fatigueTotalJam.value = formatDuration(totalMinutes);
			fatigueKekuranganJam.value = formatDuration(sleepDeficitMinutes);
			fatigueKekuranganJam.classList.remove("fatigue-status-safe", "fatigue-status-deficit");
			fatigueKekuranganJam.classList.add(
				sleepDeficitMinutes === 0 ? "fatigue-status-safe" : "fatigue-status-deficit",
			);
		}

		function resetFatigueForm() {
			fatigueForm.reset();
			clearProfileFields();
			clearSupervisorFields();
			initFatigueDateSelectors();
			toggleKeteranganField(fatigueMinumObat, fatigueMinumObatKeteranganField, fatigueMinumObatKeterangan);
			toggleKeteranganField(fatigueMasalah, fatigueMasalahKeteranganField, fatigueMasalahKeterangan);
			updateTotalSleepHours();
			validateConditionalKeterangan();
		}

		function buildFatigueRecord() {
			return {
				tanggalSubmit: new Date().toLocaleString("id-ID"),
				nama: String(fatigueNama.value || "").trim(),
				nik: String(fatigueNik.value || "").trim(),
				jabatan: String(fatigueJabatan.value || "").trim(),
				departemen: String(fatigueDepartemen.value || "").trim(),
				shift: String(fatigueShift.value || "").trim(),
				tanggal: getFatigueSelectedDate(),
				settinganUnit: String(fatigueSettinganUnit.value || "").trim(),
				jamTidur1: String(fatigueJamTidur1.value || "").trim(),
				jamBangun1: String(fatigueJamBangun1.value || "").trim(),
				jamTidur2: String(fatigueJamTidur2.value || "").trim(),
				jamBangun2: String(fatigueJamBangun2.value || "").trim(),
				jamTidur3: String(fatigueJamTidur3.value || "").trim(),
				jamBangun3: String(fatigueJamBangun3.value || "").trim(),
				minumObat: String(fatigueMinumObat.value || "").trim(),
				keteranganMinumObat: String(fatigueMinumObatKeterangan.value || "").trim(),
				adaMasalah: String(fatigueMasalah.value || "").trim(),
				keteranganMasalah: String(fatigueMasalahKeterangan.value || "").trim(),
				nikPengawasValidasi: String(fatigueNikPengawas.value || "").trim(),
				namaPengawasValidasi: String(fatigueNamaPengawas.value || "").trim(),
				totalJamTidur12JamTerakhir: String(fatigueTotalJam.value || "").trim(),
				hasilKekuranganJamTidur: String(fatigueKekuranganJam.value || "").trim(),
				followUp: String(fatigueFollowUp.value || "").trim(),
			};
		}

		function validateFatigueSubmission() {
			const selectedWorker = syncUserByNik();
			if (!selectedWorker) {
				fatigueError.textContent = "NIK pekerja harus dipilih dari Daftar User.";
				return false;
			}

			if (!String(fatigueShift.value || "").trim()) {
				fatigueError.textContent = "Shift wajib dipilih.";
				return false;
			}

			if (!getFatigueSelectedDate()) {
				fatigueError.textContent = "Tanggal wajib dipilih.";
				return false;
			}

			const selectedSupervisor = syncSupervisorByNik();
			if (!selectedSupervisor) {
				fatigueError.textContent = "NIK Pengawas Validasi harus dipilih dari Daftar User.";
				return false;
			}

			return validateConditionalKeterangan();
		}

		function bindFatigueFormEvents() {
			fatigueNik.addEventListener("input", syncUserByNik);
			fatigueNikPengawas.addEventListener("input", syncSupervisorByNik);
			fatigueMinumObat.addEventListener("change", () => {
				toggleKeteranganField(
					fatigueMinumObat,
					fatigueMinumObatKeteranganField,
					fatigueMinumObatKeterangan,
				);
				validateConditionalKeterangan();
			});
			fatigueMasalah.addEventListener("change", () => {
				toggleKeteranganField(fatigueMasalah, fatigueMasalahKeteranganField, fatigueMasalahKeterangan);
				validateConditionalKeterangan();
			});
			fatigueMinumObatKeterangan.addEventListener("input", validateConditionalKeterangan);
			fatigueMasalahKeterangan.addEventListener("input", validateConditionalKeterangan);
			sleepPairs.forEach((pair) => {
				pair.sleep.addEventListener("input", updateTotalSleepHours);
				pair.wake.addEventListener("input", updateTotalSleepHours);
			});

			fatigueForm.addEventListener("submit", async (event) => {
				event.preventDefault();
				fatigueError.textContent = "";
				fatigueSuccess.textContent = "";

				await runWithButtonLoading(submitFatigueBtn, "Menyimpan...", async () => {
					if (!validateFatigueSubmission()) {
						return;
					}

					fatigueRecords = [buildFatigueRecord(), ...fatigueRecords];
					setFatigueHistoryRecords(fatigueRecords);
					renderFatigueHistoryTable();
					fatigueSuccess.textContent = "Data history fatigue berhasil disubmit.";
					resetFatigueForm();
				});
			});
		}

		function initializeFatigueForm() {
			toggleKeteranganField(fatigueMinumObat, fatigueMinumObatKeteranganField, fatigueMinumObatKeterangan);
			toggleKeteranganField(fatigueMasalah, fatigueMasalahKeteranganField, fatigueMasalahKeterangan);
			initFatigueDateSelectors();
			updateTotalSleepHours();
			validateConditionalKeterangan();
			renderFatigueHistoryTable();
			bindFatigueFormEvents();
		}

		initializeFatigueForm();
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
												${item.canProcessByPic ? '<p class="task-edit-hint"><strong>Aksi:</strong> Klik card untuk lihat detail & proses tindak lanjut.</p>' : ""}
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

		function renderTaskPhotos(photos) {
			if (!Array.isArray(photos) || photos.length === 0) {
				return '<p class="subtitle">Tidak ada foto.</p>';
			}

			const photoHtml = photos
				.map((photo) => {
					if (!photo?.dataUrl) {
						return `<div class="photo-card"><p class="subtitle">${photo?.name || "Foto"}</p></div>`;
					}

					return `
						<div class="photo-card">
							<img src="${photo.dataUrl}" alt="${photo.name || "Foto"}" class="photo-thumb" />
							<p class="photo-caption">${photo.name || "Foto"}</p>
						</div>
					`;
				})
				.join("");

			return `<div class="photo-grid">${photoHtml}</div>`;
		}

		function renderTaskDetailSummary(record, source) {
			if (source === "kta") {
				return `
					<div class="detail-grid">
						<p><strong>Tanggal Temuan:</strong> ${escapeAchievementHtml(record.tanggalTemuan || "-")}</p>
						<p><strong>Kategori Temuan:</strong> ${escapeAchievementHtml(record.kategoriTemuan || "-")}</p>
						<p><strong>Lokasi Temuan:</strong> ${escapeAchievementHtml(record.lokasiTemuan || "-")}</p>
						<p><strong>Detail Lokasi:</strong> ${escapeAchievementHtml(record.detailLokasiTemuan || "-")}</p>
						<p><strong>Risk Level:</strong> ${escapeAchievementHtml(record.riskLevel || "-")}</p>
						<p><strong>PIC:</strong> ${escapeAchievementHtml(record.namaPic || "-")}</p>
						<p><strong>Status:</strong> ${escapeAchievementHtml(record.status || "-")}</p>
					</div>
					<p><strong>Detail Temuan:</strong> ${escapeAchievementHtml(record.detailTemuan || "-")}</p>
					<h4>Foto Temuan</h4>
					${renderTaskPhotos(record.fotoTemuan)}
				`;
			}

			return `
				<div class="detail-grid">
					<p><strong>Tanggal Temuan:</strong> ${escapeAchievementHtml(record.tanggalTemuan || "-")}</p>
					<p><strong>Jam Temuan:</strong> ${escapeAchievementHtml(record.jamTemuan || "-")}</p>
					<p><strong>Kategori Temuan:</strong> ${escapeAchievementHtml(record.kategoriTemuan || "-")}</p>
					<p><strong>Lokasi Temuan:</strong> ${escapeAchievementHtml(record.lokasiTemuan || "-")}</p>
					<p><strong>Detail Lokasi:</strong> ${escapeAchievementHtml(record.detailLokasiTemuan || "-")}</p>
					<p><strong>Risk Level:</strong> ${escapeAchievementHtml(record.riskLevel || "-")}</p>
					<p><strong>PIC:</strong> ${escapeAchievementHtml(record.namaPja || record.namaPic || "-")}</p>
					<p><strong>Pelaku TTA:</strong> ${escapeAchievementHtml(getUserFullNameFromIdentifier(record.namaPelakuTta))}</p>
					<p><strong>Status:</strong> ${escapeAchievementHtml(record.status || "-")}</p>
				</div>
				<p><strong>Detail Temuan:</strong> ${escapeAchievementHtml(record.detailTemuan || "-")}</p>
				<h4>Foto Temuan</h4>
				${renderTaskPhotos(record.fotoTemuan)}
			`;
		}

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
					${renderTaskDetailSummary(record, source)}
					<form id="taskProcessForm" class="form-grid" novalidate>
						<div class="field field-full">
							<label for="taskTindakanPerbaikan">Tindakan Perbaikan</label>
							<textarea id="taskTindakanPerbaikan" name="tindakanPerbaikan" rows="3" required>${record.tindakanPerbaikan || ""}</textarea>
						</div>
						<div class="field field-full">
							<label for="taskFotoPerbaikan">Foto Perbaikan (Opsional)</label>
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
				const taskFotoPerbaikanField = document.getElementById("taskFotoPerbaikan");
				const taskProcessError = document.getElementById("taskProcessError");
				const taskProcessSuccess = document.getElementById("taskProcessSuccess");
				const taskProcessSubmitBtn = taskProcessForm.querySelector('button[type="submit"]');
				taskFotoPerbaikanField.required = false;

				closeTaskProcess.addEventListener("click", () => {
					taskProcessPanel.classList.add("hidden");
					taskProcessPanel.innerHTML = "";
				});

				taskProcessForm.addEventListener("submit", async (event) => {
					event.preventDefault();
					taskProcessError.textContent = "";
					taskProcessSuccess.textContent = "";

					await runWithButtonLoading(taskProcessSubmitBtn, "Menyimpan...", async () => {
					const formData = new FormData(taskProcessForm);
					const tindakanPerbaikan = String(formData.get("tindakanPerbaikan") || "").trim();
					const tanggalPerbaikan = String(formData.get("tanggalPerbaikan") || "").trim();
					const status = String(formData.get("status") || "").trim();
					const fotoPerbaikanFiles = document.getElementById("taskFotoPerbaikan").files || [];
					await runWithFormControlsDisabled(taskProcessForm, async () => {

					if (!tindakanPerbaikan || !tanggalPerbaikan || !status) {
						taskProcessError.textContent = "Lengkapi Tindakan Perbaikan, Tanggal Perbaikan, dan Status.";
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

		if (menuName === "Pengaturan Cuti") {
			renderLeaveSettingsContent();
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

		if (menuName === "Daftar Unit") {
			renderUnitContent();
			return;
		}

		if (menuName === "History Fatigue") {
			renderHistoryFatigueContent();
			return;
		}

		if (menuName === "Laporan Fatigue Tengah Shift") {
			renderLaporanFatigueTengahShiftContent();
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
		try {
			await hydrateRecordsFromBackend();
		} catch (error) {
			console.error("Hydration gagal saat startup, lanjutkan render lokal:", error);
		}
	}
	renderApp();
	updateBackendStatus();
	setInterval(updateBackendStatus, 30000);
}

startApp();
