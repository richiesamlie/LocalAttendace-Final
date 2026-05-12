# 028 — Excel deprecation cleanup spike

## Tujuan
Menurunkan `npm WARN deprecated` pada step **Install dependencies** di CI tanpa mengubah behavior runtime aplikasi.

## Scope
Fokus ke warning deprecated yang masih tersisa setelah Part 27.

## Baseline (hasil audit)
Rantai deprecated yang masih muncul:
- `exceljs@4.4.0` -> `archiver@5` -> `glob@7` -> `inflight@1.0.6`
- `exceljs@4.4.0` -> `unzipper@0.10` -> `fstream@1.0.12` -> `rimraf@2.7.1`
- `exceljs@4.4.0` -> `fast-csv@4` -> `lodash.isequal@4.5.0`
- `exceljs@4.4.0` -> `uuid@8.3.2`
- `better-sqlite3@12.9.0` -> `prebuild-install@7.1.3`

Catatan: `exceljs` latest saat ini masih `4.4.0`, jadi tidak ada upgrade minor/patch langsung untuk membersihkan chain ini.

## Opsi yang dievaluasi

### Opsi A — Tetap exceljs (status quo)
- Pros: risiko paling rendah, tanpa perubahan fitur import/export Excel.
- Cons: warning deprecated tetap ada di CI install.
- Verdict: **VALIDATED** (aman, tapi tidak menyelesaikan warning).

### Opsi B — Isolasi audit deprecation (visibility), tanpa ubah runtime
- Tambah dokumentasi + rencana fase migrasi bertahap.
- Pros: low-risk, branch tetap hijau.
- Cons: warning belum nol.
- Verdict: **VALIDATED** (cocok sebagai langkah transisi).

### Opsi C — Migrasi parser/writer Excel bertahap (mis. `xlsx` + `write-excel-file`)
- Pros: berpotensi hilangkan chain deprecated dari `exceljs`.
- Cons: risiko behavior/formatting berubah; butuh regression test import/export yang luas.
- Verdict: **PARTIAL** (feasible, tapi bukan low-risk untuk 1 part kecil).

## Rekomendasi untuk build nyata (Part 29+)
1. Pertahankan runtime saat ini (no behavior change) untuk branch `develop`.
2. Buat compatibility harness untuk fitur `src/utils/excel.ts`:
   - import roster
   - import attendance
   - export timetable/report/template
3. Setelah harness ada, lakukan migrasi bertahap per use-case (bukan big-bang).
4. Jika target jangka pendek hanya kebersihan log CI, jadikan warning deprecated sebagai laporan non-blocking terpisah dulu.

## Kesimpulan spike
Untuk konteks low-risk saat ini, **langkah paling aman adalah dokumentasi + rencana migrasi bertahap**.
Membersihkan warning sampai nol membutuhkan migrasi dependency Excel stack (dan ini perlu fase khusus dengan test kompatibilitas file).