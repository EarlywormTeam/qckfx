/**
 * Utility functions for accessibility
 */

/**
 * Generate a unique ID for ARIA attributes
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format key combination for screen readers
 */
export function formatKeyCombo(combo: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): string {
  const keys = [];
  
  if (combo.ctrlKey) keys.push('Control');
  if (combo.altKey) keys.push('Alt');
  if (combo.shiftKey) keys.push('Shift');
  if (combo.metaKey) keys.push('Meta');
  
  keys.push(combo.key.toUpperCase());
  
  return keys.join(' + ');
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, assertive = false): void {
  if (typeof document === 'undefined') return;
  
  const announcerEl = document.createElement('div');
  announcerEl.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  announcerEl.setAttribute('aria-atomic', 'true');
  announcerEl.classList.add('sr-only');
  
  document.body.appendChild(announcerEl);
  
  // Use setTimeout to ensure screen readers have time to register the element
  setTimeout(() => {
    announcerEl.textContent = message;
    
    // Clean up after announcement
    setTimeout(() => {
      document.body.removeChild(announcerEl);
    }, 1000);
  }, 100);
}