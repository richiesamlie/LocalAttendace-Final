# Developer Guide — Teacher Assistant

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Clone and install
git clone https://github.com/richiesamlie/LocalAttendace-Final.git
cd LocalAttendace-Final
npm install

# Generate secrets (required before first run)
.\setup-env.ps1  # Windows
bash setup-env.sh  # Linux/macOS

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | JWT signing key. Generate with `openssl rand -hex 32` |
| `DEFAULT_ADMIN_PASSWORD` | **Yes** | Initial admin password. App throws on startup if missing |
| `NODE_ENV` | No | Set to `production` for production mode |
| `DATABASE_URL` | No | PostgreSQL connection string. If set, uses PostgreSQL instead of SQLite |

---

## Project Structure

### Backend

| File | Lines | Purpose |
|------|-------|---------|
| `routes.ts` | 278 | Delegates to `src/routes/*.routes.ts` |
| `src/routes/` | 13 files | Route modules (auth, class, student, etc.) |
| `src/routes/middleware.ts` | 184 | Shared auth/class/role middleware |
| `services.ts` | 715 | Service layer (11 service objects) |
| `src/db/` | 6 files | Database: schema, statements, cache, queue |

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `src/store.ts` | 759 | Zustand store with all state + actions |
| `src/lib/api.ts` | ~80 | Fetch wrapper (all API calls) |
| `src/hooks/useData.ts` | 393 | React Query hooks + sync |
| `src/components/` | 15+ | Page components |

---

## How to Add a Feature

### 1. API Endpoint

**Create route module** (`src/routes/feature.routes.ts`):
```typescript
import { Router } from 'express';
import { requireAuth, requireClassAccess, withWriteQueue } from './middleware';
import { validate } from '../../lib/validation';
import * as svc from '../../services';
import { mySchema } from '../../lib/validation';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await svc.featureService.getAll(req.teacherId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

router.post('/', requireAuth, requireClassAccess(), withWriteQueue, validate(mySchema), async (req, res) => {
  try {
    await svc.featureService.create(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create' });
  }
});

export default router;
```

**Register in `src/routes/index.ts`:**
```typescript
import featureRouter from './feature.routes';
// ... add to imports

export { authRouter, classRouter, featureRouter, /* ... */ };
```

**Mount in `routes.ts`:**
```typescript
router.use('/features', featureRouter);
```

### 2. Database Access

**Add prepared statement** (`src/db/statements.ts`):
```typescript
export const preparedStatements = {
  // ... existing statements
  getFeatureById: _db.prepare('SELECT * FROM features WHERE id = ?'),
  insertFeature: _db.prepare('INSERT INTO features (id, name) VALUES (?, ?)'),
};
```

### 3. Service Layer

**Add to `services.ts`:**
```typescript
export const featureService = {
  async getAll(teacherId: string) {
    return db.stmt.getFeatureById.all();
  },
  async create(data: FeatureData) {
    return db.enqueueWrite(() => {
      db.stmt.insertFeature.run(data.id, data.name);
    });
  },
};
```

### 4. Frontend Store Action

**Add to `src/store.ts`:**
```typescript
setFeature: async (data) => {
  try {
    await api.createFeature(data);
    set(state => updateCurrentClass(state, { /* updates */ }));
    toast.success('Feature created');
  } catch {
    toast.error('Failed to create feature');
  }
},
```

### 5. API Client

**Add to `src/lib/api.ts`:**
```typescript
export async function createFeature(data: FeatureData) {
  const res = await fetchApi('/features', {
    method: 'POST',
    body: data,
  });
  return res;
}
```

---

## Coding Conventions

### TypeScript
- Use explicit types over `any`
- Prefer `unknown` + type guard for truly dynamic data
- Extract shared types to `src/types/`

### React Components
- Subscribe to specific store slices: `useStore(s => s.field)`
- No prop drilling — read directly from Zustand
- Use `useClickOutside` hook for all dropdowns
- Sort lists with numeric awareness: `localeCompare(a.rollNumber, b.rollNumber, { numeric: true })`

### Store Actions
- API call first, then state update
- Only update state on success
- Show toast on error
- Use `updateCurrentClass()` for class-level data

### API Layer
- All fetches go through `api.ts`
- Always include `credentials: 'include'`
- Parse JSON error body on non-2xx

### Validation
- All user input validated with Zod schemas
- Use `safeString()` for string fields (strips null bytes + trims)
- Date fields use `.refine()` with regex: `/^\d{4}-\d{2}-\d{2}$/`

### Error Handling
- Use `react-hot-toast` for notifications — NO `alert()` or `confirm()`
- Store actions wrap in try/catch with toast on error

---

## State Management

See `STATE_MANAGEMENT.md` for full details. Quick reference:

**When to use Zustand:**
- Auth operations
- Class switching
- Bulk data operations
- Anything needing toast feedback

**When to use React Query:**
- Background sync
- Cached reads
- Optimistic updates

---

## Testing

### Unit Tests (Vitest)
```bash
npm run vitest run     # Run tests
npm run vitest --ui    # With UI
npx vitest run src/test/validation.test.ts  # Specific file
```

### E2E Tests (Playwright)
```bash
npx playwright test           # Run all
npx playwright test auth      # Specific test
```

**Note:** E2E tests share a single database. Run serially or with clean DB between runs.

### Coverage
```bash
npx vitest run --coverage
```

---

## Common Tasks

### Adding a Student Field

1. **Database:** Add column in `src/db/schema.ts` migration block
2. **Statement:** Add prepared statement in `src/db/statements.ts`
3. **Service:** Update service if needed in `services.ts`
4. **Types:** Add to `src/types/store.ts` interface
5. **Store:** Add update logic in appropriate store action
6. **Component:** Display in UI

### Adding a New Schema

1. **Schema:** Add Zod schema to `src/lib/validation.ts`
2. **Validation middleware:** Use `validate(schemaName)` in route handler
3. **Tests:** Add validation tests in `src/test/validation.test.ts`

### Modifying db.ts

- Always add migrations for schema changes
- Check if column/index/trigger exists before creating
- Use `db.stmt` for prepared statements

---

## Scripts

```bash
# Development
npm run dev              # Dev server (localhost)
npm run dev:network      # Dev server (LAN access)

# Production
npm run build            # Build frontend
npm start                # Production server
npm run start:network    # Production server (LAN access)

# TypeScript
npm run lint             # tsc --noEmit

# Database
npm run db:backup        # Backup to backups/
npm run db:restore       # Restore from backup
npm run db:seed          # Seed with test data
npm run db:fresh         # Fresh start (backup + restore)

# Docker
npm run docker:build     # Build image
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
npm run docker:logs      # View logs
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit incrementally
git add .
git commit -m "feat(module): description"

# Run checks before commit
npm run lint
npx vitest run

# Push and create PR
git push -u origin feature/my-feature
gh pr create --title "feat: description"
```

### Commit Message Format
- `fix(module): description` — Bug fix
- `feat(module): description` — New feature
- `docs(module): description` — Documentation
- `refactor(module): description` — Refactoring
- `test(module): description` — Tests

---

## See Also

- `ARCHITECTURE.md` — System design and data flow
- `STATE_MANAGEMENT.md` — State architecture in depth
- `API_REFERENCE.md` — All API endpoints
- `TROUBLESHOOTING.md` — Common issues and fixes
- `IMPROVEMENT_PLAN.md` — Technical debt roadmap