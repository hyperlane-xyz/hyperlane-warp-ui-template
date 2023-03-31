import { create } from 'zustand';

import type { TransferContext, TransferStatus } from './transfer/types';

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
interface AppState {
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: { msgId?: string; originTxHash?: string },
  ) => void;
}

export const useStore = create<AppState>()((set) => ({
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
}));
