import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFastEditMode } from '../useFastEditMode';
import apiClient from '../../services/apiClient';
import { WebSocketEvent } from '../../types/api';

// Mock dependencies
vi.mock('../../services/apiClient', () => ({
  default: {
    getFastEditMode: vi.fn(),
    toggleFastEditMode: vi.fn(),
  }
}));

// Mock the useWebSocket hook
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({
    subscribe: vi.fn().mockImplementation((event, callback) => {
      // Store the callbacks for testing
      if (event === WebSocketEvent.FAST_EDIT_MODE_ENABLED) {
        (globalThis as any).fastEditModeEnabledCallback = callback;
      } else if (event === WebSocketEvent.FAST_EDIT_MODE_DISABLED) {
        (globalThis as any).fastEditModeDisabledCallback = callback;
      }
      // Return a mock unsubscribe function
      return vi.fn();
    }),
  }),
}));

describe('useFastEditMode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset the global callback references
    (globalThis as any).fastEditModeEnabledCallback = null;
    (globalThis as any).fastEditModeDisabledCallback = null;
    
    // Mock successful API responses
    (apiClient.getFastEditMode as any).mockResolvedValue({
      success: true,
      data: { fastEditMode: false },
    });
    
    (apiClient.toggleFastEditMode as any).mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize and fetch initial state', async () => {
    const { result } = renderHook(() => useFastEditMode('test-session'));
    
    // Initial state before the API call resolves should be false
    expect(result.current.fastEditMode).toBe(false);
    
    // Verify API is called
    expect(apiClient.getFastEditMode).toHaveBeenCalledWith('test-session');
    
    // Wait for API promise to resolve
    await act(async () => {
      // Manually resolve all promises
      await Promise.resolve();
    });
    
    // State should still be false as per the mock response
    expect(result.current.fastEditMode).toBe(false);
  });

  it('should set state to true when API returns true', async () => {
    // Mock a true response
    (apiClient.getFastEditMode as any).mockResolvedValue({
      success: true,
      data: { fastEditMode: true },
    });
    
    const { result } = renderHook(() => useFastEditMode('test-session'));
    
    // Wait for API promise to resolve
    await act(async () => {
      // Manually resolve all promises
      await Promise.resolve();
    });
    
    // State should be updated from the API response
    expect(apiClient.getFastEditMode).toHaveBeenCalledWith('test-session');
    expect(result.current.fastEditMode).toBe(true);
  });

  it('should toggle fast edit mode', async () => {
    const { result } = renderHook(() => useFastEditMode('test-session'));
    
    // Toggle fast edit mode
    await act(async () => {
      await result.current.toggleFastEditMode();
    });
    
    // Verify API call
    expect(apiClient.toggleFastEditMode).toHaveBeenCalledWith('test-session', true);
  });

  it('should update state when receiving WebSocket events', async () => {
    const { result } = renderHook(() => useFastEditMode('test-session'));
    
    // Initial state
    expect(result.current.fastEditMode).toBe(false);
    
    // Simulate receiving a WebSocket event
    act(() => {
      (globalThis as any).fastEditModeEnabledCallback();
    });
    
    // State should be updated
    expect(result.current.fastEditMode).toBe(true);
    
    // Simulate receiving another WebSocket event
    act(() => {
      (globalThis as any).fastEditModeDisabledCallback();
    });
    
    // State should be updated again
    expect(result.current.fastEditMode).toBe(false);
  });

  it('should not make API calls when no sessionId is provided', () => {
    renderHook(() => useFastEditMode());
    
    // No API calls should be made
    expect(apiClient.getFastEditMode).not.toHaveBeenCalled();
  });

  it('should return enableFastEditMode and disableFastEditMode helpers', async () => {
    const { result } = renderHook(() => useFastEditMode('test-session'));
    
    // Call helper methods
    await act(async () => {
      await result.current.enableFastEditMode();
    });
    
    // Verify API call with explicit true value
    expect(apiClient.toggleFastEditMode).toHaveBeenCalledWith('test-session', true);
    
    // Reset mock
    vi.clearAllMocks();
    
    // Call disable helper
    await act(async () => {
      await result.current.disableFastEditMode();
    });
    
    // Verify API call with explicit false value
    expect(apiClient.toggleFastEditMode).toHaveBeenCalledWith('test-session', false);
  });
});