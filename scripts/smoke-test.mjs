const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const loginIdentifier = process.env.SMOKE_LOGIN_IDENTIFIER || "superadmin";
const password = process.env.SMOKE_PASSWORD || "superadmin";

function nowSuffix() {
	const date = new Date();
	const pad = (value) => String(value).padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function request(path, options = {}) {
	const response = await fetch(`${baseUrl}${path}`, options);
	const contentType = String(response.headers.get("content-type") || "").toLowerCase();
	const payload = contentType.includes("application/json")
		? await response.json().catch(() => null)
		: await response.text().catch(() => "");

	if (!response.ok) {
		const message = payload && typeof payload === "object"
			? payload.message || JSON.stringify(payload)
			: String(payload || `HTTP ${response.status}`);
		throw new Error(`${path} -> ${response.status}: ${message}`);
	}

	return payload;
}

async function main() {
	const suffix = nowSuffix();
	const ktaId = `KTA-SMOKE-${suffix}`;
	const ttaId = `TTA-SMOKE-${suffix}`;
	let token = "";
	let createdKta = false;
	let createdTta = false;

	console.log(`Smoke test start -> ${baseUrl}`);

	await request("/api/health", { method: "GET" });

	const login = await request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ loginIdentifier, password }),
	});

	token = String(login?.data?.token || "").trim();
	if (!token) {
		throw new Error("Login berhasil tetapi token tidak ditemukan pada response data.token");
	}

	const authHeaders = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${token}`,
	};

	try {
		await request("/api/kta", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({
				data: {
					noId: ktaId,
					tanggalLaporan: "2026-03-04",
					namaPelapor: "Smoke Tester",
					jabatan: "OPERATOR",
					departemen: "Mining",
					perusahaan: "PT Test",
					tanggalTemuan: "2026-03-04",
					kategoriTemuan: "Tindakan Tidak Aman",
					lokasiTemuan: "Mining",
					detailLokasiTemuan: "Area A",
					riskLevel: "Low",
					namaPic: "PIC Test",
					detailTemuan: "Smoke test KTA",
					fotoTemuan: [],
					perbaikanLangsung: "Tidak",
					tindakanPerbaikan: "",
					fotoPerbaikan: [],
					tanggalPerbaikan: "",
					status: "Open",
				},
			}),
		});
		createdKta = true;

		await request(`/api/kta/${encodeURIComponent(ktaId)}`, {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({
				data: {
					noId: ktaId,
					tanggalLaporan: "2026-03-04",
					namaPelapor: "Smoke Tester",
					jabatan: "OPERATOR",
					departemen: "Mining",
					perusahaan: "PT Test",
					tanggalTemuan: "2026-03-04",
					kategoriTemuan: "Tindakan Tidak Aman",
					lokasiTemuan: "Mining",
					detailLokasiTemuan: "Area A",
					riskLevel: "Low",
					namaPic: "PIC Test",
					detailTemuan: "Smoke test KTA update",
					fotoTemuan: [],
					perbaikanLangsung: "Ya",
					tindakanPerbaikan: "Tindak lanjut smoke",
					fotoPerbaikan: [],
					tanggalPerbaikan: "2026-03-04",
					status: "Progress",
				},
			}),
		});

		await request("/api/tta", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({
				data: {
					noId: ttaId,
					tanggalLaporan: "2026-03-04",
					namaPelapor: "Smoke Tester",
					jabatan: "OPERATOR",
					departemen: "Mining",
					perusahaan: "PT Test",
					tanggalTemuan: "2026-03-04",
					jamTemuan: "10:00",
					kategoriTemuan: "Tindakan Tidak Aman",
					lokasiTemuan: "Mining",
					detailLokasiTemuan: "Area B",
					riskLevel: "Low",
					namaPja: "PIC Test",
					namaPelakuTta: "-",
					jabatanPelakuTta: "-",
					departemenPelakuTta: "-",
					perusahaanPelakuTta: "-",
					detailTemuan: "Smoke test TTA",
					fotoTemuan: [],
					perbaikanLangsung: "Tidak",
					tindakanPerbaikan: "",
					fotoPerbaikan: [],
					tanggalPerbaikan: "",
					status: "Open",
				},
			}),
		});
		createdTta = true;

		await request(`/api/tta/${encodeURIComponent(ttaId)}`, {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({
				data: {
					noId: ttaId,
					tanggalLaporan: "2026-03-04",
					namaPelapor: "Smoke Tester",
					jabatan: "OPERATOR",
					departemen: "Mining",
					perusahaan: "PT Test",
					tanggalTemuan: "2026-03-04",
					jamTemuan: "10:00",
					kategoriTemuan: "Tindakan Tidak Aman",
					lokasiTemuan: "Mining",
					detailLokasiTemuan: "Area B",
					riskLevel: "Low",
					namaPja: "PIC Test",
					namaPelakuTta: "-",
					jabatanPelakuTta: "-",
					departemenPelakuTta: "-",
					perusahaanPelakuTta: "-",
					detailTemuan: "Smoke test TTA update",
					fotoTemuan: [],
					perbaikanLangsung: "Ya",
					tindakanPerbaikan: "Tindak lanjut smoke",
					fotoPerbaikan: [],
					tanggalPerbaikan: "2026-03-04",
					status: "Progress",
				},
			}),
		});
	} finally {
		if (token && createdKta) {
			await request(`/api/kta/${encodeURIComponent(ktaId)}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			}).catch(() => undefined);
		}

		if (token && createdTta) {
			await request(`/api/tta/${encodeURIComponent(ttaId)}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			}).catch(() => undefined);
		}
	}

	let unauthStatusOk = false;
	try {
		await request("/api/kta", { method: "GET" });
	} catch (error) {
		unauthStatusOk = String(error.message || "").includes("/api/kta -> 401:");
	}

	if (!unauthStatusOk) {
		throw new Error("Expected unauthorized GET /api/kta without token to return 401");
	}

	console.log("Smoke test PASSED");
}

main().catch((error) => {
	console.error("Smoke test FAILED:", error.message || error);
	process.exit(1);
});
