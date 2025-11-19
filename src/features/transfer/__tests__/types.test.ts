import { describe, expect, it } from 'vitest';
import { FinalTransferStatuses, SentTransferStatuses, TransferStatus } from '../types';

describe('Transfer Types', () => {
  describe('TransferStatus enum', () => {
    it('should have all expected status values', () => {
      expect(TransferStatus.Preparing).toBe('preparing');
      expect(TransferStatus.CreatingTxs).toBe('creating-txs');
      expect(TransferStatus.SigningApprove).toBe('signing-approve');
      expect(TransferStatus.SigningRevoke).toBe('signing-revoke');
      expect(TransferStatus.ConfirmingRevoke).toBe('confirming-revoke');
      expect(TransferStatus.ConfirmingApprove).toBe('confirming-approve');
      expect(TransferStatus.SigningTransfer).toBe('signing-transfer');
      expect(TransferStatus.ConfirmingTransfer).toBe('confirming-transfer');
      expect(TransferStatus.ConfirmedTransfer).toBe('confirmed-transfer');
      expect(TransferStatus.Delivered).toBe('delivered');
      expect(TransferStatus.Failed).toBe('failed');
    });

    it('should have correct number of status values', () => {
      const statusValues = Object.values(TransferStatus);
      expect(statusValues).toHaveLength(11);
    });
  });

  describe('SentTransferStatuses', () => {
    it('should contain confirmed and delivered statuses', () => {
      expect(SentTransferStatuses).toContain(TransferStatus.ConfirmedTransfer);
      expect(SentTransferStatuses).toContain(TransferStatus.Delivered);
    });

    it('should not contain other statuses', () => {
      expect(SentTransferStatuses).not.toContain(TransferStatus.Preparing);
      expect(SentTransferStatuses).not.toContain(TransferStatus.Failed);
      expect(SentTransferStatuses).not.toContain(TransferStatus.SigningTransfer);
    });

    it('should have correct length', () => {
      expect(SentTransferStatuses).toHaveLength(2);
    });
  });

  describe('FinalTransferStatuses', () => {
    it('should contain all sent transfer statuses', () => {
      expect(FinalTransferStatuses).toContain(TransferStatus.ConfirmedTransfer);
      expect(FinalTransferStatuses).toContain(TransferStatus.Delivered);
    });

    it('should contain failed status', () => {
      expect(FinalTransferStatuses).toContain(TransferStatus.Failed);
    });

    it('should not contain pending statuses', () => {
      expect(FinalTransferStatuses).not.toContain(TransferStatus.Preparing);
      expect(FinalTransferStatuses).not.toContain(TransferStatus.SigningTransfer);
      expect(FinalTransferStatuses).not.toContain(TransferStatus.ConfirmingTransfer);
    });

    it('should have correct length', () => {
      expect(FinalTransferStatuses).toHaveLength(3);
    });

    it('should be a superset of SentTransferStatuses', () => {
      SentTransferStatuses.forEach((status) => {
        expect(FinalTransferStatuses).toContain(status);
      });
    });
  });

  describe('TransferStatus categorization', () => {
    it('should correctly identify sent statuses', () => {
      SentTransferStatuses.forEach((status) => {
        expect(SentTransferStatuses.includes(status)).toBe(true);
      });
    });

    it('should correctly identify final statuses', () => {
      FinalTransferStatuses.forEach((status) => {
        expect(FinalTransferStatuses.includes(status)).toBe(true);
      });
    });

    it('should have no overlap between sent and failed statuses', () => {
      const failedStatus = TransferStatus.Failed;
      expect(SentTransferStatuses).not.toContain(failedStatus);
      expect(FinalTransferStatuses).toContain(failedStatus);
    });
  });
});
