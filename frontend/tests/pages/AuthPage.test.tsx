import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthPage } from '../../src/pages/AuthPage.js';

const mockLogin = vi.fn();

vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => ({
    login: mockLogin,
    error: null,
    loading: false,
  }),
}));

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should render token input and connect button', () => {
    render(<AuthPage />);

    expect(screen.getByLabelText('Authentication token')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
  });

  it('should use input element (not textarea) for token field', () => {
    render(<AuthPage />);

    const tokenInput = screen.getByLabelText('Authentication token');
    expect(tokenInput.tagName).toBe('INPUT');
    expect(tokenInput.getAttribute('type')).toBe('text');
  });

  it('should trigger login on Enter key press', async () => {
    render(<AuthPage />);

    const tokenInput = screen.getByLabelText('Authentication token');
    fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    fireEvent.keyDown(tokenInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-token');
    });
  });

  it('should not allow empty token submission', () => {
    render(<AuthPage />);

    const connectButton = screen.getByRole('button', { name: 'Connect' });
    expect(connectButton.hasAttribute('disabled')).toBe(true);
  });

  it('should prefill token from sessionStorage if available', () => {
    sessionStorage.setItem('prefill_token', 'prefilled-token');

    render(<AuthPage />);

    const tokenInput = screen.getByLabelText('Authentication token') as HTMLInputElement;
    expect(tokenInput.value).toBe('prefilled-token');
    expect(sessionStorage.getItem('prefill_token')).toBeNull();
  });
});
