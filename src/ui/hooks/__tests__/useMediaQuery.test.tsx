import React from 'react';
import { renderHook } from '@testing-library/react';
import { useMediaQuery, useIsSmallScreen, useIsMediumScreen, useIsLargeScreen } from '../useMediaQuery';
import { vi } from 'vitest';

describe('useMediaQuery Hook', () => {
  const originalMatchMedia = window.matchMedia;
  
  beforeEach(() => {
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });
  
  afterEach(() => {
    // Restore original
    window.matchMedia = originalMatchMedia;
  });
  
  it('returns false by default', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    
    expect(result.current).toBe(false);
  });
  
  it('returns true when media query matches', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => {
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
    
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    
    expect(result.current).toBe(true);
  });
  
  it('uses correct queries for predefined hooks', () => {
    let query = '';
    window.matchMedia = vi.fn().mockImplementation((q) => {
      query = q;
      return {
        matches: true,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
    
    // Small screen
    renderHook(() => useIsSmallScreen());
    expect(query).toBe('(max-width: 639px)');
    
    // Medium screen
    renderHook(() => useIsMediumScreen());
    expect(query).toBe('(min-width: 640px) and (max-width: 1023px)');
    
    // Large screen
    renderHook(() => useIsLargeScreen());
    expect(query).toBe('(min-width: 1024px)');
  });
});