import { maxUint160, maxUint256, parseAbi, zeroAddress, type Address } from 'viem';
import { useReadContract, useWriteContract } from 'wagmi';

import { config } from '../../consts/config';

// Canonical Permit2 contract — same address on every chain by design.
export const PERMIT2_ADDRESS: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const PERMIT2_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
]);

// Centralized phase identifiers so callers compare against a named
// constant instead of a bare string literal — rename-safe.
export const Permit2Phase = {
  Idle: 'idle',
  Native: 'native',
  NeedsErc20Approve: 'needs_erc20_approve',
  NeedsPermit2Approve: 'needs_permit2_approve',
  Ready: 'ready',
} as const;
export type Permit2Phase = (typeof Permit2Phase)[keyof typeof Permit2Phase];

export type Permit2Status = { phase: Permit2Phase };

interface AllowanceArgs {
  chainId: number | undefined;
  token: Address | undefined;
  owner: Address | undefined;
  universalRouter: Address | undefined;
  amount: bigint | undefined;
  isNative: boolean;
}

// Reads both ERC20→Permit2 and Permit2→UR allowances and reports which tx
// (if any) the user needs to send next. Native input skips approvals.
export function usePermit2Status(args: AllowanceArgs): Permit2Status {
  const { chainId, token, owner, universalRouter, amount, isNative } = args;
  const enabled = !!chainId && !!token && !!owner && !!universalRouter && !isNative;

  const { data: erc20Allowance } = useReadContract({
    chainId,
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: owner && PERMIT2_ADDRESS ? [owner, PERMIT2_ADDRESS] : undefined,
    query: { enabled: enabled && !!owner },
  });

  const { data: permit2Allowance } = useReadContract({
    chainId,
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: owner && token && universalRouter ? [owner, token, universalRouter] : undefined,
    query: { enabled: enabled && !!owner && !!token && !!universalRouter },
  });

  if (isNative) return { phase: Permit2Phase.Native };
  if (!enabled || amount == null) return { phase: Permit2Phase.Idle };

  if ((erc20Allowance ?? 0n) < amount) return { phase: Permit2Phase.NeedsErc20Approve };

  const [permit2Amount, permit2Expiration] = (permit2Allowance ?? [0n, 0, 0]) as [
    bigint,
    number,
    number,
  ];
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (permit2Amount < amount || permit2Expiration <= nowSeconds) {
    return { phase: Permit2Phase.NeedsPermit2Approve };
  }
  return { phase: Permit2Phase.Ready };
}

export function useApproveErc20ToPermit2(token: Address | undefined) {
  const { writeContractAsync, isPending } = useWriteContract();
  const send = async () => {
    if (!token) throw new Error('Cannot approve: token address not set');
    return writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, maxUint256],
    });
  };
  return { send, isPending };
}

export function useApprovePermit2ToRouter(args: {
  token: Address | undefined;
  universalRouter: Address | undefined;
  expirationSeconds?: number;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const send = async () => {
    if (!args.token || !args.universalRouter) {
      throw new Error('Cannot approve: token or universalRouter not set');
    }
    if (args.universalRouter === zeroAddress) {
      throw new Error('Cannot approve: universalRouter is zero address');
    }
    const lifetime = args.expirationSeconds ?? config.permit2ExpirationSeconds;
    const expiration = Math.floor(Date.now() / 1000) + lifetime;
    return writeContractAsync({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI,
      functionName: 'approve',
      args: [args.token, args.universalRouter, maxUint160, expiration],
    });
  };
  return { send, isPending };
}
