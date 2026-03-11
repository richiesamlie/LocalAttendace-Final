import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

describe('Zustand UI Store', () => {
  // Try to use the store to get the state and verify it instead of overriding the inner set func first.
  beforeEach(() => {
    // Zustand reset (simplified for test)
    useStore.setState({
      theme: 'light',
      currentClassId: null,
      isInitialized: false,
    });
  });

  it('should have the correct initial state', () => {
    const state = useStore.getState();
    expect(state.theme).toBe('light');
    expect(state.currentClassId).toBe(null);
    expect(state.isInitialized).toBe(false);
  });

  it('should toggle theme from light to dark', async () => {
    const state = useStore.getState();
    await state.toggleTheme();
    expect(useStore.getState().theme).toBe('dark');
  });

  it('should toggle theme from dark to light', async () => {
    useStore.setState({ theme: 'dark' });
    const state = useStore.getState();
    await state.toggleTheme();
    expect(useStore.getState().theme).toBe('light');
  });

});
