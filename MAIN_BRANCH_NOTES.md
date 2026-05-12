# Main Branch Notes

Tanggal: 2026-05-12
Promosi branch: develop -> main

## Ringkasan perbaikan yang dipromosikan

### 1) Part 30B — Lazy-load excel utils di UI entry points
- Komponen: `Roster`, `Reports`, `Schedule`, `Timetable`
- Perubahan: direct import util Excel diganti menjadi dynamic import on-demand saat aksi dipakai (export/import/template).
- Dampak: behavior tetap, tetapi jalur startup lebih ringan karena util Excel tidak di-eager-load dari entry point tersebut.

### 2) Part 31 — Lazy-load untuk TakeAttendance
- Komponen: `TakeAttendance`
- Perubahan:
  - Import attendance dari Excel menjadi on-demand saat upload file dipilih.
  - Generate attendance template menjadi on-demand saat tombol template diklik.
- Dampak: tidak mengubah alur pengguna, hanya waktu loading modul Excel.

### 3) Part 32 — Lazy-load export util di Timetable ExportMenu
- Komponen: `Timetable/ExportMenu`
- Perubahan: util export timetable diload saat user menjalankan aksi export.
- Dampak: konsisten dengan strategi lazy-load pada fitur Excel lain.

### 4) Part 33 — Housekeeping refactor loader terpusat
- File baru: `src/utils/excelLoader.ts`
- Komponen terdampak:
  - `src/components/Roster.tsx`
  - `src/components/Reports.tsx`
  - `src/components/Schedule.tsx`
  - `src/components/TakeAttendance.tsx`
  - `src/components/Timetable.tsx`
  - `src/components/Timetable/ExportMenu.tsx`
- Perubahan: deduplikasi pola lazy-loader lokal tiap komponen menjadi satu helper bersama.
- Dampak: kode lebih rapi, lebih mudah dirawat, tanpa perubahan behavior.

## Validasi
- Lint: lulus
- Test: lulus (287/287)
- Build: lulus
- CI GitHub: success
- Security Scan GitHub: success

## Catatan teknis
- Ukuran chunk Excel tetap besar (~952 KB) karena isi modul, namun sekarang konsisten dimuat on-demand di jalur aksi pengguna.
- Ada chunk kecil tambahan untuk loader bersama (`excelLoader`) sebagai konsekuensi refactor ringan.
