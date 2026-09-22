# PRD — E-SPAK (Elektronik Sistem Pemantauan Kinerja dan Analisis Kesehatan)

## Problem Statement
Web app responsif untuk Puskesmas Palaran untuk digitalisasi monitoring kinerja pegawai (JPL & sertifikat) dan pemantauan capaian program kesehatan (SPM), plus dashboard pimpinan, Early Warning System, dan Policy Brief. UI Bahasa Indonesia.

## Architecture
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + Recharts + sonner. Token JWT disimpan di localStorage (`espak_token`).
- Backend: FastAPI (single `server.py` + `seed.py`), semua route prefix `/api`. Auth JWT (bcrypt), RBAC via `require_roles`.
- DB: MongoDB (UUID string `id`, bukan `_id`). Datetime disimpan ISO string.
- File: Emergent Object Storage (sertifikat PDF/JPG/PNG maks 2MB).

## User Personas / Roles
- **admin**: akses penuh (pengguna, program/indikator, verifikasi, target, audit log, export).
- **kepala** (Kepala Puskesmas): dashboard eksekutif, monitoring pegawai/JPL/SPM, EWS, policy brief, laporan.
- **pegawai**: dashboard pribadi, upload & pantau sertifikat/JPL.
- **pj_program**: input indikator SPM & laporan, monitoring SPM, EWS, policy brief.

## Core Requirements (static)
- Target kompetensi default 40 JPL + 8 sertifikat (dapat diubah admin).
- Status pegawai: BELUM_MULAI / DALAM_PROSES / MEMENUHI_JPL / MEMENUHI_JPL_DAN_SERTIFIKAT (JPL dihitung dari sertifikat berstatus disetujui).
- Status indikator SPM: hijau (≥100% target) / kuning (80–99%) / merah (<80%). Capaian = numerator/denominator×100.
- Persentase boleh >100%.

## Implemented (2026-06)
- Auth JWT login via username/NIP + password; seed idempoten (admin=laporanpalaran@gmail.com).
- Dashboard admin/kepala (8 stat cards, JPL/bulan, ranking, distribusi status, ringkasan SPM & EWS) + dashboard pegawai (progress bar, kekurangan otomatis).
- Modul upload sertifikat (validasi format/2MB, object storage) + verifikasi (setuju/tolak wajib alasan) + notifikasi.
- Monitoring pegawai (tabel + filter + search + export CSV).
- Program & indikator CRUD, input data SPM terpadu (kalkulasi otomatis), monitoring SPM (bar/line/doughnut + filter bulan/tahun/program).
- Early Warning System (rule-based), Policy Brief (generate rule-based + manual + cetak PDF).
- Pengaturan: target kompetensi, manajemen pengguna, audit log. Roadmap 1 tahun. Export CSV (pegawai & SPM).
- Testing: backend 23/23 pytest passed; frontend flows 100% (setelah perbaikan useEffect).

## Backlog / Remaining
- P1: Export Excel/PDF native (saat ini CSV + cetak browser); date picker shadcn Calendar.
- P1: Analisis tren pegawai lanjutan (median chart, perbandingan antar unit).
- P2: Split server.py ke beberapa router; async storage (httpx); aggregation untuk hindari N+1.
- P2: Integrasi Google Spreadsheet/Looker Studio connector nyata.

## Update 2026-06 (fitur lanjutan #2)
- **Laporan Resmi berkop**: export Excel (.xlsx via openpyxl) & PDF (reportlab, kop "PEMERINTAH KOTA SAMARINDA / DINAS KESEHATAN / UPTD PUSKESMAS PALARAN") + CSV untuk 3 laporan: Rekap JPL Pegawai, Rekap Sertifikat, Rekap Capaian SPM. Endpoint `GET /api/export/{employees|certificates|spm}?format=csv|xlsx|pdf`.
- **Kalender Periode SPM**: komponen `MonthYearPicker` (Popover kalender bulan+tahun) menggantikan dropdown pada Input Data SPM & Monitoring SPM (plus toggle "Semua Bulan").
- **Ekspor Grafik**: tombol "Unduh PNG" pada tiap grafik Analitik Pegawai (SVG→PNG via canvas, `lib/chartExport.js`).
- **Sinkron Otomatis Dataset**: cron harian `.emergent/crons.yml` (18:00 UTC) memanggil `POST /api/cron/sync-dataset` (auth Bearer `WEBHOOK_CRON_SECRET`, ack cepat + BackgroundTask) → simpan snapshot ke `dataset_snapshots`. Status terakhir sinkron tampil di halaman Laporan via `GET /api/dataset/sync-status`.

