import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders without crashing', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has the correct accessible label', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });

  it('contains both sun and moon icons', () => {
    const { container } = render(<ThemeToggle />);
    // Check for presence of both icons (we're checking DOM structure here)
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(2);
  });
});