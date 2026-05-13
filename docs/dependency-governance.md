# Dependency Governance

Tujuan dokumen ini adalah menjaga dependency tetap sehat, aman, dan minim regresi.

## Policy

1. Prioritas update:
- Patch: rutin (mingguan/dua mingguan)
- Minor: terjadwal (bulanan)
- Major: terencana, wajib validasi lebih ketat

2. Security-first:
- Jika ada vulnerability high/critical pada dependency produksi, lakukan remediasi secepatnya.
- Gunakan workflow `Security Scan` sebagai baseline otomatis.

3. Scope update:
- Hindari update massal tanpa kebutuhan.
- Utamakan update terarah per package/domain agar rollback mudah.

## Update Workflow (Recommended)

1) Cek status saat ini:
- `npm outdated`
- `npm audit --omit=dev --audit-level=high`

2) Lakukan update bertahap:
- Patch/minor terpilih dulu
- Commit kecil per kelompok package

3) Validasi wajib:
- `npm run lint`
- `npm run lint:eslint`
- `npm run test -- src/test/api.contract.test.ts`
- `npm run test` (jika perubahan menyentuh runtime utama)

4) Push ke `develop`, pantau CI + Security Scan sampai hijau.

## Rollback Strategy

Jika muncul regresi:

1. Revert commit dependency terkait:
- `git revert <commit_sha>`

2. Re-run quality gates:
- lint, test, CI

3. Ulangi update dengan batch lebih kecil.

## Notes

- Semua perubahan dependency harus menyertakan catatan singkat “kenapa diupdate” pada commit/PR.
- Untuk promote `develop -> main`, ringkas perubahan dependency di release notes.
