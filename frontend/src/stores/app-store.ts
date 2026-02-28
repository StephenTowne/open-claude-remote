import { create } from 'zustand';
import type { SessionStatus } from '@claude-remote/shared';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Session
  sessionStatus: SessionStatus;
  setSessionStatus: (status: SessionStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),

  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  sessionStatus: 'idle',
  setSessionStatus: (status) => set({ sessionStatus: status }),
}));
