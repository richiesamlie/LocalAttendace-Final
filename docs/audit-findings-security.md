# Security Audit Findings — 2026-08-06

## Summary

This audit identified **7 findings** across 5 areas of the LocalAttendance-Final application (Express 4 + SQLite/Postgres + React). **1 HIGH**, **3 MEDIUM**, **2 LOW**, and **1 INFO** severity issues were found. The most critical finding is that the legacy 7-day JWT cookie bypasses refresh token rotation and reuse detection, allowing stolen cookies to remain valid for 7 days even after the security mechanism triggers. The profiling endpoint regex check has theoretical bypass vectors but is mitigated by SQLite's read-only EXPLAIN behavior. The database restore flow has a write-queue race window, and the PostgreSQL migration has a column-name SQL injection surface (narrow attack window). Socket.IO authentication uses only the legacy cookie name, creating a functional gap after cookie expiry.

## Findings

### SEC-001: Legacy 7-Day JWT Cookie Bypasses Refresh Token Rotation
- **Severity:** HIGH
- **File(s):** `src/routes/auth.routes.ts:63–69`, `src/routes/middleware.ts:187`
- **Description:** Every login issues a legacy 7-day JWT cookie (`auth_token` / `__Host-auth_token`) alongside the new 1-hour access token and 7-day refresh token. The `requireAuth` middleware (line 187) accepts tokens from `ACCESS_COOKIE_NAME || AUTH_COOKIE_NAME`, meaning the legacy JWT is always a valid credential. If a refresh token family is revoked due to reuse detection (SEC-002 concern), the legacy JWT cookie for the same session remains valid and is not revoked. The refresh endpoint (`/refresh`) does not re-issue the legacy cookie, so it's purely a credential set at login time that can't be invalidated through the refresh flow.
- **Evidence:**
  - `auth.routes.ts:63–69`: `legacyToken` is a7-day JWT signed with the same secret and same `sessionId`
  - `auth.routes.ts:80–85`: cookie is set with `httpOnly`, `sameSite: 'strict'`, `maxAge: 7 * 24 * 60 * 60 * 1000`
  - `middleware.ts:187`: `const token = req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[AUTH_COOKIE_NAME]`
  - The `/refresh` endpoint (line ~130) only sets `ACCESS_COOKIE_NAME` and `REFRESH_COOKIE_NAME`, never touches the legacy cookie
  - Logout does clear all three cookies and revoke the session, but an attacker with the 7d JWT doesn't need the session to be active — the JWT is self-contained
- **Risk:** If an attacker steals the 7-day legacy JWT cookie (e.g., via XSS despite httpOnly, network sniffing on non-TLS LAN, or a stolen backup), they have a7-day authentication window. Refresh token rotation (the security mechanism designed to limit token lifetime to 1 hour) does not affect this cookie. The session server-side check (`sessionService.get()`) provides some mitigation — if the session is revoked, the JWT is rejected. But session revocation only happens on explicit logout, not on refresh token reuse detection.
- **Recommendation:**
  1. **Remove the legacy cookie issuance** or mark it with a clear sunset date. The comment says "Will be removed once all clients migrate" — this should have a timeline.
  2. **Revoke the session** (not just the refresh family) when reuse is detected in the `/refresh` endpoint. This invalidates the legacy JWT.
  3. **Have `verifySocketAuth` try `ACCESS_COOKIE_NAME` first** (see SEC-005).
  4. Consider adding a migration path: on refresh, also re-set the legacy cookie with a short TTL (e.g.,1h) matching the access token, or stop setting it entirely.
- **Status:** OPEN

---

### SEC-002: Profiling Endpoint Regex Bypass — Cosmetic but Documented
- **Severity:** LOW
- **File(s):** `src/routes/admin.routes.ts:172–177`, `src/db/profiling.ts:51`
- **Description:** The profiling endpoint validates input with `!/^select\b/i.test(trimmed) || trimmed.includes(';')`. This regex can be bypassed with SQL comments or whitespace tricks: `SELECT/**/1`, `SELECT--\n1`, `SELECT 1\nFROM teachers` all pass the check and reach `EXPLAIN QUERY PLAN`. However, `EXPLAIN QUERY PLAN` is **read-only** in SQLite — it returns a plan object, never executes the statement, and cannot exfiltrate data. Schema probing via `SELECT * FROM sqlite_master` is already possible through the dedicated `/profiling/indexes` and `/profiling/stats` admin endpoints, so no additional information is disclosed.
- **Evidence:**
  - `admin.routes.ts:172–177`: regex check allows `SELECT/**/1` (comment between SELECT and first token)
  - `profiling.ts:51`: `_db.prepare("EXPLAIN QUERY PLAN " + sql).all()` — concatenation, but EXPLAIN is read-only
  - `admin.routes.ts:184–189`: error handler uses `safeLog(error)` and returns generic `"Internal error — see server logs"` — no SQL echo-back in error responses
  - `admin.routes.ts:178–183`: success response returns `{ query: sql, plan, analysis, suggestions, severity, score }` — the user's own input is echoed back, which is expected for a profiling tool
