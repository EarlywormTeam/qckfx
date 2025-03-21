import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to qckfx/i)).toBeInTheDocument();
  });

  it('displays the placeholder message', () => {
    render(<App />);
    expect(screen.getByText(/placeholder UI/i)).toBeInTheDocument();
  });

  it('displays the API services message', () => {
    render(<App />);
    expect(screen.getByText(/API services have been set up/i)).toBeInTheDocument();
  });
});