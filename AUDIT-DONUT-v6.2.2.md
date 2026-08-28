# Audit diagram Project Saya / Pekerjaan Saya — v6.2.2

## Root cause
`backend/server.js` mengirim CSP `style-src 'self' https://fonts.googleapis.com` tanpa `unsafe-inline`.
Versi sebelumnya membuat diagram dan progress dengan atribut `style="background:..."` / `style="width:..."` dari `innerHTML`.
Browser yang menjalankan CSP ketat dapat menolak style inline tersebut, sehingga chart terlihat tidak bekerja walaupun hitungan JavaScript benar.

## Fix
- Diagram pada **Project usaha** dan **Pekerjaan saya** tidak lagi memakai `.k-donut` yang shared.
- Diagram memakai SVG dengan atribut `stroke-dasharray` dan `stroke-dashoffset`.
- Legend memakai class khusus `project-status-legend`.
- Progress pada dua halaman tersebut memakai elemen native `<progress>`.
- Tidak menambah `unsafe-inline` ke CSP dan tidak mengubah backend.
- Dashboard Ringkasan dan halaman lain tidak diubah oleh patch diagram ini.
