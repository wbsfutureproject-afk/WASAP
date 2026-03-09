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
- `SUPABASE_URL` (opsional, URL project Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (opsional, service role key Supabase)
- `SUPABASE_TABLE` (opsional, default: `wbs_storage`)
- `SUPABASE_RECORD_KEY` (opsional, default: `she_wbs`)

Jika `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diisi, backend akan memakai Supabase sebagai storage utama.

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

### Opsi C: Frontend Vercel + Backend dengan Supabase

1. Buat tabel storage di Supabase SQL Editor:

```sql
create table if not exists public.wbs_storage (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

2. Deploy backend Node.js (Render/Railway/Fly.io) dengan env var:
   - `SUPABASE_URL=https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
   - `SUPABASE_TABLE=wbs_storage` (opsional)
   - `SUPABASE_RECORD_KEY=she_wbs` (opsional)
   - `CORS_ALLOWED_ORIGINS=https://<project-vercel>.vercel.app`

3. Di frontend, set `meta` API base URL pada `index.html`:

```html
<meta name="api-base-url" content="https://backend-anda.example.com" />
```

4. Deploy frontend ke Vercel sebagai static site.

## 4) Endpoint API

### Health & Auth

- `GET /api/health`
- `POST /api/auth/login`
  - body: `{ "loginIdentifier": "username-atau-email", "password": "..." }`
  - response: `{ "data": { "username", "role", "token" } }`

### KTA

- `GET /api/kta`
- `PUT /api/kta` (bulk replace)
- `GET /api/kta/:noId`
- `POST /api/kta`
- `PUT /api/kta/:noId`
- `DELETE /api/kta/:noId`

### TTA

- `GET /api/tta`
- `PUT /api/tta` (bulk replace)
- `GET /api/tta/:noId`
- `POST /api/tta`
- `PUT /api/tta/:noId`
- `DELETE /api/tta/:noId`

### Master Data

- `GET /api/master`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:username`
- `PUT /api/users/:username`
- `DELETE /api/users/:username`
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:name`
- `DELETE /api/departments/:name`
- `GET /api/pics`
- `POST /api/pics`
- `PUT /api/pics/:name`
- `DELETE /api/pics/:name`

Semua endpoint `/api/*` selain `/api/health` dan `/api/auth/login` membutuhkan header:

- `Authorization: Bearer <token>`

## 5) Development Mode

```bash
npm run dev
```

## 6) Quality Gate

```bash
npm run check
```

Melakukan syntax check untuk `server.js` dan `script.js`.

```bash
npm run smoke
```

Menjalankan API smoke test end-to-end (health, login, create/update/delete KTA/TTA, serta verifikasi 401 tanpa token).

Secara default smoke test mengarah ke `http://127.0.0.1:3000`, dapat dioverride dengan env var:

- `SMOKE_BASE_URL`
- `SMOKE_LOGIN_IDENTIFIER`
- `SMOKE_PASSWORD`

## 7) Penyimpanan Data

Default: data disimpan ke file `data/storage.json`.

Jika `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` tersedia, backend otomatis menyimpan dan membaca data dari Supabase (tabel `wbs_storage` by default).

## 8) Checklist Rilis

Lihat panduan operasional di `RELEASE_CHECKLIST.md`.
