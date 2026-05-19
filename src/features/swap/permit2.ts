import { ProviderType } from '@hyperlane-xyz/sdk';
import { convertToProtocolAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  decodeFunctionResult,
  encodeFunctionData,
  maxUint160,
  maxUint256,
  parseAbi,
  zeroAddress,
  type Address,
} from 'viem';
import { useReadContract, useWriteContract } from 'wagmi';

import { config } from '../../consts/config';
import { useChainProtocol, useMultiProvider } from '../chains/hooks';

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
  /** Source chain name — needed for Tron RPC dispatch via MultiProvider. */
  chainName: string | undefined;
  token: Address | undefined;
  owner: Address | undefined;
  universalRouter: Address | undefined;
  /** Permit2 address from /v1/chains. UR.PERMIT2() per chain. */
  permit2Address: Address | undefined;
  amount: bigint | undefined;
  isNative: boolean;
}

// Reads both ERC20→Permit2 and Permit2→UR allowances and reports which tx
// (if any) the user needs to send next. Native source skips approvals
// (engine sets payerIsUser=false in the calldata).
//
// Protocol-aware: EVM goes through wagmi's hooks; Tron uses MultiProvider's
// TronJsonRpcProvider since wagmi has no Tron chain. Both branches return
// the same Permit2Status shape so SwapForm doesn't have to know.
export function usePermit2Status(args: AllowanceArgs): Permit2Status {
  const protocol = useChainProtocol(args.chainName);
  const isTron = protocol === ProtocolType.Tron;

  const evm = useEvmPermit2Status(args, !isTron);
  const tron = useTronPermit2Status(args, isTron);

  return isTron ? tron : evm;
}

function useEvmPermit2Status(args: AllowanceArgs, enabled: boolean): Permit2Status {
  const { chainId, token, owner, universalRouter, permit2Address, amount, isNative } = args;
  const baseReady =
    enabled &&
    !!chainId &&
    !!token &&
    !!owner &&
    !!universalRouter &&
    !!permit2Address &&
    !isNative;

  const { data: erc20Allowance } = useReadContract({
    chainId,
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: owner && permit2Address ? [owner, permit2Address] : undefined,
    query: { enabled: baseReady && !!owner && !!permit2Address },
  });

  const { data: permit2Allowance } = useReadContract({
    chainId,
    address: permit2Address,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: owner && token && universalRouter ? [owner, token, universalRouter] : undefined,
    query: { enabled: baseReady && !!owner && !!token && !!universalRouter },
  });

  if (!enabled) return { phase: Permit2Phase.Idle };
  if (isNative) return { phase: Permit2Phase.Native };
  if (!baseReady || amount == null) return { phase: Permit2Phase.Idle };

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

const TRON_ALLOWANCE_REFRESH_MS = 10_000;

function useTronPermit2Status(args: AllowanceArgs, enabled: boolean): Permit2Status {
  const { chainName, token, owner, universalRouter, permit2Address, amount, isNative } = args;
  const multiProvider = useMultiProvider();

  // Tron wallets give base58 owner addresses; the on-chain Permit2 + ERC20
  // see addresses as 20-byte EVM hex. Convert at the read boundary.
  const ownerHex = owner ? toEvmHex(owner) : undefined;

  const queryEnabled =
    enabled &&
    !isNative &&
    !!chainName &&
    !!token &&
    !!ownerHex &&
    !!universalRouter &&
    !!permit2Address;

  const { data } = useQuery({
    queryKey: [
      'tron-permit2-status',
      chainName,
      token?.toLowerCase(),
      ownerHex?.toLowerCase(),
      universalRouter?.toLowerCase(),
      permit2Address?.toLowerCase(),
    ],
    queryFn: async () => {
      if (!chainName || !token || !ownerHex || !universalRouter || !permit2Address) return null;
      const provider = multiProvider.getEthersV5Provider(chainName);
      // Encode via viem, raw eth_call via the TronJsonRpcProvider, decode
      // via viem. Avoids depending on ethers directly.
      const erc20Data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerHex, permit2Address],
      });
      const permit2Data = encodeFunctionData({
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [ownerHex, token, universalRouter],
      });
      const [erc20Raw, permit2Raw] = await Promise.all([
        provider.call({ to: token, data: erc20Data }),
        provider.call({ to: permit2Address, data: permit2Data }),
      ]);
      const erc20Allowance = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'allowance',
        data: erc20Raw as `0x${string}`,
      }) as bigint;
      const permit2Tuple = decodeFunctionResult({
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        data: permit2Raw as `0x${string}`,
      }) as readonly [bigint, number, number];
      return {
        erc20Allowance,
        permit2Amount: permit2Tuple[0],
        permit2Expiration: Number(permit2Tuple[1]),
      };
    },
    enabled: queryEnabled,
    refetchInterval: TRON_ALLOWANCE_REFRESH_MS,
    staleTime: TRON_ALLOWANCE_REFRESH_MS,
  });

  if (!enabled) return { phase: Permit2Phase.Idle };
  if (isNative) return { phase: Permit2Phase.Native };
  if (!queryEnabled || amount == null || !data) return { phase: Permit2Phase.Idle };

  if (data.erc20Allowance < amount) return { phase: Permit2Phase.NeedsErc20Approve };
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (data.permit2Amount < amount || data.permit2Expiration <= nowSeconds) {
    return { phase: Permit2Phase.NeedsPermit2Approve };
  }
  return { phase: Permit2Phase.Ready };
}

// ── Approve hooks ──────────────────────────────────────────────────────

