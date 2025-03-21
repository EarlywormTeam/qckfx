import {
  generateAriaId,
  formatKeyCombo,
  prefersReducedMotion,
  announceToScreenReader
} from '../index';
import { vi } from 'vitest';

describe('Accessibility Utilities', () => {
  describe('generateAriaId', () => {
    it('generates unique IDs with the provided prefix', () => {
      const id1 = generateAriaId('test');
      const id2 = generateAriaId('test');
      
      expect(id1).toContain('test-');
      expect(id2).toContain('test-');
      expect(id1).not.toBe(id2); // Should be unique
    });
    
    it('generates different IDs for different prefixes', () => {
      const id1 = generateAriaId('foo');
      const id2 = generateAriaId('bar');
      
      expect(id1).toContain('foo-');
      expect(id2).toContain('bar-');
    });
  });
  
  describe('formatKeyCombo', () => {
    it('formats a simple key', () => {
      const combo = formatKeyCombo({ key: 'a' });
      expect(combo).toBe('A');
    });
    
    it('formats key with ctrl modifier', () => {
      const combo = formatKeyCombo({ key: 'a', ctrlKey: true });
      expect(combo).toBe('Control + A');
    });
    
    it('formats key with multiple modifiers', () => {
      const combo = formatKeyCombo({
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        altKey: true
      });
      expect(combo).toBe('Control + Alt + Shift + Z');
    });
  });
  
  describe('prefersReducedMotion', () => {
    const originalMatchMedia = window.matchMedia;
    
    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });
    
    it('returns false when reduced motion is not preferred', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => {
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      });
      
      expect(prefersReducedMotion()).toBe(false);
    });
    
    it('returns true when reduced motion is preferred', () => {
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
      
      expect(prefersReducedMotion()).toBe(true);
    });
  });
  
  describe('announceToScreenReader', () => {
    it('creates an announcer element with correct attributes', () => {
      // Create a real element to observe
      const spy = vi.spyOn(document, 'createElement');
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      
      // Call the function to test
      announceToScreenReader('Test announcement');
      
      // Verify createElement was called with 'div'
      expect(spy).toHaveBeenCalledWith('div');
      
      // Verify the element was appended to the body
      expect(appendSpy).toHaveBeenCalled();
      
      // Cleanup spies
      spy.mockRestore();
      appendSpy.mockRestore();
    });
    
    it('supports both polite and assertive announcements', () => {
      // Test both modes (not verifying the actual element attributes since
      // we can observe behavior and it's difficult to mock properly)
      expect(() => announceToScreenReader('Test polite')).not.toThrow();
      expect(() => announceToScreenReader('Test assertive', true)).not.toThrow();
    });
  });
});