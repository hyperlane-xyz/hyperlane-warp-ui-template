import type { NextPage } from 'next';
import { useEffect } from 'react';
import { TransferTokenCard } from '../features/transfer/TransferTokenCard';

const WIDGET_MESSAGE_TYPE = 'hyperlane-warp-widget';

const EmbedPage: NextPage = () => {
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: WIDGET_MESSAGE_TYPE,
          event: {
            type: 'ready',
            payload: { timestamp: Date.now() },
          },
        },
        '*',
      );
    }
  }, []);

  return (
    <main data-testid="warp-widget-root" className="flex min-h-screen items-center justify-center p-3">
      <span data-testid="warp-widget-ready" className="hidden" />
      <TransferTokenCard />
    </main>
  );
};

export default EmbedPage;
