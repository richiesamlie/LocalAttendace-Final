# Dependency Governance

Tujuan dokumen ini adalah menjaga dependency tetap sehat, aman, dan minim regresi.

**Last Updated:** 2026-06-18

## Policy

1. **Prioritas update:**
   - Patch: rutin (mingguan/dua mingguan)
   - Minor: terjadwal (bulanan)
   - Major: terencana, wajib validasi lebih ketat

2. **Security-first:**
   - Jika ada vulnerability high/critical pada dependency produksi, lakukan remediasi secepatnya.
   - Gunakan workflows `CI` + `Security Scan` di GitHub Actions sebagai baseline otomatis.

3. **Scope update:**
   - Hindari update massal tanpa kebutuhan.
   - Utamakan update terarah per package/domain agar rollback mudah.

## Dual Lockfile Workflow

The repo maintains **two lockfiles**:

| Lockfile | Used By | Updated By |
|----------|---------|-----------|
| `bun.lock` | Bun runtime + Bun audit CI lanes (develop) | `bun install` |
| `package-lock.json` | npm audit + Full Test Suite CI lane (main) | `npm install` |

When changing `package.json` (especially `dependencies`, `devDependencies`, `overrides`, `resolutions`), regenerate **both**:

```bash
bun install           # updates bun.lock
npm install           # updates package-lock.json
```

Commit both lockfiles in the same change. CI uses both — drift between them causes `Bun Parity Smoke` failure (`bun install --frozen-lockfile` rejects drift).

## Security Overrides

`package.json` has `overrides` and `resolutions` blocks for security-sensitive transitive deps:

```json
{
  "overrides": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    "tmp": "^0.2.7",
    "vite": "^6.4.3"
  },
  "resolutions": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    "tmp": "^0.2.7",
    "vite": "^6.4.3"
  }
}
```

| Override | Why | Bumped | Audit |
|----------|-----|--------|-------|
| `ws: ^8.21.0` | Fix CVE-2024-37890 (DoS via tiny fragments) | 2026-05 (Batch 1, F-013) | npm + bun clean |
| `form-data: ^4.0.6` | Fix CVE-2025-7783 (CRLF injection in multipart names) | 2026-06 (just now) | npm clean; bun flagged before |
| `tmp: ^0.2.7` | Fix CVE-2025-47906 (path traversal in prefix/postfix) | 2026-06 (just now) | npm clean; bun flagged before |
| `vite: ^6.4.3` | Fix CVE-2025-30208 (fs.deny bypass on Windows alternate paths) | 2026-06 (just now) | npm clean; bun flagged before |

**When adding a new override:**
1. Document the CVE / advisory in the commit message body
2. Note which CI lane was failing (npm audit, bun audit, or both)
3. Reference the audit finding ID if applicable

## CI Audit Gates

| Gate | Command | Workflow | Blocking On |
|------|---------|----------|-------------|
| npm audit (prod) | `npm audit --omit=dev --audit-level=high` | `Security Scan` (main + develop) | HIGH+ severity |
| Bun security smoke | `bun audit --audit-level=high` | `Security Scan` (develop only) | HIGH+ severity |
| CodeQL | (GitHub-native) | `Security Scan` | Code patterns |

`npm audit` and `bun audit` use **different advisory databases** — they don't always agree on vulnerability ranges. When they disagree (e.g., `form-data 4.0.5` was flagged by bun but not npm), prefer the strictest signal: fix via override.

## Update Workflow (Recommended)

1. **Cek status saat ini:**
   ```bash
   bun pm outdated
   bun audit --audit-level=high
   npm audit --omit=dev --audit-level=high
   ```

2. **Lakukan update bertahap:**
   - Patch/minor terpilih dulu
   - Commit kecil per kelompok package

3. **Validasi wajib (mimic CI gates):**
   ```bash
   npm run lint
   npm run lint:eslint -- --max-warnings=0
   npm run test:critical    # 226 tests, fast gate
   npm test                 # 505 tests, full suite (CI on main)
   bun install --frozen-lockfile && bun run lint
   bun audit --audit-level=high
   bun run build
   ```

4. **Push ke `develop`, pantau CI + Security Scan sampai hijau.**

## Rollback Strategy

Jika muncul regresi:

1. **Revert commit dependency terkait:**
   ```bash
   git revert <commit_sha>
   ```

2. **Re-run quality gates:**
   ```bash
   npm run lint
   npm run lint:eslint -- --max-warnings=0
   npm run test:critical
   bun install --frozen-lockfile
   bun run lint
   bun audit --audit-level=high
   ```

3. **Ulangi update dengan batch lebih kecil** (per package, not per group).

## Common Scenarios

### "bun install complains about override conflict with direct dep"
The override range must intersect the direct dep range. Example: override `vite: ^6.4.3` requires direct `vite: ^6.4.3` (not `^6.2.0`). Bump direct dep alongside override.

### "bun install --frozen-lockfile fails on CI"
`bun.lock` is out of sync with `package.json` or `package-lock.json`. Run `bun install` locally and commit the regenerated lockfile.

### "npm audit still flags an override version"
The override may be lower than what npm's advisory DB considers fixed. Check `npm audit fix --dry-run` for the minimum version, then update the override.

### "Bun audit flags something npm doesn't (or vice versa)"
Expected behavior — different advisory databases. Fix via override (the stricter signal wins).

## Notes

- Semua perubahan dependency harus menyertakan catatan singkat "kenapa diupdate" pada commit/PR.
- Untuk promote `develop -> main`, ringkas perubahan dependency di release notes.
- Don't update major versions without planning — breaking changes may require code updates and test re-baselining.
- Run `npm audit` AND `bun audit` locally before pushing — both gates exist for a reason.
