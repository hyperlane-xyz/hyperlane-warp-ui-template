import { useCallback, useState } from 'react';
import {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  isAddress,
  keccak256,
  maxUint256,
  numberToHex,
  parseAbi,
  parseAbiParameters,
  parseUnits,
  zeroAddress,
} from 'viem';
import { DEFAULT_SLIPPAGE, SWAP_CHAINS, SWAP_CONTRACTS } from './swapConfig';
import { SwapFormValues, SwapQuote, SwapStatus } from './types';

const COMMITMENTS_SERVICE_URL =
  'https://offchain-lookup.services.hyperlane.xyz/callCommitments';

const Commands = {
  V3_SWAP_EXACT_IN: 0x00,
  BRIDGE_TOKEN: 0x12,
  EXECUTE_CROSS_CHAIN: 0x13,
} as const;

const BridgeTypes = {
  HYP_ERC20_COLLATERAL: 0x03,
} as const;

type DestinationCall = {
  to: Address;
  data: Hex;
  value: bigint;
};

type PostCommitmentParams = {
  calls: DestinationCall[];
  salt: Hex;
  commitmentHash: Hex;
  originDomain: number;
  destinationDomain: number;
  owner: Address;
};

type PostCommitmentResult = {
  success: boolean;
  error?: string;
};

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
]);

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
]);

const TOKEN_DECIMALS: Record<string, number> = {
  [normalizeAddress(zeroAddress)]: 18,
  [normalizeAddress(SWAP_CONTRACTS.usdcArb)]: 6,
  [normalizeAddress(SWAP_CONTRACTS.usdcBase)]: 6,
  [normalizeAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')]: 18,
  [normalizeAddress('0x4200000000000000000000000000000000000006')]: 18,
};

export function useSwapTransaction() {
  const [status, setStatus] = useState<SwapStatus>(SwapStatus.Idle);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const executeSwap = useCallback(
    async (
      values: SwapFormValues,
      quote: SwapQuote,
      walletClient: WalletClient,
      publicClient: PublicClient,
    ) => {
      try {
        const account = walletClient.account?.address;
        if (!account) throw new Error('Wallet account unavailable. Reconnect wallet and retry.');

        const universalRouterArb = requireAddress(
          SWAP_CONTRACTS.universalRouterArb,
          'Missing Arbitrum Universal Router address in swapConfig',
        );

        setStatus(SwapStatus.PostingCommitment);
        setError(null);

        const salt = randomSalt();
        const destinationCalls = buildDestinationCalls(values, quote);
        const commitmentHash = computeCommitmentHash(destinationCalls, salt);

        const commitResult = await postCommitment({
          calls: destinationCalls,
          salt,
          commitmentHash,
          originDomain: SWAP_CHAINS.origin.domainId,
          destinationDomain: SWAP_CHAINS.destination.domainId,
          owner: universalRouterArb,
        });

        if (!commitResult.success) {
          throw new Error(commitResult.error || 'Failed to post call commitment');
        }

        setStatus(SwapStatus.Approving);
        const amountIn = parseAmount(values.amount, values.originTokenAddress);
        await checkAndApproveToken(
          walletClient,
          publicClient,
          values.originTokenAddress,
          universalRouterArb,
          amountIn,
        );

        setStatus(SwapStatus.Signing);
        const { commands, inputs, value } = buildOriginTransaction(
          values,
          quote,
          commitmentHash,
          salt,
        );

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
        const data = encodeFunctionData({
          abi: universalRouterAbi,
          functionName: 'execute',
          args: [commands, inputs, deadline],
        });

        const hash = await walletClient.sendTransaction({
          account,
          to: universalRouterArb,
          data,
          value,
          chain: walletClient.chain,
        });

        setTxHash(hash);
        setStatus(SwapStatus.Confirming);

        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        setStatus(SwapStatus.Bridging);
      } catch (err: unknown) {
        const txError = err as { code?: number | string; message?: string };
        if (txError.code === 4001 || txError.code === 'ACTION_REJECTED') {
          setError('Transaction cancelled.');
        } else {
          setError(txError.message || 'Swap failed');
        }
        setStatus(SwapStatus.Failed);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus(SwapStatus.Idle);
    setError(null);
    setTxHash(null);
  }, []);

  return { status, error, txHash, executeSwap, reset };
}

function buildDestinationCalls(values: SwapFormValues, quote: SwapQuote): DestinationCall[] {
  const universalRouterBase = requireAddress(
    SWAP_CONTRACTS.universalRouterBase,
    'Missing Base Universal Router address in swapConfig',
  );

  const inputAmount = parseAmount(quote.minimumReceived, SWAP_CONTRACTS.usdcBase);
  const outputMin = applySlippage(inputAmount, quote.slippage ?? DEFAULT_SLIPPAGE);

  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: requireAddress(SWAP_CONTRACTS.usdcBase, 'Missing Base USDC token address in swapConfig'),
        tokenOut: requireAddress(values.destinationTokenAddress, 'Destination token address is required'),
        fee: 500,
        recipient: requireAddress(SWAP_CONTRACTS.icaRouterBase, 'Missing Base ICA router in swapConfig'),
        amountIn: inputAmount,
        amountOutMinimum: outputMin,
        sqrtPriceLimitX96: 0,
      },
    ],
  });

  return [
    {
      to: universalRouterBase,
      data: swapData,
      value: 0n,
    },
  ];
}

