# Pengaduan Karyawan - Lourdes

Form pengaduan karyawan dengan Node.js (Express), database Supabase, dan pengiriman email otomatis.

Setiap pengaduan yang dikirim akan:
1. Disimpan ke tabel **`pengaduan`** di Supabase, termasuk file bukti
2. Dikirim lewat email (dengan lampiran bukti) ke: k3@garudamart.com, it@garudamart.com, anna@garudamart.com, bernadettaannapurwita@gmail.com
3. Dikirim salinannya ke email pelapor, jika kolom Email diisi

## Cara setup

1. Salin `.env.example` menjadi `.env`, lalu isi:
   - `DATABASE_URL`: dari Supabase Dashboard → **Connect** → Session pooler
   - `SMTP_USER` / `SMTP_PASS`: akun Gmail pengirim dan **App Password**-nya
2. Install dan siapkan database (membuat tabel dari `supabase.sql`):
   ```bash
   npm install
   npm run setup-db
   ```
3. Jalankan:
   ```bash
   npm start
   ```
   Buka http://localhost:3000

## Struktur
- `server.js`: API `/api/pengaduan` (validasi, simpan ke Supabase, kirim email)
- `public/`: tampilan form (`index.html`, `style.css`, `app.js`, logo)
- `supabase.sql`: struktur tabel
- `scripts/setup-db.mjs`: menjalankan `supabase.sql` ke database

Batas ukuran file bukti adalah 4 MB (batas request Vercel 4,5 MB). Ubah `MAX_FILE_MB` di `server.js` dan `public/app.js` jika perlu.