## Update 2026-06 (fitur lanjutan #3)
- **Rentang Periode Monitoring SPM**: toggle "Per Bulan" vs "Rentang Periode". Mode rentang memakai 2 `MonthYearPicker` (Dari s/d Sampai) dan menampilkan akumulasi capaian = Σnumerator ÷ Σdenominator sepanjang rentang (kolom periode = "Akumulasi"). Backend `GET /api/spm/dashboard?start_bulan&start_tahun&end_bulan&end_tahun` (verified 84% = 420/500).
- **Unduh Semua Grafik**: tombol di Analitik Pegawai menggabungkan ketiga grafik (Top/terendah JPL + perbandingan unit) menjadi satu berkas PNG (`downloadChartsPng`, stacking canvas).

## Next Tasks
- Tambah blok tanda tangan/QR pada PDF resmi.

## Update 2026-06 (Import + Fitur Kepegawaian BLUD/ASN)
Diimpor dari project user, di-setup ulang (env JWT_SECRET, EMERGENT_LLM_KEY, WEBHOOK_CRON_SECRET, ADMIN_*), deps backend+frontend terpasang, seed multi-role fresh.
- **Multi-role**: user punya field `roles` (array); akses = gabungan role. Helper `roles_of`/`has_role`. Kelola via Pengaturan (checkbox role). Login token pakai role primer.
- **Jenis pegawai**: field `tipe_pegawai` = "ASN" | "BLUD" (is_blud diturunkan otomatis). Dropdown di manajemen pengguna, badge di tabel. Seed: pegawai3/6/9 = ASN, sisanya BLUD.
- **Cuti Pegawai** (`/cuti`): saldo N/N-1/N-2 + Cuti Bersama; prioritas potong saldo Bersama→N-2→N-1→N (apply_deduction). Pengajuan (pegawai), verifikasi/tolak & pembatalan + tambah cuti on-behalf (admin), atur saldo (admin). Dialog ajukan menampilkan referensi sisa saldo. Riwayat + cetak PDF.
  - Endpoint: /api/leave/balances, /leave/my-balance, /leave/balances/{id}(PUT), /leaves(GET/POST), /leaves/{id}/verify|cancel|pdf, /leaves/{id}/attachment(POST/GET).
  - **PDF resmi**: format "FORMULIR PERMINTAAN DAN PEMBERIAN CUTI" (I–VIII) termasuk V. CATATAN CUTI TAHUNAN (sisa saldo N-2/N-1/N + Cuti Bersama) & rekap jumlah pengambilan.
  - **Lampiran cuti**: pegawai upload dokumen pendukung (PDF/JPG/PNG ≤2MB, Emergent Object Storage) hanya saat status "Diajukan" (sebelum verifikasi); admin bebas. Field has_lampiran.
- **SIP** (`/sip` input pegawai + verifikasi admin; `/monitoring-sip` dashboard admin/kepala): status masa berlaku otomatis (Aktif / Akan Habis ≤90hr / Kadaluarsa), summary + distribusi per profesi + verifikasi.
  - Endpoint: /api/sip(GET/POST), /sip/{id}(PUT/DELETE), /sip/{id}/verify, /sip/dashboard.
- Testing: iteration_2 (multi-role/Cuti/SIP) 100%, iteration_3 (ASN/BLUD, sisa saldo, lampiran) backend 5/5 + frontend 100%.

## Update 2026-06 (fitur lanjutan)
- **Analitik Pegawai** (`/analitik-pegawai`, admin & kepala): grafik Top 10 & 10 terendah JPL, rata-rata/median, perbandingan antar unit/program (bar ganda) + tabel per-unit. Endpoint `GET /api/analytics/employees`.
- **Konektor Looker Studio**: endpoint dataset siap-sambung `GET /api/dataset/jpl` & `GET /api/dataset/spm` (JSON default, `?format=csv` untuk `IMPORTDATA`), auth via `?auth=<token>`. Halaman Laporan menampilkan URL JSON/CSV yang bisa disalin.
- **Pemilih Tanggal**: komponen `DatePicker` (shadcn Popover + Calendar, locale id) menggantikan input tanggal bawaan browser pada form Upload Sertifikat.
