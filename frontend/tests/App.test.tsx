import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { App } from '../src/App.js';
import { useAppStore } from '../src/stores/app-store.js';
import { getStatus, authenticate } from '../src/services/api-client.js';

vi.mock('../src/services/api-client.js', () => ({
  getStatus: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock('../src/pages/ConsolePage.js', () => ({
  ConsolePage: () => <div data-testid="console-page">Console</div>,
}));

vi.mock('../src/pages/AuthPage.js', () => ({
  AuthPage: () => <div data-testid="auth-page">Auth</div>,
}));

const mockedGetStatus = vi.mocked(getStatus);
const mockedAuthenticate = vi.mocked(authenticate);

// sessionStorage key for cached token
const TOKEN_STORAGE_KEY = 'claude_remote_token';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useAppStore.setState({
      isAuthenticated: false,
      isCheckingAuth: true,
      connectionStatus: 'disconnected',
      instanceConnectionStatus: {},
      sessionStatus: 'idle',
      cachedToken: null,
      toastMessage: null,
    });
    // Clear sessionStorage
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('should show loading state while checking session', async () => {
    // Make getStatus hang
    mockedGetStatus.mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(screen.getByText('Checking session…')).toBeDefined();
  });

  it('should restore authentication when session cookie is valid', async () => {
    mockedGetStatus.mockResolvedValue({ status: 'running' });

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(true);
    });

    expect(screen.getByTestId('console-page')).toBeDefined();
  });

  it('should show auth page when session cookie is invalid', async () => {
    mockedGetStatus.mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(false);
      expect(useAppStore.getState().isCheckingAuth).toBe(false);
    });

    expect(screen.getByTestId('auth-page')).toBeDefined();
  });

  it('should show auth page after session check fails with 401', async () => {
    mockedGetStatus.mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-page')).toBeDefined();
    });
  });

  it('should restore cachedToken from sessionStorage when session is valid', async () => {
    // Simulate token stored from previous session
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token-123');
    mockedGetStatus.mockResolvedValue({ status: 'running' });

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(true);
      expect(useAppStore.getState().cachedToken).toBe('stored-token-123');
    });

    expect(screen.getByTestId('console-page')).toBeDefined();
  });

  it('should clear cachedToken and sessionStorage when status check returns 401', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'old-token');
    mockedGetStatus.mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(false);
      expect(useAppStore.getState().cachedToken).toBeNull();
    });

    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('auth-page')).toBeDefined();
  });

  it('should not restore cachedToken when sessionStorage is empty', async () => {
    mockedGetStatus.mockResolvedValue({ status: 'running' });

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(true);
      expect(useAppStore.getState().cachedToken).toBeNull();
    });
  });

  it('should auto-reconnect with cachedToken when session is invalid but token is still valid', async () => {
    // Simulate: backend restarted, session cookie invalid but token still works
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'valid-token-abc');
    mockedGetStatus.mockRejectedValueOnce(new Error('Unauthorized'));
    mockedAuthenticate.mockResolvedValueOnce(true);

    render(<App />);

    // Should attempt re-authentication with cached token
    await waitFor(() => {
      expect(mockedAuthenticate).toHaveBeenCalledWith('valid-token-abc');
    });

    // Should be authenticated after successful re-auth
    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(true);
      expect(useAppStore.getState().cachedToken).toBe('valid-token-abc');
    });

    expect(screen.getByTestId('console-page')).toBeDefined();
    // Token should remain in sessionStorage
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('valid-token-abc');
  });

  it('should show auth page when session is invalid and re-authentication with cachedToken fails', async () => {
    // Simulate: backend restarted, session cookie invalid, token also invalid (changed)
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token-xyz');
    mockedGetStatus.mockRejectedValueOnce(new Error('Unauthorized'));
    mockedAuthenticate.mockResolvedValueOnce(false);

    render(<App />);

    // Should attempt re-authentication with cached token
    await waitFor(() => {
      expect(mockedAuthenticate).toHaveBeenCalledWith('expired-token-xyz');
    });

    // Should show auth page when re-authentication fails
    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(false);
      expect(useAppStore.getState().cachedToken).toBeNull();
    });

    expect(screen.getByTestId('auth-page')).toBeDefined();
    // Token should be cleared from sessionStorage
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('should show auth page when session is invalid and no cachedToken exists', async () => {
    // No token in sessionStorage
    mockedGetStatus.mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().isAuthenticated).toBe(false);
      expect(useAppStore.getState().isCheckingAuth).toBe(false);
    });

    // Should not attempt authentication without cached token
    expect(mockedAuthenticate).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-page')).toBeDefined();
  });
});