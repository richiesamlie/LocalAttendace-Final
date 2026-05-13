# Documentation Index

Dokumentasi proyek dipusatkan di folder `docs/`.

## Core Documentation

- [User Guide](user-guide.md)
- [Troubleshooting](troubleshooting.md)
- [Developer Guide](developer-guide.md)
- [Architecture](architecture.md)
- [API Reference](api-reference.md)
- [Contributing](contributing.md)
- [Dependency Governance](dependency-governance.md)
- [Release Notes Template](release-notes-template.md)
- [Repository Artifact Policy](repository-artifact-policy.md)
- [Documentation Map](documentation-map.md)

## Documentation Quality Gate Checklist

Gunakan checklist ini sebelum merge perubahan dokumentasi:

- [ ] Semua tautan internal di `README.md` dan `docs/` valid
- [ ] Lokasi file docs tetap konsisten di folder `docs/`
- [ ] Perubahan API tercermin di `docs/api-reference.md`
- [ ] Perubahan arsitektur tercermin di `docs/architecture.md`
- [ ] Panduan developer/user diperbarui jika ada perubahan workflow
- [ ] Test kontrak dokumentasi tetap hijau (`src/test/api.contract.test.ts`)