- **Risk:** An admin could use comment-based tricks to probe schema or table structure through the query plan output. But since admins already have direct access to indexes, table stats, and backup endpoints, this provides no new attack surface. The `EXPLAIN QUERY PLAN` return is a SQLite-specific plan object (id, parent, notused, detail), not row data.
- **Recommendation:** No urgent action needed. For defense-in-depth, consider adding `trimmed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')` before the regex check to strip comments, or use a SQLite SQL parser to validate the AST. Low priority since the risk is negligible.
- **Status:** OPEN

---

### SEC-003: Database Restore Write-Queue Race Condition
- **Severity:** MEDIUM
- **File(s):** `src/routes/admin.routes.ts:60–107`, `src/db/index.ts:40–55`, `src/db/writeQueue.ts`
- **Description:** The restore handler drains the write queue by calling `await db.enqueueWrite(() => {})` (line ~61), then performs several async operations (mkdir, copyFile, reading request chunks), and finally calls `db.restore(fileBuffer)` in the `req.on('end')` callback. Between the queue drain and the actual restore, new writes can be enqueued and processed against the OLD database. When `db.restore()` runs, it closes the DB, writes the new file over `DB_FILE`, reopens, and re-inits schema/statements. Any writes processed during the gap are committed to the old database file that gets overwritten — effectively lost.
- **Evidence:**
  - `admin.routes.ts:61`: `await db.enqueueWrite(() => {})` — drains queue, but doesn't lock it
  - `admin.routes.ts:72–82`: async operations (mkdir, copyFile) happen between drain and restore
  - `admin.routes.ts:96–101`: `req.on('end', () => { ... db.restore(fileBuffer); ... })` — restore happens later
  - `writeQueue.ts:12–17`: `processWriteQueue` processes items as they arrive; no locking mechanism
  - `index.ts:40–55`: `db.restore()` clears interval, closes DB, writes file, reopens — no drain-before-close
- **Risk:** If another admin or automated process (e.g., attendance save, settings update) enqueues a write between the queue drain and the restore, that write is silently lost. In a school setting with ~40 concurrent teachers, the window is small but nonzero. This is a data integrity issue, not a direct security vulnerability, but it could cause data loss during an admin-initiated restore.
- **Recommendation:**
  1. Add a "restore lock" flag that prevents new writes from being enqueued during restore. The `processWriteQueue` function could check this flag and reject/defer new items.
  2. Alternatively, perform the drain INSIDE the restore: close the DB, write the file, then reopen — ensuring no writes can interleave.
  3. Consider making restore a two-phase operation: drain + lock, then write + reopen + unlock.
- **Status:** OPEN

---

