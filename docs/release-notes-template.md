# Release Notes Template (Develop -> Main)

Gunakan template ini saat promote `develop` ke `main`.

## Release Summary
- Release date:
- Commit range:
- Release owner:

## Highlights
- Feature:
- Fix:
- Docs:
- CI/CD:
- Security:

## Breaking Change Risk
- [ ] Tidak ada breaking change
- [ ] Ada potensi breaking change (jelaskan):

## Dependency Changes
- Package yang diupdate:
- Alasan update:
- Dampak potensial:

## Validation Evidence
- [ ] `bun run lint` pass
- [ ] `bun run lint:eslint` pass
- [ ] `bun run test -- src/test/api.contract.test.ts` pass
- [ ] CI pass
- [ ] Security Scan pass

## Rollback Plan
- Revert commit utama jika issue kritikal muncul
- Target waktu rollback:
- PIC rollback:

## Post-Release Check
- [ ] Smoke test login
- [ ] Smoke test attendance flow
- [ ] Smoke test admin/settings
- [ ] Tidak ada error kritis di log

