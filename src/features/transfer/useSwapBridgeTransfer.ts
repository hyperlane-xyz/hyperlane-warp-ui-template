import {
  InterchainAccount,
  MultiProtocolProvider,
  buildSwapAndBridgeTx,
  commitmentFromIcaCalls,
  getBridgeFee,
  getIcaFee,
  getSwapQuote,
  normalizeCalls,
  shareCallsWithPrivateRelayer,
} from '@hyperlane-xyz/sdk';
import { toWei } from '@hyperlane-xyz/utils';

import { BigNumber, providers } from 'ethers';
import { useCallback, useState } from 'react';
import {
  Address,
  Hex,
  WalletClient,
  createPublicClient,
  encodeFunctionData,
  http,
  maxUint256,
  parseAbi,
} from 'viem';
import {
  DEFAULT_SLIPPAGE,
  getSwapConfig,
  isDemoSwapBridgePath,
} from '../swap/swapConfig';
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

type CommitmentCall = {
  to: string;
  data: string;
  value?: string;
};

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
  ethersProvider: providers.Provider;
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
  if (!value || value.length < 10) throw new Error(errorMessage);
  return value as Address;
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
    ethersProvider,
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

  const universalRouter = requireAddress(
    originConfig.universalRouter,
    'Universal Router address not configured',
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
    (await getSwapQuote(
      ethersProvider,
      originConfig.quoterV2,
      swapTokenAddress,
      originConfig.bridgeToken,
      amountBN,
    ));

  const bridgeQuote = await getBridgeFee(
    ethersProvider,
    originConfig.warpRoute,
    destConfig.domainId,
    swapOutput,
  );
  const bridgeFee = cachedBridgeFee ?? bridgeQuote.fee;
  const bridgeTokenFee = bridgeQuote.bridgeTokenFee;

  if (!originConfig.icaRouter || !destConfig.icaRouter) {
    throw new Error('Missing ICA router configuration for selected chain pair.');
  }

  const icaFee =
    cachedIcaFee ??
    (await getIcaFee(ethersProvider, originConfig.icaRouter, destConfig.domainId));

  const rawDestCalls: CommitmentCall[] = [];
  const normalizedCalls = rawDestCalls.length > 0 ? normalizeCalls(rawDestCalls) : [];
  const salt = randomSalt();
  const commitmentHash =
    normalizedCalls.length > 0 ? commitmentFromIcaCalls(normalizedCalls, salt) : salt;
  if (!commitmentHash) {
    throw new Error('Missing ICA commitment for cross-chain command.');
  }

  const icaAddress =
    cachedIcaAddress ??
    (await icaApp.getAccount(destinationChainName, {
      origin: originChainName,
      owner: account,
    }));
  const recipient = icaAddress;

  const swapBridgeParams: Parameters<typeof buildSwapAndBridgeTx>[0] = {
    originToken: swapTokenAddress,
    bridgeToken: originConfig.bridgeToken,
    destinationToken: destinationTokenAddress,
    amount: amountBN,
    recipient,
    originDomain: originConfig.domainId,
    destinationDomain: destConfig.domainId,
    warpRouteAddress: originConfig.warpRoute,
    universalRouterAddress: universalRouter,
    slippage: DEFAULT_SLIPPAGE,
    isNativeOrigin: isNativeOriginToken,
    expectedSwapOutput: swapOutput,
    bridgeMsgFee: bridgeFee,
    bridgeTokenFee,
    icaRouterAddress: originConfig.icaRouter,
    remoteIcaRouterAddress: destConfig.icaRouter,
    commitment: commitmentHash,
    crossChainMsgFee: icaFee,
    includeCrossChainCommand: true,
  };

  const { commands, inputs, value } = buildSwapAndBridgeTx(swapBridgeParams);

  if (!isNativeOriginToken) {
    onStatusChange(TransferStatus.SigningApprove);
    const originToken = requireAddress(swapTokenAddress, 'Origin token address required');
    await checkAndApprove(walletClient, publicClient, originToken, universalRouter, amountWei);
  }

  onStatusChange(TransferStatus.SigningSwapBridge);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
  const data = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands as Hex, inputs as Hex[], deadline],
  });

  const txValue = BigInt(value.toString());
  const nativeBalance = await publicClient.getBalance({ address: account });
  if (nativeBalance < txValue) {
    throw new Error(
      'Insufficient origin-chain native balance to cover swap, bridge, and ICA execution fees.',
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

  if (rawDestCalls.length > 0) {
    onStatusChange(TransferStatus.PostingCommitment);
    const relayerResponse = await shareCallsWithPrivateRelayer(COMMITMENTS_SERVICE_URL, {
      calls: rawDestCalls,
      relayers: [],
      salt,
      commitmentDispatchTx: hash,
      originDomain: originConfig.domainId,
    });

    if (!relayerResponse.ok) {
      throw new Error('Failed to post ICA call commitment to relayer service.');
    }
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
