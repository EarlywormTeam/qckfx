import React from 'react';
import { render, screen } from '@testing-library/react';
import { Announcer } from '../Announcer';
import { vi } from 'vitest';

describe('Announcer Component', () => {
  it('renders nothing when messages array is empty', () => {
    const { container } = render(<Announcer messages={[]} />);
    expect(container.firstChild).toBeNull();
  });
  
  it('renders the latest message for screen readers', () => {
    const messages = [
      { id: '1', content: 'First message' },
      { id: '2', content: 'Second message' },
      { id: '3', content: 'Latest message' },
    ];
    
    const { container } = render(<Announcer messages={messages} />);
    
    // Screen reader text should be in the DOM but visually hidden
    const announcement = screen.getByText('Latest message');
    expect(announcement).toBeInTheDocument();
    
    // Check for sr-only class directly on the container element
    const announcerDiv = container.firstChild as HTMLElement;
    expect(announcerDiv).toHaveClass('sr-only');
  });
  
  it('sets aria-live to polite by default', () => {
    const messages = [
      { id: '1', content: 'Test message' },
    ];
    
    const { container } = render(<Announcer messages={messages} />);
    
    // Check through direct DOM querying since ARIA attributes might be set differently in tests
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });
  
  it('sets aria-live to assertive when assertive prop is true', () => {
    const messages = [
      { id: '1', content: 'Error message' },
    ];
    
    const { container } = render(<Announcer messages={messages} assertive={true} />);
    
    // Check through direct DOM querying
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-live')).toBe('assertive');
  });
  
  it('sets aria-atomic to true', () => {
    const messages = [
      { id: '1', content: 'Test message' },
    ];
    
    const { container } = render(<Announcer messages={messages} />);
    
    // Check through direct DOM querying
    const atomicRegion = container.querySelector('[aria-atomic]');
    expect(atomicRegion).not.toBeNull();
    expect(atomicRegion?.getAttribute('aria-atomic')).toBe('true');
  });
});