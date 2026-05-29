import type { ReactNode } from 'react';
import { StoreContext } from './useStore';
import { stores } from './store-instances';

export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <StoreContext.Provider value={stores}>
      {children}
    </StoreContext.Provider>
  );
}
