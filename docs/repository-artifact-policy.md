# Repository Artifact Policy

Dokumen ini menjelaskan file yang boleh tersimpan di repo vs artefak runtime lokal.

## Source of Truth (boleh di-commit)
- Source code (`src/`, `public/`)
- Konfigurasi (`package.json`, `tsconfig*`, workflow CI)
- Dokumentasi (`README.md`, `docs/`)
- Script operasional (`scripts/`)
- Test files (`src/test/`)

## Runtime / Build Artifacts (jangan di-commit)
- `node_modules/`
- `dist/`
- `coverage/`
- `test-results/`
- `backups/`
- `database.sqlite`, `database.sqlite-shm`, `database.sqlite-wal`
- file log lokal (`*.log`, `server-error.log`)

## Operational Rules
1. Sebelum commit, cek `git status` pastikan tidak ada artefak runtime ikut terbawa.
2. Jika artefak runtime muncul, bersihkan lokal — jangan commit.
3. Jika perlu bukti artefak untuk debugging, simpan di issue/PR attachment, bukan repository history.

## Notes
- File screenshot produk yang dipakai README termasuk dokumentasi visual dan boleh dipertahankan bila memang direferensikan.
- Operasi cleanup destruktif tetap wajib preview + approval eksplisit.
