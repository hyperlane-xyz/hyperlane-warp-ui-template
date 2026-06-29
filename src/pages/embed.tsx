import { HyperlaneLogo } from '@hyperlane-xyz/widgets';
import type { NextPage } from 'next';
import Head from 'next/head';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import { APP_NAME } from '../consts/app';
import { TransactionHistoryItemType, useStore } from '../features/store';
import { SwapDetailsModal } from '../features/swap/SwapDetailsModal';
import { useEngineBootstrap } from '../features/swap/useEngineBootstrap';
import { TransfersDetailsModal } from '../features/transfer/TransfersDetailsModal';
import { TransferContext } from '../features/transfer/types';
import { UnifiedTokenCard } from '../features/unified/UnifiedTokenCard';
import { parseEmbedTheme, themeToCssVars } from '../styles/embedTheme';
import { logger } from '../utils/logger';

/**
 * Embeddable widget page — renders the unified transfer/swap form in a minimal, chrome-less
 * layout suitable for iframe embedding. Accepts theme overrides via URL params.
 *
 * Usage:
 *   <iframe src="https://your-warp-ui.com/embed?accent=3b82f6&bg=ffffff&mode=dark" />
 *
 * Supported URL params:
 *   - accent, bg, card, text, buttonText, border, error (hex without #)
 *   - mode: "dark" or "light"
 *   - origin, destination, originToken, destinationToken (address/denom token defaults)
 */

/** Auto-opens TransfersDetailsModal when a new transfer starts. */
function useAutoTransferModal() {
  const transactionHistory = useStore((s) => s.transactionHistory);
  const transfers = useMemo(
    () => transactionHistory.filter((item) => item.type === TransactionHistoryItemType.Bridge),
    [transactionHistory],
  );
  const [selectedTransfer, setSelectedTransfer] = useState<{
    id: string;
    data: TransferContext;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const prevTransfersLengthRef = useRef(transfers.length);

  useEffect(() => {
    const prev = prevTransfersLengthRef.current;
    prevTransfersLengthRef.current = transfers.length;
    if (transfers.length > prev) {
      const latestTransfer = transfers[transfers.length - 1];
      if (!latestTransfer) {
        logger.error(
          'Expected latest transfer to exist after transfers.length increased',
          transfers,
        );
        return;
      }
      setSelectedTransfer({ id: latestTransfer.id, data: latestTransfer.data });
      setIsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transfers.length increasing guarantees a new transfers ref; listing transfers would re-run on status updates
  }, [transfers.length]);

  const close = () => {
    setIsOpen(false);
    setSelectedTransfer(null);
  };

  return { selectedTransfer, isOpen, close };
}

const EmbedPage: NextPage = () => {
  useEngineBootstrap();
  const cssVars = useMemo(() => themeToCssVars(parseEmbedTheme()), []);
  const { selectedTransfer, isOpen: isModalOpen, close: closeModal } = useAutoTransferModal();

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{APP_NAME}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="embed-container" style={cssVars as CSSProperties}>
        <div className="flex min-h-screen items-center justify-center p-2">
          <div>
            <UnifiedTokenCard />
            <div className="mt-2 flex items-center justify-end gap-1 pr-1 opacity-50">
              <span className="text-xxs tracking-wide">Powered by</span>
              <HyperlaneLogo width={12} height={12} color="currentColor" className="-mt-[2px]" />
              <span className="text-xxs font-medium tracking-wide">Hyperlane</span>
            </div>
          </div>
        </div>
      </div>
      {selectedTransfer && (
        <TransfersDetailsModal
          isOpen={isModalOpen}
          onClose={closeModal}
          transfer={selectedTransfer.data}
          transactionId={selectedTransfer.id}
        />
      )}
      <SwapDetailsModal />
    </>
  );
};

export default EmbedPage;
