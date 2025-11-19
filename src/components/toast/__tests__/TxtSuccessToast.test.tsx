import { render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toastTxSuccess, TxSuccessToast } from '../TxSuccessToast';

// Mock dependencies
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('../../../features/chains/hooks', () => ({
  useMultiProvider: vi.fn(),
}));

import { useMultiProvider } from '../../../features/chains/hooks';

describe('TxSuccessToast', () => {
  const mockMultiProvider = {
    tryGetExplorerTxUrl: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMultiProvider).mockReturnValue(mockMultiProvider as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TxSuccessToast Component', () => {
    it('should render message with explorer link when URL is available', () => {
      const mockUrl = 'https://etherscan.io/tx/0x123';
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue(mockUrl);

      render(<TxSuccessToast msg="Transaction successful" txHash="0x123" chain="ethereum" />);

      expect(screen.getByText(/Transaction successful/)).toBeInTheDocument();

      const link = screen.getByRole('link', { name: 'Open in Explorer' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', mockUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveClass('underline');
    });

    it('should render message without link when URL is not available', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue(null);

      render(<TxSuccessToast msg="Transaction successful" txHash="0x123" chain="ethereum" />);

      expect(screen.getByText(/Transaction successful/)).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should render message without link when URL is undefined', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue(undefined);

      render(<TxSuccessToast msg="Transaction completed" txHash="0xabc" chain="polygon" />);

      expect(screen.getByText(/Transaction completed/)).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should call tryGetExplorerTxUrl with correct parameters', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue('https://explorer.com/tx/0x456');

      render(<TxSuccessToast msg="Transfer complete" txHash="0x456" chain="arbitrum" />);

      expect(mockMultiProvider.tryGetExplorerTxUrl).toHaveBeenCalledWith('arbitrum', {
        hash: '0x456',
      });
      expect(mockMultiProvider.tryGetExplorerTxUrl).toHaveBeenCalledTimes(1);
    });

    it('should render different messages correctly', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue('https://explorer.com');

      const { rerender } = render(
        <TxSuccessToast msg="First message" txHash="0x111" chain="ethereum" />,
      );

      expect(screen.getByText(/First message/)).toBeInTheDocument();

      rerender(<TxSuccessToast msg="Second message" txHash="0x222" chain="polygon" />);

      expect(screen.getByText(/Second message/)).toBeInTheDocument();
      expect(screen.queryByText(/First message/)).not.toBeInTheDocument();
    });

    it('should handle different chain names', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue('https://bscscan.com/tx/0x789');

      render(<TxSuccessToast msg="BSC transaction" txHash="0x789" chain="bsc" />);

      expect(mockMultiProvider.tryGetExplorerTxUrl).toHaveBeenCalledWith('bsc', { hash: '0x789' });
    });

    it('should handle special characters in message', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue('https://explorer.com');

      render(
        <TxSuccessToast
          msg="Transaction with special chars: <>&"
          txHash="0xspecial"
          chain="ethereum"
        />,
      );

      expect(screen.getByText(/Transaction with special chars: <>&/)).toBeInTheDocument();
    });
  });

  describe('toastTxSuccess Function', () => {
    it('should call toast.success with correct parameters', () => {
      const msg = 'Transaction successful';
      const txHash = '0x123abc';
      const chain = 'ethereum';

      toastTxSuccess(msg, txHash, chain);

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(expect.anything(), { autoClose: 12000 });
    });

    it('should pass TxSuccessToast component to toast.success', () => {
      const msg = 'Transfer completed';
      const txHash = '0xdef456';
      const chain = 'polygon';

      toastTxSuccess(msg, txHash, chain);

      const toastCall = vi.mocked(toast.success).mock.calls[0];
      expect(toastCall[0]).toBeDefined();
      expect(toastCall[1]).toEqual({ autoClose: 12000 });
    });

    it('should handle multiple consecutive toast calls', () => {
      toastTxSuccess('First tx', '0x111', 'ethereum');
      toastTxSuccess('Second tx', '0x222', 'polygon');
      toastTxSuccess('Third tx', '0x333', 'arbitrum');

      expect(toast.success).toHaveBeenCalledTimes(3);
    });

    it('should use 12 second autoClose duration', () => {
      toastTxSuccess('Test message', '0xtest', 'ethereum');

      const callOptions = vi.mocked(toast.success).mock.calls[0][1];
      expect(callOptions).toHaveProperty('autoClose', 12000);
    });
  });

  describe('Integration Tests', () => {
    it('should render toast content correctly when called via toastTxSuccess', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue(
        'https://etherscan.io/tx/0xintegration',
      );

      toastTxSuccess('Integration test', '0xintegration', 'ethereum');

      const toastContent = vi.mocked(toast.success).mock.calls[0][0];

      // Render the toast content
      const { container } = render(toastContent as React.ReactElement);

      expect(container).toHaveTextContent('Integration test');
    });

    it('should handle empty message string', () => {
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue('https://explorer.com');

      render(<TxSuccessToast msg="" txHash="0xempty" chain="ethereum" />);

      const link = screen.getByRole('link', { name: 'Open in Explorer' });
      expect(link).toBeInTheDocument();
    });

    it('should handle very long transaction hashes', () => {
      const longTxHash = '0x' + 'a'.repeat(64);
      mockMultiProvider.tryGetExplorerTxUrl.mockReturnValue(
        `https://explorer.com/tx/${longTxHash}`,
      );

      render(<TxSuccessToast msg="Long hash test" txHash={longTxHash} chain="ethereum" />);

      expect(mockMultiProvider.tryGetExplorerTxUrl).toHaveBeenCalledWith('ethereum', {
        hash: longTxHash,
      });
    });
  });
});
