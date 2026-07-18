import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

import { useMultiProvider } from '../../chains/hooks';

// Classic ERC20.approve(spender, amount) flow. The engine
// emits TRANSFER_FROM (with default usePermit2=false), and the UR's
// other commands (V3_SWAP_EXACT_IN, BRIDGE_TOKEN) fall back from
// ERC20.transferFrom to Permit2 via the contract's payOrPermit2Transfer
// helper — so a direct ERC20 allowance to the UR is sufficient.
export const ApprovalPhase = {
  Idle: 'idle',
  Native: 'native',
  // USDT case: existing allowance > 0 and needs to be bumped. USDT's
  // approve() reverts unless prior allowance is zero, so we revoke
  // first.
  NeedsRevoke: 'needs_revoke',
  NeedsApprove: 'needs_approve',
  Ready: 'ready',
} as const;
export type ApprovalPhase = (typeof ApprovalPhase)[keyof typeof ApprovalPhase];

export type ApprovalStatus = { phase: ApprovalPhase };

const ALLOWANCE_REFRESH_MS = 10_000;

interface AllowanceArgs {
  chainName: string | undefined;
  token: Address | undefined;
  /** Owner address — passed through to the SDK adapter (EVM hex or Tron base58). */
  owner: string | undefined;
  spender: Address | undefined;
  amount: bigint | undefined;
  isNative: boolean;
}

// Reactive read hook used by the review modal to preview "Revoke /
// Approve / Transfer" transactions before the user clicks Send. The actual
// broadcast logic lives in useTransfer.execute (plain async, no hook), so
// this is purely for UI state.
//
// Uses EvmTokenAdapter — works uniformly for EVM and Tron through
// MultiProtocolProvider's per-protocol dispatch (Tron's TronJsonRpcProvider
// is ethers-v5-compatible).
export function useApprovalStatus(args: AllowanceArgs): ApprovalStatus {
  const { chainName, token, owner, spender, amount, isNative } = args;
  const multiProvider = useMultiProvider();

  const enabled = !!chainName && !!token && !!owner && !!spender && !isNative && amount != null;

  const { data } = useQuery({
    queryKey: [
      'erc20-allowance',
      chainName,
      token?.toLowerCase(),
      owner,
      spender?.toLowerCase(),
      amount?.toString() ?? null,
    ],
    queryFn: async () => {
      if (!chainName || !token || !owner || !spender || amount == null) return null;
      const { EvmTokenAdapter } = await import('@hyperlane-xyz/sdk/token/adapters/EvmTokenAdapter');
      const adapter = new EvmTokenAdapter(chainName, multiProvider, { token });
      const [needsApprove, needsRevoke] = await Promise.all([
        adapter.isApproveRequired(owner, spender, amount.toString()),
        adapter.isRevokeApprovalRequired(owner, spender),
      ]);
      return { needsApprove, needsRevoke };
    },
    enabled,
    refetchInterval: ALLOWANCE_REFRESH_MS,
    staleTime: ALLOWANCE_REFRESH_MS,
  });

  if (isNative) return { phase: ApprovalPhase.Native };
  if (!enabled || !data) return { phase: ApprovalPhase.Idle };
  if (data.needsApprove && data.needsRevoke) return { phase: ApprovalPhase.NeedsRevoke };
  if (data.needsApprove) return { phase: ApprovalPhase.NeedsApprove };
  return { phase: ApprovalPhase.Ready };
}
