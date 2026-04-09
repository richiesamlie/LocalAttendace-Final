# Real-time Sync — WebSocket Architecture

This document describes how live data synchronisation works in Teacher Assistant using WebSockets.

## What It Does

When multiple teachers are viewing the **same class** on different devices, any data change made by one teacher is instantly reflected on every other device — without anyone needing to refresh the page.

**Supported real-time events:**

| Data Type | Event Name | Triggered By |
|---|---|---|
| Attendance Records | `records_updated` | Marking/changing attendance |
| Students | `students_updated` | Add, edit, archive, sync |
| Seating Chart | `seating_updated` | Moving seats or clearing layout |
| Calendar Events | `events_updated` | Add, edit, delete events |
| Daily Notes | `notes_updated` | Saving a daily note |
| Timetable | `timetable_updated` | Add, edit, delete timetable slots |

---

## Architecture

We use [Socket.io](https://socket.io) which runs on top of the same HTTP server as the REST API (port 3000, path `/ws/socket.io`).

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                 │
│                                                     │
│  useSocket() hook                                   │
│  ├── connects socket on login                       │
│  ├── emits "join_class" when class is selected      │
│  ├── listens for events (e.g. "records_updated")    │
│  └── calls queryClient.invalidateQueries() → re-fetch│
└──────────────────┬──────────────────────────────────┘
                   │ WebSocket (ws://localhost:3000/ws)
┌──────────────────▼──────────────────────────────────┐
│                Node.js Server (server.ts)            │
│                                                     │
│  Socket.io Server                                   │
│  ├── handles "join_class" → socket.join(classId)    │
│  └── handles "leave_class" → socket.leave(classId)  │
│                                                     │
│  REST API (routes.ts)                               │
│  └── after each DB write → io.to(classId).emit(...) │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

**1. Rooms per Class ID**
Each class has its own Socket.io "room" (identified by the `classId`). Only teachers who are currently viewing that class are in the room. This prevents broadcasting unnecessary data to unrelated teachers.

**2. Signal-only events (no data in WebSocket)**
The server emits *only an event name*, not the actual data payload. The browser then uses React Query's `invalidateQueries()` to silently re-fetch via the normal REST API. This approach:
- Keeps WebSocket messages tiny
- Avoids duplicating data serialisation / auth logic
- Means the REST API remains the single source of truth

**3. Polling as a safety net**
The existing `useClassSync` polling remains active (reduced from 30s → 120s). If the WebSocket connection drops temporarily (e.g. Wi-Fi blip), polling silently picks up any missed changes within 2 minutes. Socket.io also reconnects automatically (up to 10 retries, exponential back-off).

---

## Files Changed

| File | Type | Purpose |
|---|---|---|
| `server.ts` | Modified | Attach Socket.io to http.Server, export `io`, handle rooms |
| `routes.ts` | Modified | Emit events after each DB mutation |
| `src/hooks/useSocket.ts` | **New** | Browser-side socket lifecycle + event listeners |
| `src/App.tsx` | Modified | Activate `useSocket()`, reduce poll interval |

---

## How to Add a New Real-time Event

If you add a new feature that mutates data in a class, follow these two steps:

### 1. In `routes.ts` — emit after the DB write

```ts
// After the database operation succeeds:
io?.to(classId).emit('my_new_feature_updated');
```

### 2. In `src/hooks/useSocket.ts` — add a listener

```ts
const onMyFeatureUpdated = () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.myNewFeature(currentClassId) });
};

socket.on('my_new_feature_updated', onMyFeatureUpdated);

// ...and in the cleanup return:
socket.off('my_new_feature_updated', onMyFeatureUpdated);
```

That's it — two lines per new event.

---

## Testing Real-time Sync

### Manual Test
1. Open the app in **two separate browser windows** (or two different devices on the same network).
2. Log in on both. Open the same class on both.
3. In Window 1 — take attendance (mark a student "Present").
4. Watch Window 2 — the attendance status should update within ~100–200ms **without refreshing**.

### Checking the WebSocket Connection (Browser Dev Tools)
1. Open Chrome DevTools → Network tab → filter by `WS` (WebSocket).
2. Click the WebSocket connection to `/ws/socket.io/?...`.
3. Go to the "Messages" tab — you should see `join_class` being sent and events like `records_updated` being received.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Updates don't appear on 2nd device | Socket not connected | Check Network tab for WS connection |
| "io is not defined" error in routes | Circular import issue | Ensure server.ts exports `io` before routes.ts imports it |
| Updates delayed by ~2 minutes | Socket disconnected, fell back to polling | Check server logs for disconnect errors |
| `socket.io-client` not found | Packages not installed | Run `npm install socket.io socket.io-client` |