function computeCommitmentHash(calls: DestinationCall[], salt: Hex): Hex {
  const callsPayload = encodeAbiParameters(
    parseAbiParameters('tuple(address to, bytes data, uint256 value)[]'),
    [calls],
  );

  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, bytes'), [salt, callsPayload]),
  );
}

async function postCommitment(params: PostCommitmentParams): Promise<PostCommitmentResult> {
  const response = await fetch(COMMITMENTS_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commitmentHash: params.commitmentHash,
      calls: params.calls.map((call) => ({ ...call, value: call.value.toString() })),
      salt: params.salt,
      originDomain: params.originDomain,
      destinationDomain: params.destinationDomain,
      owner: params.owner,
    }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return {
      success: false,
      error: getCommitmentError(body) || `Call commitments request failed (${response.status})`,
    };
  }

  const successful = isObject(body) ? body.success !== false : true;
  return {
    success: successful,
    error: successful ? undefined : getCommitmentError(body) || 'Call commitments service rejected request',
  };
}

async function checkAndApproveToken(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: string,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const token = requireAddress(tokenAddress, 'Origin token address is required');
  const owner = walletClient.account?.address;
  if (!owner) throw new Error('Wallet account unavailable. Reconnect wallet and retry.');
  if (token === zeroAddress) return;

  const currentAllowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });

  if (currentAllowance < amount) {
    const approveHash = await walletClient.writeContract({
      account: owner,
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
      chain: walletClient.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
  }
}

function buildOriginTransaction(
  values: SwapFormValues,
  quote: SwapQuote,
  commitmentHash: Hex,
  salt: Hex,
): { commands: Hex; inputs: Hex[]; value: bigint } {
  const amountIn = parseAmount(values.amount, values.originTokenAddress);
  const bridgeAmount = parseAmount(quote.minimumReceived, SWAP_CONTRACTS.usdcArb);
  const amountOutMin = applySlippage(bridgeAmount, quote.slippage ?? DEFAULT_SLIPPAGE);
  const destinationCalls = buildDestinationCalls(values, quote);

  const commands = concat([
    numberToHex(Commands.V3_SWAP_EXACT_IN, { size: 1 }),
    numberToHex(Commands.BRIDGE_TOKEN, { size: 1 }),
    numberToHex(Commands.EXECUTE_CROSS_CHAIN, { size: 1 }),
  ]);

  const originToken = requireAddress(values.originTokenAddress, 'Origin token address is required');
  const usdcArb = requireAddress(SWAP_CONTRACTS.usdcArb, 'Missing Arbitrum USDC token in swapConfig');
  const universalRouterArb = requireAddress(
    SWAP_CONTRACTS.universalRouterArb,
    'Missing Arbitrum Universal Router address in swapConfig',
  );

  const swapPath = concat([originToken, numberToHex(500, { size: 3 }), usdcArb]);

  const swapInput = encodeAbiParameters(
    parseAbiParameters('address, uint256, uint256, bytes, bool'),
    [universalRouterArb, amountIn, amountOutMin, swapPath, true],
  );

  const bridgeInput = encodeAbiParameters(
    parseAbiParameters('uint8, address, uint256, uint32, address'),
    [
      BridgeTypes.HYP_ERC20_COLLATERAL,
      usdcArb,
      bridgeAmount,
      SWAP_CHAINS.destination.domainId,
      requireAddress(SWAP_CONTRACTS.icaRouterBase, 'Missing Base ICA router in swapConfig'),
    ],
  );

  const executeCrossChainInput = encodeAbiParameters(
    parseAbiParameters('bytes32, bytes32, tuple(address to, bytes data, uint256 value)[]'),
    [commitmentHash, salt, destinationCalls],
  );

  return {
    commands,
    inputs: [swapInput, bridgeInput, executeCrossChainInput],
    value: 0n,
  };
}

function applySlippage(amount: bigint, slippage: number): bigint {
  const basisPoints = BigInt(Math.floor((slippage || DEFAULT_SLIPPAGE) * 10_000));
  return (amount * (10_000n - basisPoints)) / 10_000n;
}

function parseAmount(amount: string, tokenAddress: string): bigint {
  const sanitized = amount.trim();
  if (!sanitized) throw new Error('Amount is required');
  return parseUnits(sanitized, getTokenDecimals(tokenAddress));
}

function getTokenDecimals(tokenAddress: string): number {
  const key = normalizeAddress(tokenAddress);
  return TOKEN_DECIMALS[key] ?? 18;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function requireAddress(value: string, errorMessage: string): Address {
  if (!value || !isAddress(value)) {
    throw new Error(errorMessage);
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCommitmentError(body: unknown): string | undefined {
  if (!isObject(body)) return undefined;
  const error = body.error;
  const message = body.message;
  if (typeof error === 'string') return error;
  if (typeof message === 'string') return message;
  return undefined;
}

function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
