import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalSettings } from '../TerminalSettings';
import { TerminalProvider } from '@/context/TerminalContext';

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <TerminalProvider>
      {ui}
    </TerminalProvider>
  );
};

describe('TerminalSettings Component', () => {
  it('is not visible when isOpen is false', () => {
    renderWithContext(<TerminalSettings isOpen={false} onClose={() => {}} />);
    
    expect(screen.queryByText('Terminal Display Settings')).not.toBeInTheDocument();
  });
  
  it('is visible when isOpen is true', () => {
    renderWithContext(<TerminalSettings isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Terminal Display Settings')).toBeInTheDocument();
  });
  
  it('displays all settings options', () => {
    renderWithContext(<TerminalSettings isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Font Family')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByText(/Terminal Theme/)).toBeInTheDocument();
    
    // Check for selections
    expect(screen.getByTestId('font-family-select')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-select')).toBeInTheDocument();
    expect(screen.getByTestId('color-scheme-select')).toBeInTheDocument();
  });
  
  it('calls onClose when close button is clicked', () => {
    const mockClose = vi.fn();
    
    renderWithContext(<TerminalSettings isOpen={true} onClose={mockClose} />);
    
    const closeButton = screen.getByTestId('close-settings');
    fireEvent.click(closeButton);
    
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  
  it('applies settings changes and calls close handler', () => {
    const mockClose = vi.fn();
    renderWithContext(<TerminalSettings isOpen={true} onClose={mockClose} />);
    
    // Change font family
    const fontFamilySelect = screen.getByTestId('font-family-select');
    fireEvent.change(fontFamilySelect, { target: { value: '"Courier New", monospace' } });
    
    // Change font size
    const fontSizeSelect = screen.getByTestId('font-size-select');
    fireEvent.change(fontSizeSelect, { target: { value: 'lg' } });
    
    // Change color scheme
    const colorSchemeSelect = screen.getByTestId('color-scheme-select');
    fireEvent.change(colorSchemeSelect, { target: { value: 'light' } });
    
    // Click apply button
    const applyButton = screen.getByText('Apply Settings');
    fireEvent.click(applyButton);
    
    // Verify close handler was called
    expect(mockClose).toHaveBeenCalled();
  });
  
  it('sets proper dialog accessibility attributes', () => {
    renderWithContext(
      <TerminalSettings 
        isOpen={true} 
        onClose={() => {}}
        ariaLabelledBy="settings-title"
      />
    );
    
    const dialog = screen.getByTestId('terminal-settings').parentElement;
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});