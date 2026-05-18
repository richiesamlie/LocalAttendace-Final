     1|# Dependency Governance
     2|
     3|Tujuan dokumen ini adalah menjaga dependency tetap sehat, aman, dan minim regresi.
     4|
     5|## Policy
     6|
     7|1. Prioritas update:
     8|- Patch: rutin (mingguan/dua mingguan)
     9|- Minor: terjadwal (bulanan)
    10|- Major: terencana, wajib validasi lebih ketat
    11|
    12|2. Security-first:
    13|- Jika ada vulnerability high/critical pada dependency produksi, lakukan remediasi secepatnya.
    14|- Gunakan workflow `Security Scan` sebagai baseline otomatis.
    15|
    16|3. Scope update:
    17|- Hindari update massal tanpa kebutuhan.
    18|- Utamakan update terarah per package/domain agar rollback mudah.
    19|
    20|## Update Workflow (Recommended)
    21|
    22|1) Cek status saat ini:
    23|- `npm outdated`
    24|- `npm audit --omit=dev --audit-level=high`
    25|
    26|2) Lakukan update bertahap:
    27|- Patch/minor terpilih dulu
    28|- Commit kecil per kelompok package
    29|
    30|3) Validasi wajib:
    31|- `bun run lint`
    32|- `bun run lint:eslint`
    33|- `bun run test -- src/test/api.contract.test.ts`
    34|- `bun run test` (jika perubahan menyentuh runtime utama)
    35|
    36|4) Push ke `develop`, pantau CI + Security Scan sampai hijau.
    37|
    38|## Rollback Strategy
    39|
    40|Jika muncul regresi:
    41|
    42|1. Revert commit dependency terkait:
    43|- `git revert <commit_sha>`
    44|
    45|2. Re-run quality gates:
    46|- lint, test, CI
    47|
    48|3. Ulangi update dengan batch lebih kecil.
    49|
    50|## Notes
    51|
    52|- Semua perubahan dependency harus menyertakan catatan singkat “kenapa diupdate” pada commit/PR.
    53|- Untuk promote `develop -> main`, ringkas perubahan dependency di release notes.
    54|