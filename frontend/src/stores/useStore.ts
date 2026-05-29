import { createContext, useContext } from 'react';
import type { stores } from './store-instances';

export const StoreContext = createContext<typeof stores | null>(null);

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}