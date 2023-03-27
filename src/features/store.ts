import { create } from 'zustand';

import type { TransactionContext } from './transactions/types';

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
interface AppState {
  transactions: TransactionContext[];
  addTransaction: (t: TransactionContext) => void;
  updateTransaction: (i: number, t: TransactionContext) => void;
}

export const useStore = create<AppState>()((set) => ({
  transactions: [],
  addTransaction: (t: TransactionContext) => {
    set((state) => ({ transactions: [...state.transactions, t] }));
  },
  updateTransaction: (i, t: TransactionContext) => {
    set((state) => {
      const txs = [...state.transactions];
      txs[i] = t;
      return {
        transactions: txs,
      };
    });
  },
}));
