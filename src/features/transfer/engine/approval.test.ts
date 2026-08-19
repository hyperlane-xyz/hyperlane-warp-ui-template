import { describe, expect, test } from 'vitest';

import {
  ApprovalPhase,
  getApprovalTransactionCount,
  isApprovalReadyForValidation,
} from './approval';

describe('getApprovalTransactionCount', () => {
  test('reserves revoke and approval transactions when required', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.NeedsRevoke })).toBe(2);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.NeedsApprove })).toBe(1);
  });

  test('does not guess an approval count before the allowance check resolves', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Checking })).toBe(0);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Failed })).toBe(0);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Ready })).toBe(0);
  });
});

describe('isApprovalReadyForValidation', () => {
  test('waits for approval routes to resolve successfully', () => {
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Checking }, true)).toBe(false);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Failed }, true)).toBe(false);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.NeedsRevoke }, true)).toBe(true);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.NeedsApprove }, true)).toBe(true);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Ready }, true)).toBe(true);
  });

  test('does not gate routes without approval metadata', () => {
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Idle }, false)).toBe(true);
  });
});
