     1|# Troubleshooting — Teacher Assistant
     2|
     3|**Last Updated:** 2026-05-11
     4|**Branch:** `develop`
     5|
     6|---
     7|
     8|## Quick Indonesian Notes
     9|
    10|- Jika app tidak bisa start, cek dulu `.env` dan pastikan `JWT_SECRET` + `DEFAULT_ADMIN_PASSWORD` terisi.
    11|- Jika login gagal, verifikasi password terbaru (bukan default hardcoded).
    12|- Jika import Excel bermasalah, kecilkan file/sheet lalu coba lagi.
    13|- Jalankan `bun run lint` dan `bun run test` untuk validasi cepat kondisi sistem.
    14|
    15|---
    16|
    17|## Common Issues
    18|
    19|### App won't start — "DEFAULT_ADMIN_PASSWORD environment variable is required"
    20|
    21|**Cause:** Missing required environment variable.
    22|
    23|**Fix:** Run the setup script:
    24|```bash
    25|.\setup-env.ps1  # Windows
    26|bash setup-env.sh  # Linux/macOS
    27|```
    28|
    29|Or create `.env` manually:
    30|```env
    31|JWT_SECRET=your_64_char_hex_secret
    32|DEFAULT_ADMIN_PASSWORD=your_password
    33|```
    34|
    35|---
    36|
    37|### "Cannot find module 'better-sqlite3'"
    38|
    39|**Cause:** Dependencies not installed.
    40|
    41|**Fix:**
    42|```bash
    43|bun install
    44|```
    45|
    46|---
    47|
    48|### TypeScript errors after pulling
    49|
    50|**Cause:** Stale build artifacts or dependencies out of sync.
    51|
    52|**Fix:**
    53|```bash
    54|bun install
    55|bun run lint
    56|```
    57|
    58|---
    59|
    60|### Database "locked" errors
    61|
    62|**Cause:** Multiple write operations competing for SQLite write lock.
    63|
    64|**Fix:** All writes are serialized via `db.enqueueWrite()`. If errors persist:
    65|1. Restart the server
    66|2. Check for stuck write operations in logs
    67|
    68|---
    69|
    70|### Login fails with correct credentials
    71|
    72|**Cause:** Session expired or server clock drift.
    73|
    74|**Fix:**
    75|1. Clear cookies and try again
    76|2. Check server time is accurate
    77|3. JWT has 7-day expiry — session may need re-login
    78|
    79|---
    80|
    81|### Changes not appearing in app
    82|
    83|**Cause:** Stale React Query cache.
    84|
    85|**Fix:** Refresh the page or logout/login again. React Query caches data for 5s-30s.
    86|
    87|---
    88|
    89|### "Database is locked" during restore
    90|
    91|**Cause:** Write queue not drained before restore.
    92|
    93|**Fix:** `db.restore()` in `src/db/index.ts` already drains the write queue first. If issue persists, stop all server operations and retry.
    94|
    95|---
    96|
    97|### Build fails with large chunk warning
    98|
    99|**Cause:** Large bundle size (excel.js is 437KB).
   100|
   101|**Fix:** This is a known issue. The warning is informational. Consider code-splitting if build becomes problematic.
   102|
   103|---
   104|
   105|## Known Quirks
   106|
   107|### Class ID Format
   108|
   109|Client-generated IDs use `class_${Date.now()}` format. If two classes are created in the same millisecond, IDs collide. Consider `crypto.randomUUID()` for new ID generation.
   110|
   111|### SQLite WAL Files
   112|
   113|`database.sqlite-wal` and `database.sqlite-shm` are normal — SQLite WAL mode creates them. Do not delete them while server is running.
   114|
   115|### E2E Test Database
   116|
   117|E2E tests share a single database. Running in parallel causes flaky failures. Run tests serially or with clean DB between runs.
   118|
   119|### Sidebar Class Badge
   120|
   121|`Sidebar.tsx` uses `useStore.getState()` inside JSX render for badge label — known anti-pattern but harmless since classes rarely change mid-render.
   122|
   123|### Write Queue "async"
   124|
   125|`processWriteQueue()` is declared `async` but `better-sqlite3` is synchronous. The `await` is a no-op for SQLite but exists for future-proofing if an async storage backend is added.
   126|
   127|---
   128|
   129|## Error Messages
   130|
   131|### "Failed to initialize store from API"
   132|- Network/API issue during app initialization
   133|- Check server is running and accessible
   134|
   135|### "Failed to add student"
   136|- Server returned error
   137|- Check server logs for details
   138|- Verify classId is set (currentClassId in store)
   139|
   140|### "Failed to save attendance record"
   141|- API call failed
   142|- Check studentId, classId, date are valid
   143|- Verify record doesn't conflict with existing data
   144|
   145|### "Authentication service unavailable"
   146|- Session check failed (DB error)
   147|- Server may need restart
   148|
   149|### "Invalid invite code"
   150|- Code expired (default: 7 days)
   151|- Code already used
   152|- Code doesn't exist
   153|
   154|---
   155|
   156|## Migration Issues
   157|
   158|### PostgreSQL migration fails
   159|
   160|**Check:**
   161|1. PostgreSQL is running
   162|2. Database exists: `createdb teacher_assistant`
   163|3. Schema applied: `psql -U postgres -d teacher_assistant -f src/repositories/schema.sql`
   164|4. Connection string correct in `DATABASE_URL`
   165|
   166|---
   167|
   168|## Performance
   169|
   170|### Slow queries
   171|
   172|**Check:**
   173|1. Indexes are created (20+ indexes on common query patterns)
   174|2. WAL mode enabled (pragma `journal_mode=WAL`)
   175|3. Cache hit rate (5s TTL for most data)
   176|
   177|### High memory usage
   178|
   179|**Cause:** Large Excel files being processed, large student rosters.
   180|
   181|**Fix:** Process Excel imports in batches if memory is an issue.
   182|
   183|---
   184|
   185|## Security
   186|
   187|### Accidentally exposed secrets
   188|
   189|**If JWT_SECRET or DEFAULT_ADMIN_PASSWORD leaked:**
   190|1. Change the secrets immediately
   191|2. All existing sessions become invalid
   192|3. Users must re-login with new admin password
   193|
   194|### Found SQL injection
   195|
   196|**Report:** Prepared statements are used throughout. If you find a case that bypasses them, report immediately.
   197|
   198|---
   199|
   200|## Getting Help
   201|
   202|### Logs
   203|
   204|Server logs are written to console. For production, redirect to file:
   205|```bash
   206|npm start 2>&1 | tee server.log
   207|```
   208|
   209|### Debug Mode
   210|
   211|Run with Vite's HMR for hot reloading:
   212|```bash
   213|bun run dev
   214|```
   215|
   216|### Check Status
   217|
   218|```bash
   219|# Type check
   220|bun run lint
   221|
   222|# Run tests
   223|bunx vitest run
   224|
   225|# Check routes
   226|curl http://localhost:3000/api/health
   227|```
   228|
   229|---
   230|
   231|## See Also
   232|
   233|- `architecture.md` — System design
   234|- `developer-guide.md` — How to add features
   235|- `documentation-map.md` — Active documentation index
   236|