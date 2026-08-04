# Dependency Governance

Tujuan dokumen ini adalah menjaga dependency tetap sehat, aman, dan minim regresi.

**Last Updated:** 2026-08-04

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
    "vite": "^6.4.3",
    "ip-address": ">=10.4.0",
    "brace-expansion": ">=5.0.8",
    "minimatch": ">=10.2.6",
    "postcss": ">=8.5.23",
    "socket.io-parser": ">=4.2.7",
    "engine.io": ">=6.6.7",
    "fast-uri": ">=3.1.5",
    "undici": ">=7.29.0"
  },
  "resolutions": {
    "ws": "^8.21.0",
    "form-data": "^4.0.6",
    "tmp": "^0.2.7",
    "vite": "^6.4.3",
    "ip-address": ">=10.4.0",
    "brace-expansion": ">=5.0.8",
    "minimatch": ">=10.2.6",
    "postcss": ">=8.5.23",
    "socket.io-parser": ">=4.2.7",
    "engine.io": ">=6.6.7",
    "fast-uri": ">=3.1.5",
    "undici": ">=7.29.0"
  }
}
```

| Override | Why | Bumped | Audit |
|----------|-----|--------|-------|
| `ws: ^8.21.0` | Fix CVE-2024-37890 (DoS via tiny fragments) | 2026-05 (Batch 1, F-013) | npm + bun clean |
| `form-data: ^4.0.6` | Fix CVE-2025-7783 (CRLF injection in multipart names) | 2026-06 | npm clean; bun flagged before |
| `tmp: ^0.2.7` | Fix CVE-2025-47906 (path traversal in prefix/postfix) | 2026-06 | npm clean; bun flagged before |
| `vite: ^6.4.3` | Fix CVE-2025-30208 (fs.deny bypass on Windows alternate paths) | 2026-06 | npm clean; bun flagged before |
| `ip-address: >=10.4.0` | Fix GHSA-mwp4-54f8-5fhr (SSRF via leading-zero octets) | 2026-08 | bun audit HIGH |
| `brace-expansion: >=5.0.8` | Fix GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895, GHSA-3jxr-9vmj-r5cp (DoS, 3 CVEs) | 2026-08 | bun audit HIGH |
| `minimatch: >=10.2.6` | Transitive: pulls brace-expansion ^5.0.8 | 2026-08 | bun audit HIGH |
| `postcss: >=8.5.23` | Fix GHSA-r28c-9q8g-f849 (sourceMappingURL path traversal) | 2026-08 | bun audit HIGH |
| `socket.io-parser: >=4.2.7` | Fix GHSA-2m8v-j782-fhvr (zero-attachment memory exhaustion) | 2026-08 | npm + bun audit HIGH |
| `engine.io: >=6.6.7` | Fix GHSA-r635-g3xr-vw7x (polling transport connection exhaustion) | 2026-08 | bun audit HIGH |
| `fast-uri: >=3.1.5` | Fix GHSA-4c8g-83qw-93j6, GHSA-7p8r-x3mc-p8w7, GHSA-v2hh-gcrm-f6hx (host confusion, 3 CVEs) | 2026-08 | bun audit HIGH |
| `undici: >=7.29.0` | Fix multiple HIGH CVEs (TLS bypass, response queue poisoning, etc.) | 2026-08 | bun audit HIGH |

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
