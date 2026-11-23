import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
const urls = [
  process.env.DATABASE_URL,
];
for (const url of urls) {
  const host = new URL(url).host;
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await c.connect();
    console.log('Terhubung via', host);
    await c.query(fs.readFileSync('supabase.sql', 'utf8'));
    const t = await c.query("select count(*) from information_schema.tables where table_schema='public' and table_name='pengaduan'");
    const b = await c.query("select id, public from storage.buckets where id='bukti-pengaduan'");
    console.log('Tabel pengaduan:', t.rows[0].count === '1' ? 'ADA' : 'TIDAK ADA');
    console.log('Bucket:', JSON.stringify(b.rows));
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log('Gagal via', host, '->', e.message);
    try { await c.end(); } catch {}
  }
}
process.exit(1);
