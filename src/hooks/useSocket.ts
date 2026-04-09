import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { queryKeys } from './useData';

/**
 * Singleton socket.io client instance.
 *
 * We keep this outside the hook so all component re-renders share the same
 * physical connection — there is never more than one WebSocket open at a time.
 *
 * The socket connects to the same origin (same host + port) as the Express
 * server, but uses the custom path /ws/socket.io to avoid collisions with
 * the REST API namespace.
 */
const socket: Socket = io({
  autoConnect: false,
  path: '/ws/socket.io',
  // Reconnect automatically with exponential back-off
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
});

/**
 * useSocket — manages real-time class data sync via WebSockets.
 *
 * How it works:
 *  1. When the user authenticates, the socket connects to the server.
 *  2. When the user switches to a class (currentClassId changes), the socket
 *     joins that class "room" and leaves the previous one.
 *  3. When the server emits an update event (e.g. "records_updated"), we call
 *     queryClient.invalidateQueries() for the relevant React Query key.
 *     React Query then re-fetches fresh data in the background and updates
 *     the UI automatically — no manual state management needed.
 *  4. On logout (isAuthenticated becomes false), the socket disconnects.
 *
 * Usage: call this hook once in App.tsx — it has no return value.
 */
export function useSocket() {
  const currentClassId = useStore((state) => state.currentClassId);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  // Keep a ref to the previous classId so we can send "leave_class" before
  // joining the new room. Using a ref avoids triggering extra renders.
  const prevClassIdRef = useRef<string | null>(null);

  // --- Connection lifecycle ---
  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect cleanly on logout
      if (socket.connected) socket.disconnect();
      return;
    }

    socket.connect();

    socket.on('connect', () => {
      // Re-join the current class room after a reconnection
      if (currentClassId) {
        socket.emit('join_class', currentClassId);
      }
    });

    return () => {
      socket.off('connect');
      socket.disconnect();
    };
    // We intentionally only run this when auth status changes, not on every
    // currentClassId change (that is handled by the effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // --- Room management + event listeners ---
  useEffect(() => {
    if (!isAuthenticated || !currentClassId) return;

    // Leave previous room if we are switching classes
    if (prevClassIdRef.current && prevClassIdRef.current !== currentClassId) {
      socket.emit('leave_class', prevClassIdRef.current);
    }
    prevClassIdRef.current = currentClassId;

    // Join the new class room
    socket.emit('join_class', currentClassId);

    // ----- Event listeners -----
    // Each listener invalidates a specific React Query cache key, causing
    // React Query to silently re-fetch that slice of data in the background.

    const onRecordsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.records(currentClassId) });
    };

    const onStudentsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students(currentClassId) });
    };

    const onSeatingUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seating(currentClassId) });
    };

    const onEventsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(currentClassId) });
    };

    const onNotesUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyNotes(currentClassId) });
    };

    const onTimetableUpdated = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable(currentClassId) });
    };

    socket.on('records_updated',  onRecordsUpdated);
    socket.on('students_updated', onStudentsUpdated);
    socket.on('seating_updated',  onSeatingUpdated);
    socket.on('events_updated',   onEventsUpdated);
    socket.on('notes_updated',    onNotesUpdated);
    socket.on('timetable_updated', onTimetableUpdated);

    return () => {
      // Remove listeners for this class — they will be re-attached for the
      // next class in the next effect run.
      socket.off('records_updated',  onRecordsUpdated);
      socket.off('students_updated', onStudentsUpdated);
      socket.off('seating_updated',  onSeatingUpdated);
      socket.off('events_updated',   onEventsUpdated);
      socket.off('notes_updated',    onNotesUpdated);
      socket.off('timetable_updated', onTimetableUpdated);
    };
  }, [isAuthenticated, currentClassId, queryClient]);
}
