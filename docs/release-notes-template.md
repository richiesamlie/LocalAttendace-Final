     1|# Release Notes Template (Develop -> Main)
     2|
     3|Gunakan template ini saat promote `develop` ke `main`.
     4|
     5|## Release Summary
     6|- Release date:
     7|- Commit range:
     8|- Release owner:
     9|
    10|## Highlights
    11|- Feature:
    12|- Fix:
    13|- Docs:
    14|- CI/CD:
    15|- Security:
    16|
    17|## Breaking Change Risk
    18|- [ ] Tidak ada breaking change
    19|- [ ] Ada potensi breaking change (jelaskan):
    20|
    21|## Dependency Changes
    22|- Package yang diupdate:
    23|- Alasan update:
    24|- Dampak potensial:
    25|
    26|## Validation Evidence
    27|- [ ] `bun run lint` pass
    28|- [ ] `bun run lint:eslint` pass
    29|- [ ] `bun run test -- src/test/api.contract.test.ts` pass
    30|- [ ] CI pass
    31|- [ ] Security Scan pass
    32|
    33|## Rollback Plan
    34|- Revert commit utama jika issue kritikal muncul
    35|- Target waktu rollback:
    36|- PIC rollback:
    37|
    38|## Post-Release Check
    39|- [ ] Smoke test login
    40|- [ ] Smoke test attendance flow
    41|- [ ] Smoke test admin/settings
    42|- [ ] Tidak ada error kritis di log
    43|