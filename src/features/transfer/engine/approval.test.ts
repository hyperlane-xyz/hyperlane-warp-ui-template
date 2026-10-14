import { describe, expect, test } from 'vitest';

import {
  ApprovalPhase,
  getApprovalPlanTransactionCount,
  getApprovalTransactionCount,
  isApprovalReadyForValidation,
} from './approval';

describe('getApprovalTransactionCount', () => {
  test('reserves revoke and approval transactions when required', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.NeedsRevoke })).toBe(2);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.NeedsApprove })).toBe(1);
  });

  test('waits while checking and reserves the worst case after a failed check', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Checking })).toBe(0);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Failed })).toBe(2);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Ready })).toBe(0);
  });
});

describe('getApprovalPlanTransactionCount', () => {
  test('returns the exact transaction count for a fresh execution plan', () => {
    expect(getApprovalPlanTransactionCount(null)).toBe(0);
    expect(getApprovalPlanTransactionCount({ needsApprove: false, needsRevoke: true })).toBe(0);
    expect(getApprovalPlanTransactionCount({ needsApprove: true, needsRevoke: false })).toBe(1);
    expect(getApprovalPlanTransactionCount({ needsApprove: true, needsRevoke: true })).toBe(2);
  });
});

describe('isApprovalReadyForValidation', () => {
  test('waits only while the allowance check is pending', () => {
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Checking }, true)).toBe(false);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Failed }, true)).toBe(true);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.NeedsRevoke }, true)).toBe(true);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.NeedsApprove }, true)).toBe(true);
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Ready }, true)).toBe(true);
  });

  test('does not gate routes without approval metadata', () => {
    expect(isApprovalReadyForValidation({ phase: ApprovalPhase.Idle }, false)).toBe(true);
  });
});
