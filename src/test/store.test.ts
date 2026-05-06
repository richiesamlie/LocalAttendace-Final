import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../store';
import * as apiModule from '../lib/api';

// Mock the API module
vi.mock('../lib/api', () => ({
  api: {
    saveSetting: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Zustand UI Store', () => {
  beforeEach(() => {
    // Reset Zustand state
    useStore.setState({
      theme: 'light',
      currentClassId: null,
      isInitialized: false,
    });
    
    // Clear mock calls
    vi.clearAllMocks();
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
    expect(apiModule.api.saveSetting).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should toggle theme from dark to light', async () => {
    useStore.setState({ theme: 'dark' });
    const state = useStore.getState();
    await state.toggleTheme();
    
    expect(useStore.getState().theme).toBe('light');
    expect(apiModule.api.saveSetting).toHaveBeenCalledWith('theme', 'light');
  });

});
