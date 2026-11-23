import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Konfigurasi ----------
const {
  PORT = 3000,
  DATABASE_URL,
  SMTP_HOST,
  SMTP_PORT = 465,
  SMTP_SECURE = 'true',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO = 'k3@garudamart.com,it@garudamart.com,anna@garudamart.com,bernadettaannapurwita@gmail.com',
} = process.env;

const missing = ['DATABASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']
  .filter((k) => !process.env[k]);
if (missing.length) {
  // Jangan matikan server: halaman tetap tampil, kirim form akan memberi pesan error.
  console.error(`[ERROR] Environment variable belum diisi: ${missing.join(', ')}`);
}

// Koneksi langsung ke database Supabase (Postgres)
const db = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 5,
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: String(SMTP_SECURE) === 'true',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Vercel membatasi ukuran request maks 4,5 MB
const MAX_FILE_MB = 4;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
});

// Pilihan yang valid (sama dengan form asli)
const PERUSAHAAN = ['Garudamart', 'Globalinti'];
const DIVISI = ['BOD', 'K3', 'Finance', 'Manufaktur & Fabrikasi', 'Services', 'Marketing',
  'Warehouse', 'Logistik & Purchasing', 'HR', 'GA', 'IT'];
const LOKASI = ['HO', 'BPN', 'ENIM', 'AMI', 'MIFA', 'BIB', 'MIP', 'Tabang', 'Lahat', 'Tal'];
const JENIS = [
  '1. Pengaduan Pelanggaran Etika atau Perilaku',
  '2. Pengaduan Terkait Hubungan Kerja',
  '3. Pengaduan Soal Gaji dan Tunjangan',
  '4. Pengaduan Fasilitas atau Lingkungan Kerja',
  '5. Pengaduan Mengenai Jam Kerja',
  '6. Pengaduan Layanan Internal (untuk divisi lain)',
  '7. Pengaduan Keamanan atau Keselamatan',
  '8. Pengaduan lainnya',
];

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = (v, list) => (list.includes(v) ? v : '');

// ---------- App ----------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/pengaduan', (req, res) => {
  if (missing.length) {
    return res.status(500).json({
      ok: false,
      message: `Server belum dikonfigurasi (${missing.join(', ')} belum diisi).`,
    });
  }
  upload.single('bukti')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `Ukuran file maksimal ${MAX_FILE_MB} MB.`
        : 'Gagal mengunggah file.';
      return res.status(400).json({ ok: false, message: msg });
    }

    try {
      const b = req.body || {};
      const data = {
        nama: clean(b.nama, 120) || 'Anonymous',
        perusahaan: oneOf(clean(b.perusahaan), PERUSAHAAN),
        divisi: oneOf(clean(b.divisi), DIVISI),
        lokasi: oneOf(clean(b.lokasi), LOKASI),
        email: clean(b.email, 200),
        jenis_pengaduan: oneOf(clean(b.jenis_pengaduan), JENIS),
        deskripsi: clean(b.deskripsi, 10000),
      };

      // Validasi field wajib (sama seperti form asli)
      if (!data.jenis_pengaduan) return res.status(400).json({ ok: false, message: 'Jenis Pengaduan wajib dipilih.' });
      if (!data.deskripsi) return res.status(400).json({ ok: false, message: 'Deskripsi Masalah wajib diisi.' });
      if (!req.file) return res.status(400).json({ ok: false, message: 'Upload Bukti wajib diisi.' });
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return res.status(400).json({ ok: false, message: 'Format email tidak valid.' });
      }

      // 1) Simpan data + file bukti ke tabel Supabase
      const { rows } = await db.query(
        `insert into public.pengaduan
           (nama, perusahaan, divisi, lokasi, email, jenis_pengaduan, deskripsi, bukti_nama, bukti_mime, bukti_file)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning id, created_at`,
        [data.nama, data.perusahaan, data.divisi, data.lokasi, data.email, data.jenis_pengaduan,
          data.deskripsi, req.file.originalname, req.file.mimetype || 'application/octet-stream', req.file.buffer],
      );
      const row = rows[0];

      // 2) Kirim email
      const noTiket = `PGD-${String(row.id).padStart(5, '0')}`;
      const tanggal = new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const html = buildEmail({ ...data, noTiket, tanggal, buktiNama: req.file.originalname });
      const attachments = [{ filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }];
      const subject = `[Aspirasi Karyawan] ${noTiket} - ${data.jenis_pengaduan.replace(/^\d+\.\s*/, '')}`;

      await transporter.sendMail({
        from: MAIL_FROM || SMTP_USER,
        to: MAIL_TO,
        replyTo: data.email || undefined,
        subject,
        html,
        attachments,
      });

      // Copy laporan ke email pribadi pelapor (jika diisi)
      // (di-await karena di Vercel proses berhenti setelah respons dikirim)
      if (data.email) {
        await transporter.sendMail({
          from: MAIL_FROM || SMTP_USER,
          to: data.email,
          subject: `Copy Laporan ${noTiket} - Aspirasi Karyawan Lourdes`,
          html: `<p>Terima kasih, pengaduan Anda telah kami terima dengan nomor <b>${noTiket}</b>.</p>${html}`,
          attachments,
        }).catch((e) => console.error('Gagal kirim copy ke pelapor:', e.message));
      }

      await db.query('update public.pengaduan set email_terkirim = true where id = $1', [row.id]);

      res.json({ ok: true, message: `Pengaduan berhasil dikirim. Nomor laporan: ${noTiket}`, noTiket });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, message: 'Terjadi kesalahan, pengaduan gagal dikirim. Silakan coba lagi.' });
    }
  });
});

function buildEmail(d) {
  const row = (k, v) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f7fa;width:170px;vertical-align:top"><b>${k}</b></td>
      <td style="padding:8px 12px;border:1px solid #ddd;vertical-align:top">${v || '-'}</td>
    </tr>`;
  return `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
    <div style="background:#013E63;color:#fff;padding:14px 16px;font-size:16px">
      <b>Form Aspirasi dan Kepedulian Karyawan</b> &mdash; ${esc(d.noTiket)}
    </div>
    <table style="border-collapse:collapse;width:100%;max-width:700px;margin-top:10px">
      ${row('No. Laporan', esc(d.noTiket))}
      ${row('Tanggal', esc(d.tanggal))}
      ${row('Nama', esc(d.nama))}
      ${row('Perusahaan', esc(d.perusahaan))}
      ${row('Divisi', esc(d.divisi))}
      ${row('Lokasi', esc(d.lokasi))}
      ${row('Email', esc(d.email))}
      ${row('Jenis Pengaduan', esc(d.jenis_pengaduan))}
      ${row('Deskripsi Masalah', esc(d.deskripsi).replace(/\n/g, '<br>'))}
      ${row('Bukti', `${esc(d.buktiNama)} (terlampir di email ini)`)}
    </table>
    <p style="color:#888;font-size:12px">Formulir ini bersifat rahasia dan hanya untuk keperluan internal.</p>
  </div>`;
}

// Di Vercel, app di-export (tanpa listen). Di komputer lokal, jalankan server biasa.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

export default app;
