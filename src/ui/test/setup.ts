import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Reset all tests after each one
afterEach(() => {
  cleanup();
});

// Mock matchMedia for the tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  
  constructor() {}
  
  disconnect() {
    return null;
  }
  
  observe() {
    return null;
  }
  
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  
  unobserve() {
    return null;
  }
}

window.IntersectionObserver = MockIntersectionObserver as any;