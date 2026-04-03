## Summary

- Menambahkan menu `Daftar Unit` untuk kelola data unit (`Nomor Unit` dan `EGI`).
- Menambahkan menu `Laporan Fatigue Tengah Shift` dengan input, riwayat, edit, hapus, dan export `.xlsx`.
- Menambahkan sinkronisasi otomatis data dari `History Fatigue` berdasarkan NIK (Nama, Jabatan, Departemen, Settingan Unit, Shift).
- Menambahkan field `Settingan Unit` di `History Fatigue` dan membuatnya searchable (ketik + pilih dari daftar).
- Menambahkan sinkronisasi Shift otomatis dari data `History Fatigue` saat NIK cocok.
- Memperbaiki bug agar data riwayat laporan langsung muncul setelah submit.
- Memperbaiki sinkronisasi `History Fatigue` dan `Laporan Fatigue Tengah` agar cache lokal tidak terhapus saat server mengembalikan data kosong, lalu memulihkan atau merge data sebelum push ulang.

## Validation

- ✅ Tidak ada error sintaks pada `script.js` setelah perubahan
- ✅ Submit Laporan Fatigue Tengah Shift menampilkan data riwayat secara langsung
- ✅ Sinkronisasi NIK dan Shift berjalan saat input NIK cocok
- ✅ Refresh/startup tidak lagi menghilangkan riwayat fatigue saat backend kosong atau belum sinkron
