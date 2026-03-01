import { create } from 'zustand';
import type { InstanceListItem } from '@claude-remote/shared';

interface InstanceState {
  instances: InstanceListItem[];
  activeInstanceId: string | null;
  currentHostOverride: string | null;
  setInstances: (instances: InstanceListItem[]) => void;
  setActiveInstanceId: (id: string | null) => void;
  setCurrentHostOverride: (host: string | null) => void;
}

export const useInstanceStore = create<InstanceState>((set) => ({
  instances: [],
  activeInstanceId: null,
  currentHostOverride: null,
  setInstances: (instances) => set({ instances }),
  setActiveInstanceId: (id) => set({ activeInstanceId: id }),
  setCurrentHostOverride: (host) => set({ currentHostOverride: host }),
}));
