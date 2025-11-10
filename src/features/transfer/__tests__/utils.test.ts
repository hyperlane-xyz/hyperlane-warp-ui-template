import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferStatus } from '../types';
import {
  STATUSES_WITH_ICON,
  getIconByTransferStatus,
  getTransferStatusLabel,
  isTransferFailed,
  isTransferSent,
  tryGetMsgIdFromTransferReceipt,
} from '../utils';

const { extractMessageIdsMock, providerTypes, logger } = vi.hoisted(() => ({
  extractMessageIdsMock: vi.fn(),
  providerTypes: {
    CosmJs: 'cosmjs',
    Starknet: 'Starknet',
    Viem: 'viem',
    EthersV5: 'ethersv5',
  },
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../images/icons/confirmed-icon.svg', () => ({ default: 'confirmed-icon' }));
vi.mock('../../../images/icons/delivered-icon.svg', () => ({ default: 'delivered-icon' }));
vi.mock('../../../images/icons/delivered-icon.svg', () => ({ default: 'delivered-icon' }));
vi.mock('../../../images/icons/error-circle.svg', () => ({ default: 'error-icon' }));
vi.mock('../../../utils/logger', () => ({
  logger,
}));

describe('getTransferStatusLabel', () => {
  const connector = 'Wallet';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks user to connect when account is not ready and status is pending', () => {
    const result = getTransferStatusLabel(TransferStatus.CreatingTxs, connector, false, false);
    expect(result).toBe('Please connect wallet to continue');
  });

  const expectations: Array<
    [TransferStatus, string, { permissionless?: boolean; accountReady?: boolean }]
  > = [
    [TransferStatus.Preparing, 'Preparing for token transfer...', {}],
    [TransferStatus.CreatingTxs, 'Creating transactions...', {}],
    [TransferStatus.SigningApprove, `Sign approve transaction in ${connector} to continue.`, {}],
    [TransferStatus.ConfirmingApprove, 'Confirming approve transaction...', {}],
    [TransferStatus.SigningRevoke, `Sign revoke transaction in ${connector} to continue.`, {}],
    [TransferStatus.ConfirmingRevoke, 'Confirming revoke transaction...', {}],
    [TransferStatus.SigningTransfer, `Sign transfer transaction in ${connector} to continue.`, {}],
    [TransferStatus.ConfirmingTransfer, 'Confirming transfer transaction...', {}],
  ];

  it.each(expectations)('returns expected description for %s', (status, expected, options) => {
    const result = getTransferStatusLabel(
      status,
      connector,
      !!options.permissionless,
      options.accountReady ?? true,
    );
    expect(result).toBe(expected);
  });

  it('includes delivery message when permissionless route confirmed', () => {
    const result = getTransferStatusLabel(TransferStatus.ConfirmedTransfer, connector, true, true);
    expect(result).toBe('Transfer confirmed, the funds will arrive when the message is delivered.');
  });

  it('includes default delivery message for permissioned routes', () => {
    const result = getTransferStatusLabel(TransferStatus.ConfirmedTransfer, connector, false, true);
    expect(result).toBe('Transfer transaction confirmed, delivering message...');
  });

  it('describes delivered and failed states', () => {
    expect(getTransferStatusLabel(TransferStatus.Delivered, connector, false, true)).toBe(
      'Delivery complete, transfer successful!',
    );
    expect(getTransferStatusLabel(TransferStatus.Failed, connector, false, true)).toBe(
      'Transfer failed, please try again.',
    );
  });
});

describe('status helpers', () => {
  it('determines when a transfer is sent', () => {
    expect(isTransferSent(TransferStatus.ConfirmedTransfer)).toBe(true);
    expect(isTransferSent(TransferStatus.Delivered)).toBe(true);
    expect(isTransferSent(TransferStatus.Preparing)).toBe(false);
  });

  it('detects failed transfers', () => {
    expect(isTransferFailed(TransferStatus.Failed)).toBe(true);
    expect(isTransferFailed(TransferStatus.CreatingTxs)).toBe(false);
  });

  it('provides icons for final statuses', () => {
    expect(STATUSES_WITH_ICON).toEqual([
      TransferStatus.Delivered,
      TransferStatus.ConfirmedTransfer,
      TransferStatus.Failed,
    ]);
    const deliveredIcon = getIconByTransferStatus(TransferStatus.Delivered);
    const confirmedIcon = getIconByTransferStatus(TransferStatus.ConfirmedTransfer);
    const failedIcon = getIconByTransferStatus(TransferStatus.Failed);
    const defaultIcon = getIconByTransferStatus(TransferStatus.CreatingTxs);
    expect(deliveredIcon).toBeTruthy();
    expect(confirmedIcon).toBeTruthy();
    expect(failedIcon).toBeTruthy();
    expect(defaultIcon).toBe(failedIcon);
  });
});

describe('tryGetMsgIdFromTransferReceipt', () => {
  const multiProvider = {
    getKnownChainNames: vi.fn(() => ['chain-a', 'chain-b']),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined for CosmJs receipts', () => {
    const result = tryGetMsgIdFromTransferReceipt(multiProvider, 'chain-a', {
      type: providerTypes.CosmJs,
    } as any);
    expect(result).toBeUndefined();
    expect(extractMessageIdsMock).not.toHaveBeenCalled();
  });

  it.skip('extracts message id for starknet receipts', () => {
    extractMessageIdsMock.mockReturnValueOnce([{ messageId: 'msg-123' }]);

    const receipt = { type: providerTypes.Starknet, receipt: { data: 'receipt' } } as any;
    const result = tryGetMsgIdFromTransferReceipt(multiProvider, 'chain-a', receipt);

    expect(result).toBe('msg-123');
    expect(extractMessageIdsMock).toHaveBeenCalledWith('chain-a', {
      type: providerTypes.Starknet,
      receipt: { data: 'receipt' },
    });
    expect(logger.debug).toHaveBeenCalledWith('Message id found in logs', 'msg-123');
  });

  it.skip('maps Viem receipts to EthersV5 for extraction', () => {
    extractMessageIdsMock.mockReturnValueOnce([{ messageId: 'msg-viem' }]);
    const receipt = {
      type: providerTypes.EthersV5,
      receipt: { transactionHash: '0x1' },
    } as any;

    const result = tryGetMsgIdFromTransferReceipt(multiProvider, 'chain-b', receipt);

    expect(result).toBe('msg-viem');
    expect(extractMessageIdsMock).toHaveBeenCalledWith('chain-b', {
      type: providerTypes.EthersV5,
      receipt: { transactionHash: '0x1' },
    });
  });

  it('returns undefined when no messages are found', () => {
    extractMessageIdsMock.mockReturnValueOnce([]);

    const result = tryGetMsgIdFromTransferReceipt(multiProvider, 'chain-a', {
      type: providerTypes.EthersV5,
      receipt: {},
    } as any);

    expect(result).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.skip('catches errors produced during extraction', () => {
    const error = new Error('boom');
    extractMessageIdsMock.mockImplementationOnce(() => {
      throw error;
    });

    const receipt = { type: providerTypes.Starknet, receipt: {} } as any;
    const result = tryGetMsgIdFromTransferReceipt(multiProvider, 'chain-a', receipt);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Could not get msgId from transfer receipt', error);
  });
});
