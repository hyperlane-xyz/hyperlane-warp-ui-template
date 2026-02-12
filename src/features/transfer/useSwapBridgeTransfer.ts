import {
  InterchainAccount,
  MultiProtocolProvider,
  buildErc20ApproveCall,
  buildIcaCommitmentFromRawCalls,
  buildPostCallsPayload,
  buildSwapAndBridgeTx,
  getBridgeFee,
  getSwapQuote,
  shareCallsWithPrivateRelayer,
} from '@hyperlane-xyz/sdk';
import { ZERO_ADDRESS_HEX_32, addressToBytes32, toWei } from '@hyperlane-xyz/utils';

import { BigNumber, providers } from 'ethers';
import { useCallback, useState } from 'react';
import {
  Address,
  Hex,
  WalletClient,
  createPublicClient,
  encodeFunctionData,
  http,
  isAddress,
  maxUint256,
  parseAbi,
} from 'viem';
import {
  DEFAULT_SLIPPAGE,
  getSwapConfig,
  isDemoSwapBridgePath,
} from '../swap/swapConfig';
import { getIcaCommitRevealFee } from '../swap/icaFees';
import { TransferStatus } from './types';

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
]);

const COMMITMENTS_SERVICE_URL =
  'https://offchain-lookup.services.hyperlane.xyz/callCommitments/calls';
const FEE_BUFFER_ATTEMPTS_BPS = [500, 2000, 5000] as const;
const BPS_DENOMINATOR = 10_000;

