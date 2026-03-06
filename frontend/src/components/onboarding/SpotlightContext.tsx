import { createContext, useContext, ReactNode } from 'react';
import { useSpotlight } from './useSpotlight';
import type { UseSpotlightReturn } from './useSpotlight';

const SpotlightContext = createContext<UseSpotlightReturn | null>(null);

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const spotlightState = useSpotlight();

  return (
    <SpotlightContext.Provider value={spotlightState}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlightContext(): UseSpotlightReturn {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error('useSpotlightContext must be used within a SpotlightProvider');
  }
  return context;
}
