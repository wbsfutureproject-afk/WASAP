## Summary

PR ini menambahkan modul operasional baru untuk fatigue: pengelolaan daftar unit, form laporan fatigue tengah shift, sinkronisasi data otomatis berdasarkan NIK dari History Fatigue, serta export Excel untuk kebutuhan rekap.

Selain penambahan fitur, PR ini juga memperbaiki alur sinkronisasi field, bug runtime yang sempat membuat data belum tampil setelah submit, serta bug sinkronisasi yang dapat membuat history hilang ketika backend mengembalikan data kosong.

## What Changed

### Menu & Akses

- Menambahkan menu `Daftar Unit`.
- Menambahkan menu `Laporan Fatigue Tengah Shift`.
- Menu ditambahkan ke role `Super Admin` dan akses fatigue user yang sudah di-whitelist.

### Daftar Unit

- Menambahkan CRUD unit dengan field:
  - `Nomor Unit` (required)
  - `EGI` (optional)
- Data disimpan di localStorage key `she_wbs_units`.
- Nomor unit dari menu ini menjadi sumber opsi `Settingan Unit` pada `History Fatigue`.

### History Fatigue

- Menambahkan field `Settingan Unit` pada form input.
- Field `Settingan Unit` diubah menjadi searchable input (ketik + pilih dari daftar / datalist).
- Menambahkan kolom `Settingan Unit` pada tabel riwayat fatigue.
- Menambahkan `Settingan Unit` ke detail dan data export fatigue.

### Laporan Fatigue Tengah Shift

- Menambahkan form baru berisi:
  - `Nama` (readonly)
  - `NIK`
  - `Jabatan` (readonly)
  - `Departemen` (readonly)
  - `Settingan Unit` (readonly)
  - `Tanggal`
  - `Shift`
  - `Jam Mulai Istirahat`
  - `Jam Mulai Operasi Kembali`
- Menambahkan riwayat laporan dengan aksi:
  - `Edit`
  - `Hapus`
- Menambahkan mode edit dengan tombol `Batal`.
- Menambahkan export `.xlsx` untuk data laporan.
- Data disimpan di localStorage key `she_wbs_laporan_fatigue_tengah`.

### Sinkronisasi NIK

- Saat NIK diisi, field berikut tersinkron dari data `History Fatigue`:
  - `Nama`
  - `Jabatan`
  - `Departemen`
  - `Settingan Unit`
  - `Shift`
- Menambahkan normalisasi NIK saat matching (lebih toleran terhadap spasi dan tanda `-`).
- Shift dikunci (`disabled`) ketika sinkronisasi dari NIK berhasil.

### Bug Fix

- Memperbaiki event binding sinkronisasi NIK yang sebelumnya tidak terpanggil.
- Memperbaiki bug runtime akibat fungsi `setShiftReadonly` belum terdefinisi, yang menyebabkan riwayat tidak tampil setelah submit.
- Setelah perbaikan, data riwayat muncul langsung setelah submit.
- Memperbaiki sinkronisasi `History Fatigue` agar cache lokal tidak langsung tertimpa saat backend kosong, termasuk pemulihan dari backup lokal dan merge data lokal yang belum tersinkron.
- Memperbaiki sinkronisasi `Laporan Fatigue Tengah Shift` agar refresh/startup tidak menghapus data lokal saat backend belum sinkron.

### Styling

- Menambahkan dukungan responsif untuk `#fatigueHistory` agar tabel lebih nyaman di mobile.

## Validation

- ✅ Tidak ada error sintaks di `script.js` setelah perubahan.
- ✅ Submit data `Laporan Fatigue Tengah Shift` berhasil dan riwayat langsung tampil.
- ✅ Sinkronisasi NIK otomatis mengisi field terkait termasuk Shift.
- ✅ Export laporan ke format `.xlsx` berhasil.
- ✅ Refresh/startup tidak lagi menghilangkan riwayat fatigue saat backend kosong atau belum sinkron.

## Reviewer Focus

- Verifikasi alur `Daftar Unit` (tambah, edit, hapus) dan sinkron opsi ke `History Fatigue`.
- Verifikasi sinkronisasi NIK di `Laporan Fatigue Tengah Shift`.
- Verifikasi Shift lock/unlock saat sinkronisasi berhasil/gagal.
- Verifikasi data muncul di riwayat setelah submit, termasuk mode edit dan hapus.
- Verifikasi refresh/startup saat backend kosong tidak menghapus cache lokal pada `History Fatigue` dan `Laporan Fatigue Tengah Shift`.
- Verifikasi export `.xlsx` menghasilkan kolom data yang lengkap.
