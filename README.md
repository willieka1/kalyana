# Kalyana Platform — Functional Dashboard v6.4.0 — Reference Match

Platform kolaborasi UMKM dan mahasiswa kreatif. Versi ini mengunci tampilan **Project Usaha** dan **Pekerjaan Saya** lebih dekat ke dua screenshot referensi: sidebar 247 px, topbar 80 px, susunan 3 kartu statistik, kartu grafik, donut, progress, daftar project, form UMKM, serta kartu pekerjaan mahasiswa. Fungsi tetap aktif untuk demo tugas akhir/prototype.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000/auth`.

### Akun demo

- UMKM — `umkm@kalyana.test` / `demo123`
- Mahasiswa — `talent@kalyana.test` / `demo123`
- Super Admin — `admin@kalyana.test` / `admin234`

Data demo awal dibuat agar halaman **Project Saya / Pekerjaan Saya** sama dengan referensi:
- 4 project
- progress rata-rata 58%
- total nilai project Rp4.300.000
- 1 Menunggu, 2 Berjalan, 1 Selesai

## Fungsi yang sudah aktif

### UMKM
- Login dan registrasi.
- Dashboard ringkasan usaha.
- Membuat project baru.
- Memilih mahasiswa saat membuat project.
- Melihat grafik status dan progress setiap project.
- Mengubah project Menunggu menjadi Berjalan dengan klik badge **Menunggu** pada daftar project.
- Mencari mahasiswa dari search dashboard.
- Melihat status pembayaran per project.
- Mencatat pembayaran demo sebagai lunas.
- Mengubah profil usaha dan menyimpannya ke backend.

### Mahasiswa
- Login dan registrasi.
- Dashboard pekerjaan.
- Melihat seluruh pekerjaan yang ditugaskan.
- Mengubah progress pekerjaan 0–100% dengan klik baris pekerjaan; editor progress dibuka sebagai dialog agar layout utama tetap sama seperti referensi.
- Progress 100% otomatis menjadi status Selesai.
- Melihat peluang project.
- Mengajukan minat dan mencegah pengajuan ganda.
- Menambah dan menghapus item portofolio.
- Melihat pendapatan bersih dari project yang sudah dibayar.
- Mengubah profil mahasiswa dan menyimpannya ke backend.

### Super Admin
- Melihat jumlah UMKM, mahasiswa, project aktif, dan nilai project.
- Monitoring daftar pengguna.
- Monitoring semua project.
- Monitoring status pembayaran/transaksi secara read-only.

## Penyimpanan data

Saat dijalankan lokal, perubahan disimpan di `data/kalyana-db.json` sehingga tidak hilang saat server direstart.

Untuk test otomatis dan deployment Vercel, backend memakai memory store. Karena filesystem Vercel Functions tidak cocok untuk database persisten, deployment produksi sebaiknya dihubungkan ke PostgreSQL/Supabase/MySQL/Firebase atau database persisten lainnya.

## Test

```bash
npm test
```

Test mencakup halaman, login tiga role, pembuatan project, update progress, peluang project, portofolio, profil, pembayaran demo, dan monitoring admin.

## File utama

- `dashboard.html`
- `css/dashboard-kalyana-final.css`
- `css/dashboard-typography.css`
- `css/dashboard-reference-v6.4.css`
- `scripts/dashboard.js`
- `backend/server.js`
- `backend/store.js`
- `backend/seed-data.js`

## Catatan pembayaran

Tombol **Catat lunas** adalah simulasi workflow pembayaran untuk prototype. Belum memproses uang sungguhan dan belum terhubung ke Midtrans/Xendit/payment gateway.
