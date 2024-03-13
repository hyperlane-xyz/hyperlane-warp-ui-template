import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 2;

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  resetTransfers: () => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: { msgId?: string; originTxHash?: string },
  ) => void;
  failUnconfirmedTransfers: () => void;
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      transfers: [],
      addTransfer: (t) => {
        set((state) => ({ transfers: [...state.transfers, t] }));
      },
      resetTransfers: () => {
        set(() => ({ transfers: [] }));
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
      failUnconfirmedTransfers: () => {
        set((state) => ({
          transfers: state.transfers.map((t) =>
            FinalTransferStatuses.includes(t.status) ? t : { ...t, status: TransferStatus.Failed },
          ),
        }));
      },
      transferLoading: false,
      setTransferLoading: (isLoading) => {
        set(() => ({ transferLoading: isLoading }));
      },
    }),
    {
      name: 'app-state',
      partialize: (state) => ({ transfers: state.transfers }),
      version: PERSIST_STATE_VERSION,
      onRehydrateStorage: () => (state) => {
        state?.failUnconfirmedTransfers();
      },
    },
  ),
);