type CommitmentCall = {
  to: string;
  data: string;
  value?: string | number;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

export interface SwapBridgeParams {
  originChainName: string;
  destinationChainName: string;
  originTokenAddress: string;
  destinationTokenAddress: string;
  destinationRouteAddress: string;
  amount: string;
  originDecimals: number;
  isNativeOriginToken: boolean;
  walletClient: WalletClient;
  multiProvider: MultiProtocolProvider;
  icaApp: InterchainAccount;
  onStatusChange: (status: TransferStatus) => void;
  cachedIcaAddress?: string;
  cachedSwapOutput?: BigNumber;
  cachedBridgeFee?: BigNumber;
  cachedIcaFee?: BigNumber;
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function requireAddress(value: string, errorMessage: string): Address {
  if (!isAddress(value)) throw new Error(errorMessage);
  return value as Address;
}

function maxBigNumber(
  a: BigNumber | undefined,
  b: BigNumber | undefined,
): BigNumber {
  if (a && b) return a.gt(b) ? a : b;
  return a ?? b ?? BigNumber.from(0);
}

function withFeeBufferBps(fee: BigNumber, bufferBps: number): BigNumber {
  if (fee.isZero()) return fee;
  return fee.mul(BPS_DENOMINATOR + bufferBps).add(BPS_DENOMINATOR - 1).div(BPS_DENOMINATOR);
}

function isInsufficientValueError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return message.includes('insufficient value') || message.includes('staticaggregationhook');
}

async function checkAndApprove(
  walletClient: WalletClient,
  publicClient: any,
  tokenAddress: Address,
  spender: Address,
  amount: bigint,
): Promise<void> {
  const owner = walletClient.account?.address;
  if (!owner) throw new Error('Wallet not connected');

  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });

  if (currentAllowance < amount) {
    const approveHash = await walletClient.writeContract({
      account: owner,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
      chain: null,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
  }
}

export async function executeSwapBridge(params: SwapBridgeParams): Promise<string> {
  const {
    originChainName,
    destinationChainName,
    originTokenAddress,
    destinationTokenAddress,
    destinationRouteAddress,
    amount,
    originDecimals,
    isNativeOriginToken,
    walletClient,
    multiProvider,
    icaApp,
    onStatusChange,
    cachedIcaAddress,
    cachedSwapOutput,
    cachedBridgeFee,
    cachedIcaFee,
  } = params;

  const originConfig = getSwapConfig(originChainName);
  const destConfig = getSwapConfig(destinationChainName);
  if (!originConfig || !destConfig) throw new Error('Swap not supported for selected chains');

  const account = walletClient.account?.address;
  if (!account) throw new Error('Wallet not connected');

  // Switch wallet to origin chain before sending any txs
  if (walletClient.chain?.id !== originConfig.chainId) {
    await walletClient.switchChain({ id: originConfig.chainId });
  }

  // Create a public client explicitly bound to the origin chain's RPC
  // (wagmi's usePublicClient is bound to whatever chain was active at render time)
  const rpcUrl = multiProvider.getRpcUrl(originChainName);
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const quoteProvider = new providers.JsonRpcProvider(rpcUrl);

  const universalRouter = requireAddress(
    originConfig.universalRouter,
    'Universal Router address not configured',
  );
  const originIcaRouter = requireAddress(
    originConfig.icaRouter,
    `Invalid origin ICA router address for ${originChainName}`,
  );
  const destinationIcaRouter = requireAddress(
    destConfig.icaRouter,
    `Invalid destination ICA router address for ${destinationChainName}`,
  );
  const warpRouteAddress = requireAddress(
    originConfig.warpRoute,
    `Invalid warp route address for ${originChainName}`,
  );

  if (
    !isDemoSwapBridgePath({
      originChainName,
      destinationChainName,
      destinationTokenAddress,
      destinationRouteAddress,
    })
  ) {
    throw new Error('Unsupported token pair. Demo supports Optimism -> Base canonical USDC only.');
  }

  const amountWeiString = toWei(amount, originDecimals);
  const amountWei = BigInt(amountWeiString);
  const amountBN = BigNumber.from(amountWeiString);

  onStatusChange(TransferStatus.Preparing);

  const swapTokenAddress = isNativeOriginToken ? originConfig.wrappedNative : originTokenAddress;

  const swapOutput =
    cachedSwapOutput ??
    (await (async () => {
      try {
        return await getSwapQuote(
          quoteProvider,
          originConfig.quoterV2,
          swapTokenAddress,
          originConfig.bridgeToken,
          amountBN,
          {
            poolParam: originConfig.poolParam,
            dexFlavor: originConfig.dexFlavor,
          },
        );
      } catch (error) {
        throw new Error(
          `Failed to quote ${originChainName} swap (${swapTokenAddress} -> ${originConfig.bridgeToken}). Retry with a smaller amount or try again shortly. Root cause: ${toErrorMessage(error)}`,
        );
      }
    })());

  const icaAddress =
    cachedIcaAddress ??
    (await icaApp.getAccount(destinationChainName, {
      origin: originChainName,
      owner: account,
    }));
  const recipient = requireAddress(
    icaAddress,
    `Invalid derived ICA recipient address for ${destinationChainName}`,
  );

  const bridgeQuote = await (async () => {
    try {
      return await getBridgeFee(
        quoteProvider,
        originConfig.warpRoute,
        destConfig.domainId,
        swapOutput,
        originConfig.bridgeToken,
        addressToBytes32(recipient),
      );
    } catch (error) {
      throw new Error(
        `Failed to quote bridge fee on ${originChainName}. Verify route support and retry. Root cause: ${toErrorMessage(error)}`,
      );
    }
  })();
  const bridgeBaseFee = maxBigNumber(cachedBridgeFee, bridgeQuote.fee);
  const bridgeTokenFee = bridgeQuote.bridgeTokenFee;

  const icaQuote = await (async () => {
    try {
      return await getIcaCommitRevealFee(
        quoteProvider,
        originIcaRouter,
        destConfig.domainId,
      );
    } catch (error) {
      throw new Error(
        `Failed to quote ICA execution fee (${originChainName} -> ${destinationChainName}). Retry in a few seconds. Root cause: ${toErrorMessage(error)}`,
      );
    }
  })();
  const icaBaseFee = maxBigNumber(cachedIcaFee, icaQuote);

  if (!isAddress(destinationTokenAddress)) {
    throw new Error('Invalid destination token address for ICA destination-call commitment.');
  }
  if (!isAddress(destConfig.icaBridgeRoute)) {
    throw new Error('Missing or invalid destination bridge route required for ICA commitment calls.');
  }

  const rawDestCalls: CommitmentCall[] = [
    buildErc20ApproveCall({
      token: destinationTokenAddress,
      spender: destConfig.icaBridgeRoute,
      amount: maxUint256.toString(),
    }),
  ];
  const salt = randomSalt();
  const commitmentPayload = buildIcaCommitmentFromRawCalls(rawDestCalls, salt);
  const commitmentHash = commitmentPayload.commitment;
  if (!commitmentHash) {
    throw new Error('Missing ICA commitment for cross-chain command.');
  }

  const swapBridgeParamsBase: Parameters<typeof buildSwapAndBridgeTx>[0] = {
    originToken: swapTokenAddress,
    bridgeToken: originConfig.bridgeToken,
    destinationToken: destinationTokenAddress,
    amount: amountBN,
    recipient,
    originDomain: originConfig.domainId,
    destinationDomain: destConfig.domainId,
    warpRouteAddress,
    universalRouterAddress: universalRouter,
    slippage: DEFAULT_SLIPPAGE,
    isNativeOrigin: isNativeOriginToken,
    expectedSwapOutput: swapOutput,
    bridgeTokenFee,
    icaRouterAddress: originIcaRouter,
    remoteIcaRouterAddress: destinationIcaRouter,
    ismAddress: ZERO_ADDRESS_HEX_32,
    commitment: commitmentHash,
    dexFlavor: originConfig.dexFlavor,
    poolParam: originConfig.poolParam,
    includeCrossChainCommand: true,
  };

  if (!isNativeOriginToken) {
    onStatusChange(TransferStatus.SigningApprove);
    const originToken = requireAddress(swapTokenAddress, 'Origin token address required');
    await checkAndApprove(walletClient, publicClient, originToken, universalRouter, amountWei);
  }

  onStatusChange(TransferStatus.SigningSwapBridge);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const nativeBalance = await publicClient.getBalance({ address: account });
  let data: Hex | undefined;
  let txValue: bigint | undefined;
  let lastSimulationError: unknown;

  for (const bufferBps of FEE_BUFFER_ATTEMPTS_BPS) {
    const swapBridgeParams: Parameters<typeof buildSwapAndBridgeTx>[0] = {
      ...swapBridgeParamsBase,
      bridgeMsgFee: withFeeBufferBps(bridgeBaseFee, bufferBps),
      crossChainMsgFee: withFeeBufferBps(icaBaseFee, bufferBps),
    };
    const { commands, inputs, value } = buildSwapAndBridgeTx(swapBridgeParams);
    const attemptTxValue = BigInt(value.toString());

    if (nativeBalance < attemptTxValue) {
      throw new Error(
        'Insufficient origin-chain native balance to cover swap, bridge, and ICA execution fees.',
      );
    }

    const attemptData = encodeFunctionData({
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [commands as Hex, inputs as Hex[], deadline],
    });

    try {
      await publicClient.call({
        account,
        to: universalRouter,
        data: attemptData,
        value: attemptTxValue,
      });
      data = attemptData;
      txValue = attemptTxValue;
      break;
    } catch (error) {
      lastSimulationError = error;
      if (!isInsufficientValueError(error)) {
        throw new Error(
          `Unable to simulate swap+bridge before wallet confirmation. Check balances, fee quotes, and route readiness, then retry. Root cause: ${toErrorMessage(error)}`,
        );
      }
    }
  }

  if (!data || txValue === undefined) {
    throw new Error(
      `Unable to simulate swap+bridge before wallet confirmation. Check balances, fee quotes, and route readiness, then retry. Root cause: ${toErrorMessage(lastSimulationError)}`,
    );
  }

  const hash = await walletClient.sendTransaction({
    account,
    to: universalRouter,
    data,
    value: txValue,
    chain: null,
  });

  onStatusChange(TransferStatus.ConfirmingSwapBridge);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  onStatusChange(TransferStatus.PostingCommitment);
  try {
    const payload = buildPostCallsPayload({
      calls: commitmentPayload.normalizedCalls,
      relayers: [],
      salt,
      commitmentDispatchTx: hash,
      originDomain: originConfig.domainId,
    });
    const relayerResponse = await shareCallsWithPrivateRelayer(
      COMMITMENTS_SERVICE_URL,
      payload,
    );

    if (!relayerResponse.ok) {
      throw new Error('Relayer rejected commitment payload.');
    }
  } catch (error) {
    throw new Error(
      `Failed to post ICA call commitment to relayer service. Without this, reveal cannot execute destination calls. Root cause: ${toErrorMessage(error)}`,
    );
  }

  return hash;
}

export function useSwapBridgeTransfer() {
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async (params: SwapBridgeParams) => {
    setIsLoading(true);
    try {
      return await executeSwapBridge(params);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { execute, isLoading };
}