### SEC-004: PostgreSQL Migration Column-Name SQL Injection
- **Severity:** MEDIUM
- **File(s):** `src/db/auto-migrate.ts:156–180`
- **Description:** The `insertBatch` function derives column names from `Object.keys(rows[0])` — the keys of the first row returned by `SELECT * FROM <table>` on the SQLite database. These column names are interpolated directly into the SQL INSERT statement without parameterization or validation: `INSERT INTO ${table} (${columns.join(', ')}) VALUES ...`. If a malicious SQLite database file contains a table with a crafted column name (e.g., `name"); DROP TABLE teachers; --`), the resulting SQL would include the injection payload.
- **Evidence:**
  - `auto-migrate.ts:157`: `const columns = Object.keys(rows[0])` — column names from SQLite data
  - `auto-migrate.ts:174`: `` const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING` `` — column names are string-interpolated
  - `auto-migrate.ts:66–73`: `readSQLiteData` does `db.prepare(`SELECT * FROM ${table}`).all()` — table names come from hardcoded `TABLES` array (line 31–46), which is safe
  - Values are properly parameterized (`$1, $2, ...`), so value-based injection is not possible
- **Risk:** Narrow attack surface: (1) the migration only runs when PostgreSQL is empty (`isPostgresEmpty()` check at line ~200), (2) it's triggered by admin action (restore + DATABASE_URL configured), (3) the SQLite file is already validated via magic bytes. However, a malicious backup file uploaded by a compromised admin account could exploit this to execute arbitrary SQL on the PostgreSQL instance during migration. The `DISABLE TRIGGER ALL` call (line ~204) means even FK constraints are relaxed during the window.
- **Recommendation:**
  1. Validate column names against `/^[a-z_][a-z0-9_]*$/` before interpolation. Reject rows with unexpected column names.
  2. Quote column names with PostgreSQL identifier quoting (`"column_name"`) to prevent injection.
  3. Consider using `pg-format` or a similar library for identifier-safe interpolation.
  4. Re-enable triggers in a `finally` block to ensure they're always restored (currently in the try block, line ~209).
- **Status:** OPEN

---

### SEC-005: Socket.IO Auth Uses Only Legacy Cookie Name
- **Severity:** MEDIUM
- **File(s):** `src/routes/middleware.ts:348–351, 384–386`
- **Description:** `verifySocketAuth` calls `parseAuthTokenCookie(headers?.cookie)` which defaults to `AUTH_COOKIE_NAME` (the legacy 7-day JWT cookie name). It does NOT try `ACCESS_COOKIE_NAME` (the new1-hour access token cookie). In contrast, HTTP `requireAuth` (line 187) and `getTeacherId` (line 137) both try `ACCESS_COOKIE_NAME || AUTH_COOKIE_NAME`. After the initial7-day legacy cookie expires (from last login), Socket.IO connections will fail even though the access token is valid and being refreshed every hour.
- **Evidence:**
  - `middleware.ts:350`: `cookieName: string = AUTH_COOKIE_NAME` — defaults to legacy name
  - `middleware.ts:384–386`: `const token = parseAuthTokenCookie(headers?.cookie)` — no cookie name override
  - `middleware.ts:137`: HTTP auth uses `req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[AUTH_COOKIE_NAME]`
  - `auth.routes.ts:130–146`: refresh endpoint sets `ACCESS_COOKIE_NAME` and `REFRESH_COOKIE_NAME` but NOT `AUTH_COOKIE_NAME`
  - `auth.routes.ts:80–85`: only login sets the legacy cookie
- **Risk:** After 7 days from last login, real-time features (Socket.IO class updates, live attendance sync) silently fail for users who haven't re-logged in. The HTTP API continues to work (access token is refreshed), creating a confusing partial-failure state. This is a functional bug, not a security vulnerability — Socket.IO auth failure results in rejection (null), not bypass.
- **Recommendation:**
  ```typescript
  // In verifySocketAuth, try both cookie names:
  export async function verifySocketAuth(headers: { cookie?: string } | undefined): Promise<SocketAuthContext | null> {
    const token = parseAuthTokenCookie(headers?.cookie, ACCESS_COOKIE_NAME)
               || parseAuthTokenCookie(headers?.cookie, AUTH_COOKIE_NAME);
    if (!token) return null;
    // ...
  }
  ```
  Or update `parseAuthTokenCookie` to accept an array of cookie names.
- **Status:** OPEN

---

### SEC-006: Database Restore Does Not Drain WAL/SHM Files
- **Severity:** LOW
- **File(s):** `src/db/index.ts:40–55`, `src/db/connection.ts:53`
- **Description:** The `db.restore()` function closes the database (`_db.close()`) and writes the new buffer to `DB_FILE`, then calls `reinitConnection()` which opens the DB with `journal_mode = WAL`. When `better-sqlite3` closes a WAL-mode database, it checkpoints the WAL into the main file and removes WAL/SHM sidecar files. If the close is clean, no stale WAL/SHM files remain. However, there is no explicit cleanup of potential orphaned WAL/SHM files between the close and the new open. If the close fails silently (the catch block ignores errors), stale WAL/SHM files could persist. When the new database is opened in WAL mode, SQLite would find these files and may either ignore them (if they're for a different database incarnation) or attempt to replay them, potentially corrupting the restored database.
- **Evidence:**
  - `index.ts:44–47`: `try { _db.close(); } catch(_e) {}` — errors silently ignored
  - `index.ts:49`: `fs.writeFileSync(DB_FILE, buffer)` — writes new DB file
  - `index.ts:50`: `reinitConnection()` → `initConnection()` → `_db.pragma('journal_mode = WAL')`
  - `connection.ts:53`: `_db.pragma('journal_mode = WAL')` — WAL mode on every open
  - No explicit `fs.unlinkSync(DB_FILE + '-wal')` or `fs.unlinkSync(DB_FILE + '-shm')` before writing the new file
- **Risk:** If `_db.close()` fails silently, stale WAL/SHM files from the old database could interfere with the newly restored database. SQLite uses WAL files based on database version/format checks, so in practice a WAL from a different database would be ignored. But this is an implicit safety guarantee, not an explicit one. The risk is low but nonzero — particularly if the old and new databases happen to share the same WAL version number (unlikely but possible with same-format SQLite files).
- **Recommendation:**
  1. Explicitly remove WAL/SHM files before writing the new database:
     ```typescript
     try { fs.unlinkSync(DB_FILE + '-wal'); } catch {}
     try { fs.unlinkSync(DB_FILE + '-shm'); } catch {}
     ```
  2. After writing the new file and before reopening, run a one-time `PRAGMA wal_checkpoint(TRUNCATE)` to ensure clean state.
  3. Don't silently ignore close errors — log them at minimum.
- **Status:** OPEN

---

### SEC-007: Session Creation Failure Does Not Prevent Login
- **Severity:** INFO
- **File(s):** `src/routes/auth.routes.ts:43–48`
- **Description:** The login handler wraps `teacherService.updateLastLogin()` and `sessionService.insert()` in a try/catch that only logs a warning on failure. Login proceeds to issue JWT cookies regardless of whether the session record was created. If session creation fails (e.g., DB connection issue), the user receives a "success" response with cookies, but all subsequent requests fail because `requireAuth` checks the session exists in the database. The refresh flow also fails because it verifies the session. The user sees a successful login but cannot access any functionality.
- **Evidence:**
  - `auth.routes.ts:43–48`: `try { ... sessionService.insert(...); } catch (e) { console.warn(...) }` — session failure doesn't abort login
  - `middleware.ts:190–199`: `requireAuth` checks `sessionService.get(decoded.sessionId)` and rejects if session is null/revoked/expired
  - `auth.routes.ts:130–135`: refresh endpoint also checks session validity
- **Risk:** No direct security impact. The failure mode is confusing UX — the user sees a successful login but gets 401 on every subsequent request. In a school environment with ~40 teachers logging in during morning rush, a transient DB issue could cause widespread "successful login but can't do anything" confusion. It could also mask monitoring/alerting issues since login appears successful in client logs.
- **Recommendation:**
  1. If session creation fails, return an error instead of proceeding: `return res.status(503).json({ error: 'Session service unavailable' })`.
  2. Alternatively, make session creation optional and adjust `requireAuth` to tolerate missing sessions (but this weakens session management).
  3. At minimum, add server-side alerting when session creation fails, since this indicates a systemic DB issue.
- **Status:** OPEN

## Areas Investigated with No Findings

### Rate Limiter Bypass in Test Mode
`NODE_ENV=test` disables rate limiting (`middleware.ts:12,28,65`). This is standard practice for integration testing and is not a security concern — `NODE_ENV=test` must be explicitly set and would never be set in a production deployment. The code is clear and the comment at line 12 explains the rationale. **No finding.**

### CSRF Protection
All cookies use `sameSite: 'strict'` (`auth.routes.ts:77,83,93`). This is sufficient to prevent CSRF in modern browsers — cross-origin requests never include `SameSite=strict` cookies. No CSRF tokens are needed. The Socket.IO `allowRequest` callback (`server.ts:97–112`) additionally validates the Origin header against `getAllowedOrigins()`. **No finding.**

### Cookie Security in LAN Mode (`COOKIE_SECURE=false`)
When `COOKIE_SECURE=false` (explicit configuration for LAN/internal deployments), cookies lack the `Secure` flag and use plain names instead of `__Host-` prefixes. This is an inherent risk of running without TLS and is explicitly documented in the code comments (`middleware.ts:19–23`). The `__Host-` prefix is correctly omitted when `Secure` is disabled (the prefix requires it). `SameSite: 'strict'` is still set regardless. **No finding** — this is a conscious deployment trade-off, not a vulnerability.

### Socket.IO CORS vs Express CORS Alignment
Express has no explicit CORS middleware (serves same-origin via Vite/static files). Socket.IO has its own CORS config with `getAllowedOrigins()` (`server.ts:87–90`) and a custom `allowRequest` callback (`server.ts:97–112`). These are in sync — both use the same `ALLOWED_ORIGINS` env var or default to localhost. **No finding.**

### Refresh Token Reuse Detection Atomicity
The `rotate()` method (`refresh-token.service.ts:103–116`) uses `WHERE used_at IS NULL` for atomicity — only one concurrent refresh can win the race. The loser detects `changes === 0` and calls `revokeFamily()` (`refresh-token.service.ts:121–128`), which marks all tokens in the family as used. For Postgres, the `UPDATE ... WHERE used_at IS NULL` is atomic at the database level. For SQLite (better-sqlite3, synchronous), the UPDATE is atomic within the single-threaded event loop. **No finding** — the implementation is correct.

### Socket.IO Session Verification
`verifySocketAuth` (`middleware.ts:384–398`) correctly: (a) verifies JWT signature + expiry via `jwt.verify()`, (b) checks `sessionId` against the sessions table for revocation/expiry, (c) updates session activity. The only issue is the cookie name problem (SEC-005), which is a functional bug, not a security bypass. **No finding** beyond SEC-005.
