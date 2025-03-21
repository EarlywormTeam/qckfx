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

  it('contains an icon to represent the theme toggle', () => {
    const { container } = render(<ThemeToggle />);
    // We now show either sun or moon based on current theme, not both
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });
});