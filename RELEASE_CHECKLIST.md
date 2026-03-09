# Release Checklist

## 1) Pre-flight Lokal

- Jalankan `npm install`
- Jalankan syntax check: `npm run check`
- Jalankan backend lokal: `npm start`
- Jalankan API smoke test (terminal lain): `npm run smoke`

## 2) Konfigurasi Deploy Backend

Pastikan di service environment variables:

- `HOST=0.0.0.0`
- `CORS_ALLOWED_ORIGINS` diisi jika frontend beda domain

Jika pakai Supabase (direkomendasikan):

- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
- `SUPABASE_TABLE=wbs_storage` (opsional)
- `SUPABASE_RECORD_KEY=she_wbs` (opsional)

Jika tetap pakai file storage lokal:

- `DATA_DIR=/var/data`
- `STORAGE_FILE_PATH=/var/data/storage.json`

Dan persistent disk terpasang:

- mount path: `/var/data`
- size: minimal `1GB`

## 3) Konfigurasi Deploy Frontend Vercel

- Deploy project frontend sebagai static site
- Set `meta` `api-base-url` di `index.html` ke URL backend produksi
- Pastikan domain Vercel sudah masuk ke `CORS_ALLOWED_ORIGINS`

## 4) Verifikasi Post-Deploy

- Health endpoint: `/api/health` harus `ok`
- Login berhasil mengembalikan token pada `data.token`
- Submit KTA/TTA berhasil
- Task Process update status berhasil
- Saat token invalid/expired, UI kembali ke login dengan pesan sesi berakhir

## 5) Handover Operasional

- Simpan URL produksi backend
- Simpan URL frontend Vercel
- Simpan kredensial admin awal secara aman
- Catat domain frontend untuk whitelist `CORS_ALLOWED_ORIGINS`
- Jika pakai Supabase, aktifkan backup/PITR sesuai kebutuhan
- Jika pakai file storage, jadwalkan backup berkala file `/var/data/storage.json`