interface ApproveArgs {
  token: Address | undefined;
  /** Permit2 contract address (the approval target for step 1). */
  permit2Address: Address | undefined;
  /** Source chain name — needed for Tron dispatch. */
  chainName: string | undefined;
}

interface ApprovePermit2Args extends ApproveArgs {
  universalRouter: Address | undefined;
  expirationSeconds?: number;
}

interface ApproveResult {
  send: () => Promise<string>;
  isPending: boolean;
}

export function useApproveErc20ToPermit2(args: ApproveArgs): ApproveResult {
  const protocol = useChainProtocol(args.chainName);
  const evm = useEvmApproveErc20ToPermit2(args);
  const tron = useTronApproveErc20ToPermit2(args);
  return protocol === ProtocolType.Tron ? tron : evm;
}

function useEvmApproveErc20ToPermit2(args: ApproveArgs): ApproveResult {
  const { writeContractAsync, isPending } = useWriteContract();
  const send = useCallback(async () => {
    if (!args.token) throw new Error('Cannot approve: token address not set');
    if (!args.permit2Address) throw new Error('Cannot approve: Permit2 address not set');
    return writeContractAsync({
      address: args.token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [args.permit2Address, maxUint256],
    });
  }, [writeContractAsync, args.token, args.permit2Address]);
  return { send, isPending };
}

function useTronApproveErc20ToPermit2(args: ApproveArgs): ApproveResult {
  const multiProvider = useMultiProvider();
  const txFns = useTransactionFns(multiProvider);
  const [isPending, setIsPending] = useState(false);

  const send = useCallback(async () => {
    if (!args.token) throw new Error('Cannot approve: token address not set');
    if (!args.permit2Address) throw new Error('Cannot approve: Permit2 address not set');
    if (!args.chainName) throw new Error('Cannot approve: chainName not set');
    setIsPending(true);
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [args.permit2Address, maxUint256],
      });
      const { hash, confirm } = await txFns[ProtocolType.Tron].sendTransaction({
        tx: {
          type: ProviderType.EthersV5,
          transaction: { to: args.token, data, value: '0' },
          category: 'transfer',
        } as Parameters<(typeof txFns)[ProtocolType.Tron]['sendTransaction']>[0]['tx'],
        chainName: args.chainName,
      });
      await confirm();
      return hash;
    } finally {
      setIsPending(false);
    }
  }, [txFns, args.token, args.permit2Address, args.chainName]);

  return { send, isPending };
}

export function useApprovePermit2ToRouter(args: ApprovePermit2Args): ApproveResult {
  const protocol = useChainProtocol(args.chainName);
  const evm = useEvmApprovePermit2ToRouter(args);
  const tron = useTronApprovePermit2ToRouter(args);
  return protocol === ProtocolType.Tron ? tron : evm;
}

function useEvmApprovePermit2ToRouter(args: ApprovePermit2Args): ApproveResult {
  const { writeContractAsync, isPending } = useWriteContract();
  const send = useCallback(async () => {
    if (!args.token || !args.universalRouter) {
      throw new Error('Cannot approve: token or universalRouter not set');
    }
    if (!args.permit2Address) throw new Error('Cannot approve: Permit2 address not set');
    if (args.universalRouter === zeroAddress) {
      throw new Error('Cannot approve: universalRouter is zero address');
    }
    const lifetime = args.expirationSeconds ?? config.permit2ExpirationSeconds;
    const expiration = Math.floor(Date.now() / 1000) + lifetime;
    return writeContractAsync({
      address: args.permit2Address,
      abi: PERMIT2_ABI,
      functionName: 'approve',
      args: [args.token, args.universalRouter, maxUint160, expiration],
    });
  }, [
    writeContractAsync,
    args.token,
    args.universalRouter,
    args.permit2Address,
    args.expirationSeconds,
  ]);
  return { send, isPending };
}

function useTronApprovePermit2ToRouter(args: ApprovePermit2Args): ApproveResult {
  const multiProvider = useMultiProvider();
  const txFns = useTransactionFns(multiProvider);
  const [isPending, setIsPending] = useState(false);

  const send = useCallback(async () => {
    if (!args.token || !args.universalRouter) {
      throw new Error('Cannot approve: token or universalRouter not set');
    }
    if (!args.permit2Address) throw new Error('Cannot approve: Permit2 address not set');
    if (args.universalRouter === zeroAddress) {
      throw new Error('Cannot approve: universalRouter is zero address');
    }
    if (!args.chainName) throw new Error('Cannot approve: chainName not set');
    setIsPending(true);
    try {
      const lifetime = args.expirationSeconds ?? config.permit2ExpirationSeconds;
      const expiration = Math.floor(Date.now() / 1000) + lifetime;
      const data = encodeFunctionData({
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [args.token, args.universalRouter, maxUint160, expiration],
      });
      const { hash, confirm } = await txFns[ProtocolType.Tron].sendTransaction({
        tx: {
          type: ProviderType.EthersV5,
          transaction: { to: args.permit2Address, data, value: '0' },
          category: 'transfer',
        } as Parameters<(typeof txFns)[ProtocolType.Tron]['sendTransaction']>[0]['tx'],
        chainName: args.chainName,
      });
      await confirm();
      return hash;
    } finally {
      setIsPending(false);
    }
  }, [
    txFns,
    args.token,
    args.universalRouter,
    args.permit2Address,
    args.expirationSeconds,
    args.chainName,
  ]);

  return { send, isPending };
}

function toEvmHex(addr: string): Address | undefined {
  try {
    return convertToProtocolAddress(addr, ProtocolType.Ethereum) as Address;
  } catch {
    return undefined;
  }
}
