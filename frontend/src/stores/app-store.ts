import { create } from 'zustand';
import type { SessionStatus } from '@claude-remote/shared';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  setAuthenticated: (value: boolean) => void;
  setCheckingAuth: (value: boolean) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  instanceConnectionStatus: Record<string, ConnectionStatus>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setInstanceConnectionStatus: (instanceId: string, status: ConnectionStatus) => void;
  removeInstanceConnectionStatus: (instanceId: string) => void;

  // Session
  sessionStatus: SessionStatus;
  setSessionStatus: (status: SessionStatus) => void;

  // Cached token for cross-instance auth
  cachedToken: string | null;
  setCachedToken: (token: string | null) => void;

  // Toast
  toastMessage: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  isCheckingAuth: true, // Start with checking state
  setAuthenticated: (value) => set({ isAuthenticated: value, isCheckingAuth: false }),
  setCheckingAuth: (value) => set({ isCheckingAuth: value }),

  connectionStatus: 'disconnected',
  instanceConnectionStatus: {},
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setInstanceConnectionStatus: (instanceId, status) => set((state) => ({
    instanceConnectionStatus: {
      ...state.instanceConnectionStatus,
      [instanceId]: status,
    },
  })),
  removeInstanceConnectionStatus: (instanceId) => set((state) => {
    const { [instanceId]: _, ...rest } = state.instanceConnectionStatus;
    return { instanceConnectionStatus: rest };
  }),

  sessionStatus: 'idle',
  setSessionStatus: (status) => set({ sessionStatus: status }),

  cachedToken: null,
  setCachedToken: (token) => set({ cachedToken: token }),

  toastMessage: null,
  showToast: (message) => set({ toastMessage: message }),
  hideToast: () => set({ toastMessage: null }),
}));
