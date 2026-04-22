# State Management Guide

**Last Updated:** 2026-04-22
**Branch:** `feature/split-routes-v2`

---

## Overview

The app uses a **hybrid state management** approach combining:
- **Zustand** (`store.ts`) — Primary state source
- **React Query** (`useData.ts`) — Request deduplication and caching

This doc explains when to use which layer.

---

## State Layers

### 1. Zustand Store (`src/store.ts`)

**Primary state source** for all application data. Contains:

| Category | Fields |
|----------|--------|
| **Auth** | `teacherId`, `teacherName`, `isAdmin`, `isAuthenticated` |
| **UI** | `theme`, `isLoading` |
| **Class List** | `classes[]` (array of all classes with full data) |
| **Current Class** | `currentClassId` + flat fields (`students`, `records`, `events`, `timetable`, `seatingLayout`, `dailyNotes`) |
| **Undo** | `lastAttendanceChange` (for attendance undo) |

**Key patterns:**
- `initializeStore()` — Loads first class eagerly, others lazily
- `setCurrentClass(id)` — Switches current class, loads data if needed
- `updateCurrentClass(updates)` — Updates both flat fields AND class entry (synced)
- `loadClassData(classId)` — Lazy-loads class data on first access

### 2. React Query Hooks (`src/hooks/useData.ts`)

**Request deduplication and caching** layer:

| Hook | Purpose | Cache Time |
|------|---------|------------|
| `useStudents(classId)` | Fetch students | 5s stale |
| `useRecords(classId)` | Fetch attendance records | 5s stale |
| `useEvents(classId)` | Fetch calendar events | 5s stale |
| `useTimetable(classId)` | Fetch timetable | 5s stale |
| `useSeating(classId)` | Fetch seating layout | 5s stale |
| `useDailyNotes(classId)` | Fetch daily notes | 5s stale |
| `useClassSync(interval)` | Background sync (30s default) | - |

Mutation hooks (`useCreateStudent`, `useSaveRecords`, etc.) automatically invalidate React Query cache.

---

## When to Use What

### Use Zustand Store When:
1. **Auth operations** — `setAuth`, `clearAuth`
2. **Class switching** — `setCurrentClass`
3. **Bulk data operations** — `addClass`, `removeClass`
4. **Attendance with undo** — `setRecord`, `undoLastAttendance`
5. **Anything requiring immediate UI feedback** via toast notifications

### Use React Query Hooks When:
1. **Fetching fresh data** without triggering store update
2. **Background sync** — `useClassSync` polls for changes
3. **Optimistic UI updates** — Read from cache while mutation in flight
4. **Complex components** that need data without coupling to store

### Example: Adding a Student

```typescript
// Option A: Via Zustand store (preferred for single operations)
const addStudent = async (student: Student) => {
  await api.createStudent(classId, student);
  // Store action handles both API call and state update
  store.getState().addStudent(student);
};

// Option B: Via React Query (for optimistic updates)
const { mutate } = useCreateStudent();
mutate({ classId, student });
// React Query invalidates cache, store reloads on next access
```

### Example: Displaying Attendance Records

```typescript
// Option A: Via Zustand (reactive, from current class)
const records = useStore(state => state.records);

// Option B: Via React Query (cached, may be stale)
const { data: records } = useRecords(classId);
```

---

## Data Flow

```
User Action
    │
    ▼
Zustand Store Action ──────────────────────► API Call
    │                                            │
    ▼                                            ▼
State Update ─────────────────────────────► Response
    │                                            │
    ▼                                            ▼
UI Re-render ◄────────────────────────────── Cache Update
                   React Query
```

**Sync mechanism:**
1. Store action calls API
2. API response updates store state (via `updateCurrentClass`)
3. React Query cache becomes stale
4. `useClassSync` polls and detects mismatch
5. `reloadClassData` re-fetches and re-syncs

---

## updateCurrentClass Helper

The `updateCurrentClass` helper keeps flat fields and class entries in sync:

```typescript
// Updates both:
// - state.students (flat field for current class)
// - state.classes[currentClassId].students (class entry)

set(state => updateCurrentClass(state, { students: newStudents }));
```

**Type-safe updates:**
```typescript
type ClassDataUpdatableFields = Pick<
  ClassData,
  'students' | 'records' | 'dailyNotes' | 'events' | 'timetable' | 'seatingLayout'
>;
```

Only class-level fields can be passed. Top-level state fields (like `isLoading`, `currentClassId`) cannot be accidentally updated via `updateCurrentClass`.

---

## Common Patterns

### Reading Current Class Data
```typescript
const students = useStore(state => state.students);
const records = useStore(state => state.records);
```

### Switching Classes
```typescript
const setCurrentClass = useStore(state => state.setCurrentClass);
await setCurrentClass(classId);
```

### Listening to Auth Changes
```typescript
const isAuthenticated = useStore(state => state.isAuthenticated);
const teacherId = useStore(state => state.teacherId);
```

### Background Sync
```typescript
// In App.tsx or a layout component
useClassSync(30000); // Poll every 30 seconds
```

---

## Anti-Patterns to Avoid

1. **Don't modify flat fields directly** — Always use `updateCurrentClass` or individual setters
2. **Don't read from `classes[]` for current class data** — Use flat fields (they're kept in sync)
3. **Don't bypass store for mutations** — Use store actions which handle both API and state update
4. **Don't mix React Query and store for same data** — Pick one, preferably store for writes

---

## Future Improvements

1. **Full slice extraction** — Split store.ts into `src/store/slices/`
2. **Consolidate state** — Either pure Zustand OR pure React Query (not hybrid)
3. **Derived state mechanism** — Compute flat fields from `classes[]` instead of maintaining two copies

Currently recommended: **Option C** (keep hybrid, document clearly) per IMPROVEMENT_PLAN.