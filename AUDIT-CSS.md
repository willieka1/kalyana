# Audit CSS Kalyana

Audit dilakukan pada versi project setelah revisi dashboard, tombol Keluar, diagram status, logo sidebar, dan bantuan WhatsApp.

## Temuan utama sebelum perapihan

- `index.html` memuat 9 stylesheet aktif. Ditemukan 44 selector/context yang muncul lintas file dan berpotensi saling override sesuai urutan load.
- `auth.html` memuat 4 stylesheet aktif. Ditemukan 35 selector/context lintas file yang berulang.
- `dashboard.html` sudah lebih bersih: hanya 2 stylesheet aktif (`dashboard-kalyana-final.css` dan komponen bantuan WhatsApp), dan tidak ditemukan selector yang sama lintas kedua file.
- Folder `css/` masih menyimpan banyak stylesheet patch/revisi lama. Walaupun tidak semuanya dipanggil dashboard, keberadaannya berisiko membuat file lama ter-link kembali saat maintenance.
- `dashboard-kalyana-final.css` masih menyimpan beberapa override historis di bagian akhir, termasuk banyak `!important` pada search navbar.

## Perbaikan yang diterapkan

1. Landing page dikunci ke `css/landing-kalyana-final.css` sebagai satu sumber style utama.
2. Halaman auth dikunci ke `css/auth-kalyana-final.css` sebagai satu sumber style utama.
3. Dashboard tetap memakai `css/dashboard-kalyana-final.css` sebagai satu sumber layout dashboard.
4. `css/help-whatsapp.css` tetap terpisah karena merupakan komponen reusable dan selector-nya tidak bentrok dengan stylesheet halaman.
5. Semua stylesheet patch lama dihapus dari paket final setelah digabung ke stylesheet final masing-masing halaman.
6. Versi cache CSS/JS dinaikkan ke `v=6.0.0` agar browser tidak memakai file lama.
7. Override search/navbar dan pembesaran diagram pada dashboard dipindahkan ke rule utamanya; blok patch tambahan di akhir stylesheet dihapus.
8. `!important` pada stylesheet dashboard dihapus seluruhnya; specificity sekarang cukup dari selector halaman/komponen.

## Hasil audit setelah perapihan

- `index.html`: 2 stylesheet aktif, 0 duplicate selector lintas file.
- `auth.html`: 1 stylesheet aktif, 0 duplicate selector lintas file.
- `dashboard.html`: 2 stylesheet aktif, 0 duplicate selector lintas file.
- CSS parse error: 0.
- Duplicate HTML ID: 0.
- Missing local asset reference: 0.
- JavaScript syntax error: 0.
- Backend/route/login/role tests: lulus untuk UMKM, Mahasiswa, dan Super Admin.
- `dashboard-kalyana-final.css`: 0 penggunaan `!important`.

## Catatan

Di dalam stylesheet final masih terdapat beberapa selector yang sengaja muncul kembali sebagai pola base + variant/responsive, misalnya card variant atau state. Ini bukan konflik antar-file dan hasil cascade-nya deterministik. Yang dihilangkan adalah pola patch antar-file yang sebelumnya membuat maintenance dan cache lebih rawan menghasilkan tampilan berbeda.
