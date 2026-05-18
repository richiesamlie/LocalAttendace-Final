     1|# Developer Guide — Teacher Assistant
     2|
     3|**Last Updated:** 2026-05-11
     4|**Branch:** `develop`
     5|
     6|---
     7|
     8|## Getting Started
     9|
    10|### Prerequisites
    11|- Node.js 18+
    12|- npm
    13|
    14|### Setup
    15|
    16|```bash
    17|# Clone and install
    18|git clone https://github.com/richiesamlie/LocalAttendace-Final.git
    19|cd LocalAttendace-Final
    20|bun install
    21|
    22|# Generate secrets (required before first run)
    23|.\setup-env.ps1  # Windows
    24|bash setup-env.sh  # Linux/macOS
    25|
    26|# Start dev server
    27|bun run dev
    28|```
    29|
    30|### Environment Variables
    31|
    32|| Variable | Required | Description |
    33||----------|----------|-------------|
    34|| `JWT_SECRET` | **Yes** | JWT signing key. Generate with `openssl rand -hex 32` |
    35|| `DEFAULT_ADMIN_PASSWORD` | **Yes** | Initial admin password. App throws on startup if missing |
    36|| `NODE_ENV` | No | Set to `production` for production mode |
    37|| `DATABASE_URL` | No | PostgreSQL connection string. If set, uses PostgreSQL instead of SQLite |
    38|
    39|---
    40|
    41|## Project Structure
    42|
    43|### Backend
    44|
    45|| File | Lines | Purpose |
    46||------|-------|---------|
    47|| `routes.ts` | 278 | Delegates to `src/routes/*.routes.ts` |
    48|| `src/routes/` | 13 files | Route modules (auth, class, student, etc.) |
    49|| `src/routes/middleware.ts` | 184 | Shared auth/class/role middleware |
    50|| `services.ts` | 715 | Service layer (11 service objects) |
    51|| `src/db/` | 6 files | Database: schema, statements, cache, queue |
    52|
    53|### Frontend
    54|
    55|| File | Lines | Purpose |
    56||------|-------|---------|
    57|| `src/store.ts` | 759 | Zustand store with all state + actions |
    58|| `src/lib/api.ts` | ~80 | Fetch wrapper (all API calls) |
    59|| `src/hooks/useData.ts` | 393 | React Query hooks + sync |
    60|| `src/components/` | 15+ | Page components |
    61|
    62|---
    63|
    64|## How to Add a Feature
    65|
    66|### 1. API Endpoint
    67|
    68|**Create route module** (`src/routes/feature.routes.ts`):
    69|```typescript
    70|import { Router } from 'express';
    71|import { requireAuth, requireClassAccess, withWriteQueue } from './middleware';
    72|import { validate } from '../../lib/validation';
    73|import * as svc from '../../services';
    74|import { mySchema } from '../../lib/validation';
    75|
    76|const router = Router();
    77|
    78|router.get('/', requireAuth, async (req, res) => {
    79|  try {
    80|    const data = await svc.featureService.getAll(req.teacherId);
    81|    res.json(data);
    82|  } catch (error) {
    83|    res.status(500).json({ error: 'Failed to fetch' });
    84|  }
    85|});
    86|
    87|router.post('/', requireAuth, requireClassAccess(), withWriteQueue, validate(mySchema), async (req, res) => {
    88|  try {
    89|    await svc.featureService.create(req.body);
    90|    res.json({ success: true });
    91|  } catch (error) {
    92|    res.status(500).json({ error: 'Failed to create' });
    93|  }
    94|});
    95|
    96|export default router;
    97|```
    98|
    99|**Register in `src/routes/index.ts`:**
   100|```typescript
   101|import featureRouter from './feature.routes';
   102|// ... add to imports
   103|
   104|export { authRouter, classRouter, featureRouter, /* ... */ };
   105|```
   106|
   107|**Mount in `routes.ts`:**
   108|```typescript
   109|router.use('/features', featureRouter);
   110|```
   111|
   112|### 2. Database Access
   113|
   114|**Add prepared statement** (`src/db/statements.ts`):
   115|```typescript
   116|export const preparedStatements = {
   117|  // ... existing statements
   118|  getFeatureById: _db.prepare('SELECT * FROM features WHERE id = ?'),
   119|  insertFeature: _db.prepare('INSERT INTO features (id, name) VALUES (?, ?)'),
   120|};
   121|```
   122|
   123|### 3. Service Layer
   124|
   125|**Add to `services.ts`:**
   126|```typescript
   127|export const featureService = {
   128|  async getAll(teacherId: string) {
   129|    return db.stmt.getFeatureById.all();
   130|  },
   131|  async create(data: FeatureData) {
   132|    return db.enqueueWrite(() => {
   133|      db.stmt.insertFeature.run(data.id, data.name);
   134|    });
   135|  },
   136|};
   137|```
   138|
   139|### 4. Frontend Store Action
   140|
   141|**Add to `src/store.ts`:**
   142|```typescript
   143|setFeature: async (data) => {
   144|  try {
   145|    await api.createFeature(data);
   146|    set(state => updateCurrentClass(state, { /* updates */ }));
   147|    toast.success('Feature created');
   148|  } catch {
   149|    toast.error('Failed to create feature');
   150|  }
   151|},
   152|```
   153|
   154|### 5. API Client
   155|
   156|**Add to `src/lib/api.ts`:**
   157|```typescript
   158|export async function createFeature(data: FeatureData) {
   159|  const res = await fetchApi('/features', {
   160|    method: 'POST',
   161|    body: data,
   162|  });
   163|  return res;
   164|}
   165|```
   166|
   167|---
   168|
   169|## Coding Conventions
   170|
   171|### TypeScript
   172|- Use explicit types over `any`
   173|- Prefer `unknown` + type guard for truly dynamic data
   174|- Extract shared types to `src/types/`
   175|
   176|### React Components
   177|- Subscribe to specific store slices: `useStore(s => s.field)`
   178|- No prop drilling — read directly from Zustand
   179|- Use `useClickOutside` hook for all dropdowns
   180|- Sort lists with numeric awareness: `localeCompare(a.rollNumber, b.rollNumber, { numeric: true })`
   181|
   182|### Store Actions
   183|- API call first, then state update
   184|- Only update state on success
   185|- Show toast on error
   186|- Use `updateCurrentClass()` for class-level data
   187|
   188|### API Layer
   189|- All fetches go through `api.ts`
   190|- Always include `credentials: 'include'`
   191|- Parse JSON error body on non-2xx
   192|
   193|### Validation
   194|- All user input validated with Zod schemas
   195|- Use `safeString()` for string fields (strips null bytes + trims)
   196|- Date fields use `.refine()` with regex: `/^\d{4}-\d{2}-\d{2}$/`
   197|
   198|### Error Handling
   199|- Use `react-hot-toast` for notifications — NO `alert()` or `confirm()`
   200|- Store actions wrap in try/catch with toast on error
   201|
   202|---
   203|
   204|## State Management
   205|
   206|State architecture now lives in the active docs set:
   207|- High-level flow: `architecture.md`
   208|- API/state interaction patterns: this file (`developer-guide.md`)
   209|
   210|Quick reference:
   211|
   212|**When to use Zustand:**
   213|- Auth operations
   214|- Class switching
   215|- Bulk data operations
   216|- Anything needing toast feedback
   217|
   218|**When to use React Query:**
   219|- Background sync
   220|- Cached reads
   221|- Optimistic updates
   222|
   223|---
   224|
   225|## Testing
   226|
   227|### Unit Tests (Vitest)
   228|```bash
   229|bun run vitest run     # Run tests
   230|bun run vitest --ui    # With UI
   231|bunx vitest run src/test/validation.test.ts  # Specific file
   232|bunx vitest run src/test/authz.integration.test.ts  # AuthZ guard regression tests
   233|```
   234|
   235|### E2E Tests (Playwright)
   236|```bash
   237|bunx playwright test           # Run all
   238|bunx playwright test auth      # Specific test
   239|```
   240|
   241|**Note:** E2E tests share a single database. Run serially or with clean DB between runs.
   242|
   243|### Coverage
   244|```bash
   245|bunx vitest run --coverage
   246|```
   247|
   248|---
   249|
   250|## Common Tasks
   251|
   252|### Adding a Student Field
   253|
   254|1. **Database:** Add column in `src/db/schema.ts` migration block
   255|2. **Statement:** Add prepared statement in `src/db/statements.ts`
   256|3. **Service:** Update service if needed in `services.ts`
   257|4. **Types:** Add to `src/types/store.ts` interface
   258|5. **Store:** Add update logic in appropriate store action
   259|6. **Component:** Display in UI
   260|
   261|### Adding a New Schema
   262|
   263|1. **Schema:** Add Zod schema to `src/lib/validation.ts`
   264|2. **Validation middleware:** Use `validate(schemaName)` in route handler
   265|3. **Tests:** Add validation tests in `src/test/validation.test.ts`
   266|
   267|### Modifying db.ts
   268|
   269|- Always add migrations for schema changes
   270|- Check if column/index/trigger exists before creating
   271|- Use `db.stmt` for prepared statements
   272|
   273|---
   274|
   275|## Scripts
   276|
   277|```bash
   278|# Development
   279|bun run dev              # Dev server (localhost)
   280|bun run dev:network      # Dev server (LAN access)
   281|
   282|# Production
   283|bun run build            # Build frontend
   284|npm start                # Production server
   285|bun run start:network    # Production server (LAN access)
   286|
   287|# TypeScript
   288|bun run lint             # tsc --noEmit
   289|
   290|# Database
   291|bun run db:backup        # Backup to backups/
   292|bun run db:restore       # Restore from backup
   293|bun run db:seed          # Seed with test data
   294|bun run db:fresh         # Fresh start (backup + restore)
   295|
   296|# Docker
   297|bun run docker:build     # Build image
   298|bun run docker:up        # Start containers
   299|bun run docker:down      # Stop containers
   300|bun run docker:logs      # View logs
   301|```
   302|
   303|---
   304|
   305|## Git Workflow
   306|
   307|```bash
   308|# Create feature branch
   309|git checkout -b feature/my-feature
   310|
   311|# Make changes, commit incrementally
   312|git add .
   313|git commit -m "feat(module): description"
   314|
   315|# Run checks before commit
   316|bun run lint
   317|bunx vitest run
   318|
   319|# Push and create PR
   320|git push -u origin feature/my-feature
   321|gh pr create --title "feat: description"
   322|```
   323|
   324|### Commit Message Format
   325|- `fix(module): description` — Bug fix
   326|- `feat(module): description` — New feature
   327|- `docs(module): description` — Documentation
   328|- `refactor(module): description` — Refactoring
   329|- `test(module): description` — Tests
   330|
   331|---
   332|
   333|## See Also
   334|
   335|- `architecture.md` — System design and data flow
   336|- `api-reference.md` — All API endpoints
   337|- `troubleshooting.md` — Common issues and fixes
   338|- `documentation-map.md` — Active documentation index
   339|