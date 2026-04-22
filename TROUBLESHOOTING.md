# Troubleshooting — Teacher Assistant

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

---

## Common Issues

### App won't start — "DEFAULT_ADMIN_PASSWORD environment variable is required"

**Cause:** Missing required environment variable.

**Fix:** Run the setup script:
```bash
.\setup-env.ps1  # Windows
bash setup-env.sh  # Linux/macOS
```

Or create `.env` manually:
```env
JWT_SECRET=your_64_char_hex_secret
DEFAULT_ADMIN_PASSWORD=your_password
```

---

### "Cannot find module 'better-sqlite3'"

**Cause:** Dependencies not installed.

**Fix:**
```bash
npm install
```

---

### TypeScript errors after pulling

**Cause:** Stale build artifacts or dependencies out of sync.

**Fix:**
```bash
npm install
npm run lint
```

---

### Database "locked" errors

**Cause:** Multiple write operations competing for SQLite write lock.

**Fix:** All writes are serialized via `db.enqueueWrite()`. If errors persist:
1. Restart the server
2. Check for stuck write operations in logs

---

### Login fails with correct credentials

**Cause:** Session expired or server clock drift.

**Fix:**
1. Clear cookies and try again
2. Check server time is accurate
3. JWT has 7-day expiry — session may need re-login

---

### Changes not appearing in app

**Cause:** Stale React Query cache.

**Fix:** Refresh the page or logout/login again. React Query caches data for 5s-30s.

---

### "Database is locked" during restore

**Cause:** Write queue not drained before restore.

**Fix:** `db.restore()` in `src/db/index.ts` already drains the write queue first. If issue persists, stop all server operations and retry.

---

### Build fails with large chunk warning

**Cause:** Large bundle size (excel.js is 437KB).

**Fix:** This is a known issue. The warning is informational. Consider code-splitting if build becomes problematic.

---

## Known Quirks

### Class ID Format

Client-generated IDs use `class_${Date.now()}` format. If two classes are created in the same millisecond, IDs collide. Consider `crypto.randomUUID()` for new ID generation.

### SQLite WAL Files

`database.sqlite-wal` and `database.sqlite-shm` are normal — SQLite WAL mode creates them. Do not delete them while server is running.

### E2E Test Database

E2E tests share a single database. Running in parallel causes flaky failures. Run tests serially or with clean DB between runs.

### Sidebar Class Badge

`Sidebar.tsx` uses `useStore.getState()` inside JSX render for badge label — known anti-pattern but harmless since classes rarely change mid-render.

### Write Queue "async"

`processWriteQueue()` is declared `async` but `better-sqlite3` is synchronous. The `await` is a no-op for SQLite but exists for future-proofing if an async storage backend is added.

---

## Error Messages

### "Failed to initialize store from API"
- Network/API issue during app initialization
- Check server is running and accessible

### "Failed to add student"
- Server returned error
- Check server logs for details
- Verify classId is set (currentClassId in store)

### "Failed to save attendance record"
- API call failed
- Check studentId, classId, date are valid
- Verify record doesn't conflict with existing data

### "Authentication service unavailable"
- Session check failed (DB error)
- Server may need restart

### "Invalid invite code"
- Code expired (default: 7 days)
- Code already used
- Code doesn't exist

---

## Migration Issues

### PostgreSQL migration fails

**Check:**
1. PostgreSQL is running
2. Database exists: `createdb teacher_assistant`
3. Schema applied: `psql -U postgres -d teacher_assistant -f src/repositories/schema.sql`
4. Connection string correct in `DATABASE_URL`

---

## Performance

### Slow queries

**Check:**
1. Indexes are created (20+ indexes on common query patterns)
2. WAL mode enabled (pragma `journal_mode=WAL`)
3. Cache hit rate (5s TTL for most data)

### High memory usage

**Cause:** Large Excel files being processed, large student rosters.

**Fix:** Process Excel imports in batches if memory is an issue.

---

## Security

### Accidentally exposed secrets

**If JWT_SECRET or DEFAULT_ADMIN_PASSWORD leaked:**
1. Change the secrets immediately
2. All existing sessions become invalid
3. Users must re-login with new admin password

### Found SQL injection

**Report:** Prepared statements are used throughout. If you find a case that bypasses them, report immediately.

---

## Getting Help

### Logs

Server logs are written to console. For production, redirect to file:
```bash
npm start 2>&1 | tee server.log
```

### Debug Mode

Run with Vite's HMR for hot reloading:
```bash
npm run dev
```

### Check Status

```bash
# Type check
npm run lint

# Run tests
npx vitest run

# Check routes
curl http://localhost:3000/api/health
```

---

## See Also

- `ARCHITECTURE.md` — System design
- `DEVELOPER_GUIDE.md` — How to add features
- `STATE_MANAGEMENT.md` — State architecture
- `IMPROVEMENT_PLAN.md` — Known issues and roadmap