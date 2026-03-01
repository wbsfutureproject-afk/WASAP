# SHE WBS (Frontend + Backend)

Aplikasi ini adalah web app full-stack:
- Frontend: `index.html`, `style.css`, `script.js`
- Backend: `server.js` (Node.js + Express)

## 1) Jalankan Lokal

```bash
npm install
npm start
```

Buka `http://localhost:3000`.

## 2) Konfigurasi Agar Bisa Diakses Internet

Backend sudah mendukung:
- bind ke `0.0.0.0` (default) agar bisa diakses dari luar container/VM
- port dari environment variable `PORT`
- CORS untuk akses frontend dari domain lain

Environment variable yang didukung:

- `PORT` (contoh: `3000`)
- `HOST` (default: `0.0.0.0`)
- `DATA_DIR` (opsional, default: `./data`)
- `STORAGE_FILE_PATH` (opsional, override lokasi file data)
- `CORS_ALLOWED_ORIGINS` (opsional, pisahkan dengan koma)
  - contoh: `https://frontend-anda.vercel.app,https://app.perusahaan.com`
  - jika kosong, API mengizinkan origin apa pun (`*`)

## 3) Deploy ke Internet (Direkomendasikan)

### Opsi A: Frontend + Backend jadi satu service

Paling mudah. Deploy repo ini ke Render/Railway/Fly.io:
1. Push project ke GitHub.
2. Di Render, pilih **New +** -> **Blueprint**.
3. Pilih repository ini (Render akan membaca `render.yaml`).
4. Klik **Apply** untuk deploy.

Karena frontend dilayani oleh backend yang sama, tidak perlu ubah konfigurasi frontend.

Project ini sudah menyertakan `render.yaml` dengan:
- service Node.js (`npm start`)
- `HOST=0.0.0.0`
- persistent disk mount ke `/var/data`
- `DATA_DIR=/var/data` agar `storage.json` tersimpan persisten

### Opsi B: Frontend dan Backend beda domain

1. Deploy backend (mis. Render) hingga dapat URL, contoh:
   - `https://wbs-api.onrender.com`
2. Set `CORS_ALLOWED_ORIGINS` di backend ke domain frontend Anda.
3. Di frontend, isi meta `api-base-url` pada `index.html`:

```html
<meta name="api-base-url" content="https://wbs-api.onrender.com" />
```

4. Deploy frontend (mis. Vercel/Netlify).

## 4) Endpoint API

- `GET /api/health`
- `POST /api/auth/login`
- `GET/PUT /api/kta`
- `GET/PUT /api/tta`
- `GET/PUT /api/master`

## 5) Development Mode

```bash
npm run dev
```

## 6) Penyimpanan Data

Data disimpan ke file `data/storage.json`.

Untuk produksi skala besar (multi instance), disarankan migrasi ke database (PostgreSQL/MySQL/MongoDB).
