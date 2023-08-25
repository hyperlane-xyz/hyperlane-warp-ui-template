import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  FinalTransferStatuses,
  TransferContext,
  TransferStatus,
  TransferStatusParams,
} from './transfer/types';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 1;

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
  balances: {
    senderBalance: string;
    senderNftIds: string[] | null; // null means unknown
    isSenderNftOwner: boolean | null;
  };
  failUnconfirmedTransfers: () => void;
  setSenderBalance: (b: string) => void;
  setSenderNftIds: (ids: string[] | null) => void;
  setIsSenderNftOwner: (isOwner: boolean | null) => void;
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
  updateTransferStatusParams: (i: number, params: TransferStatusParams) => void;
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
      updateTransferStatusParams: (i, params) => {
        set((state) => {
          if (i >= state.transfers.length) return state;
          const txs = [...state.transfers];
          txs[i].statusParams ||= params;
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
      version: PERSIST_STATE_VERSION,
      onRehydrateStorage: () => (state) => {
        state?.failUnconfirmedTransfers();
      },
    },
  ),
);
