import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { TransferContext, TransferStatus } from './transfer/types';

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: { msgId?: string; originTxHash?: string },
  ) => void;
  balances: {
    senderBalance: string;
    senderNftIds: string[] | null; // null means unknown
    isSenderNftOwner: boolean | null;
  };
  setSenderBalance: (b: string) => void;
  setSenderNftIds: (ids: string[] | null) => void;
  setIsSenderNftOwner: (isOwner: boolean | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      transfers: [],
      addTransfer: (t) => {
        set((state) => ({ transfers: [...state.transfers, t] }));
      },
      updateTransferStatus: (i, s, options) => {
        set((state) => {
          if (i >= state.transfers.length) return state;
          const txs = [...state.transfers];
          txs[i].status = s;
          txs[i].msgId ||= options?.msgId;
          txs[i].originTxHash ||= options?.originTxHash;
          return {
            transfers: txs,
          };
        });
      },
      balances: {
        senderBalance: '0',
        senderNftIds: null,
        isSenderNftOwner: false,
      },
      setSenderBalance: (senderBalance) => {
        set((state) => ({ balances: { ...state.balances, senderBalance } }));
      },
      setSenderNftIds: (senderNftIds) => {
        set((state) => ({ balances: { ...state.balances, senderNftIds } }));
      },
      setIsSenderNftOwner: (isSenderNftOwner) => {
        set((state) => ({ balances: { ...state.balances, isSenderNftOwner } }));
      },
    }),
    {
      name: 'app-state',
      partialize: (state) => ({ transfers: state.transfers }),
    },
  ),
);
