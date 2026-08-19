import { describe, expect, test } from 'vitest';

import { ApprovalPhase, getApprovalTransactionCount } from './approval';

describe('getApprovalTransactionCount', () => {
  test('reserves an approval while allowance status is unresolved', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Idle }, true)).toBe(1);
  });

  test('reserves revoke and approval transactions when required', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.NeedsRevoke }, true)).toBe(2);
  });

  test('does not reserve an approval for ready or native routes', () => {
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Ready }, true)).toBe(0);
    expect(getApprovalTransactionCount({ phase: ApprovalPhase.Idle }, false)).toBe(0);
  });
});
