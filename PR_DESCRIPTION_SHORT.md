## Summary

- Menambahkan auth bearer token untuk API dan response login dengan `data.token`.
- Menambahkan CRUD endpoint per-item untuk KTA, TTA, users, departments, dan PICs.
- Mengubah target harian kelompok jabatan `PENGAWAS` dan `LEVEL 1 MGT` dari `2 KTA + 1 TTA` menjadi `1 KTA + 2 TTA`.
- Frontend dipindah ke strict API flow + auto logout saat `401`.
- Menambahkan loading + lock form untuk cegah double-submit (login, KTA, TTA, task process, user, departemen, PIC).
- Menambahkan guardrail rilis: `npm run check`, `npm run smoke`, checklist rilis, dan template PR.
- Update konfigurasi Render (`healthCheckPath` + `STORAGE_FILE_PATH`).

## Validation

- ✅ `npm run check`
- ✅ `npm run smoke`
- ✅ Protected endpoint tanpa token mengembalikan `401`
