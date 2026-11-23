-- Jalankan di Supabase Dashboard > SQL Editor

create table if not exists public.pengaduan (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  nama          text,
  perusahaan    text,
  divisi        text,
  lokasi        text,
  email         text,
  jenis_pengaduan text not null,
  deskripsi     text not null,
  bukti_path    text,
  bukti_url     text,
  bukti_nama    text,
  bukti_mime    text,
  bukti_file    bytea,
  email_terkirim boolean not null default false
);

-- Aktifkan RLS tanpa policy publik: tabel tidak bisa diakses lewat API publik.
alter table public.pengaduan enable row level security;

-- Bucket privat untuk file bukti
insert into storage.buckets (id, name, public)
values ('bukti-pengaduan', 'bukti-pengaduan', false)
on conflict (id) do nothing;
