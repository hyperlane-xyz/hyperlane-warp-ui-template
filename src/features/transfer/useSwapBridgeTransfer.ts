import {
  buildSwapAndBridgeTx,
  commitmentFromIcaCalls,
  getBridgeFee,
  getSwapQuote,
  normalizeCalls,
  shareCallsWithPrivateRelayer,
} from '@hyperlane-xyz/sdk';
import { BigNumber, providers } from 'ethers';
import { useCallback, useState } from 'react';
import {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  encodeFunctionData,
  maxUint256,
  parseAbi,
  parseUnits,
} from 'viem';
import { DEFAULT_SLIPPAGE, getSwapConfig } from '../swap/swapConfig';
import { TransferStatus } from './types';

const COMMITMENTS_SERVICE_URL =
  'https://offchain-lookup.services.hyperlane.xyz/callCommitments/calls';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
]);

const icaRouterAbi = parseAbi([
  'function getLocalInterchainAccount(uint32 _origin, address _owner, address _router, address _ism) view returns (address)',
]);

export interface SwapBridgeParams {
  originChainName: string;
  destinationChainName: string;
  originTokenAddress: string;
  destinationTokenAddress: string;
  amount: string;
  originDecimals: number;
  walletClient: WalletClient;
  publicClient: PublicClient;
  ethersProvider: providers.Provider;
  onStatusChange: (status: TransferStatus) => void;
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function requireAddress(value: string, errorMessage: string): Address {
  if (!value || value.length < 10) throw new Error(errorMessage);
  return value as Address;
}

async function checkAndApprove(
  walletClient: WalletClient,
  publicClient: PublicClient,
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
      chain: walletClient.chain,
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
    amount,
    originDecimals,
    walletClient,
    publicClient,
    ethersProvider,
    onStatusChange,
  } = params;

  const originConfig = getSwapConfig(originChainName);
  const destConfig = getSwapConfig(destinationChainName);
  if (!originConfig || !destConfig) throw new Error('Swap not supported for selected chains');

  const account = walletClient.account?.address;
  if (!account) throw new Error('Wallet not connected');

  const universalRouter = requireAddress(
    originConfig.universalRouter,
    'Universal Router address not configured',
  );

  const icaAddress = await publicClient.readContract({
    address: destConfig.icaRouter as Address,
    abi: icaRouterAbi,
    functionName: 'getLocalInterchainAccount',
    args: [originConfig.domainId, account, originConfig.icaRouter as Address, ZERO_ADDRESS],
  });

  const salt = randomSalt();
  const amountWei = parseUnits(amount, originDecimals);
  const amountBN = BigNumber.from(amountWei.toString());

  const rawDestCalls =
    destinationTokenAddress.toLowerCase() !== destConfig.bridgeToken.toLowerCase()
      ? [
          {
            to: destinationTokenAddress,
            data: '0x',
            value: '0',
          },
        ]
      : [];

  const normalizedCalls = rawDestCalls.length > 0 ? normalizeCalls(rawDestCalls) : [];
  const commitmentHash =
    normalizedCalls.length > 0 ? commitmentFromIcaCalls(normalizedCalls, salt) : salt;

  onStatusChange(TransferStatus.Preparing);

  const isNativeToken =
    originTokenAddress === ZERO_ADDRESS ||
    originTokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const swapTokenAddress = isNativeToken ? originConfig.wrappedNative : originTokenAddress;

  const swapOutput = await getSwapQuote(
    ethersProvider,
    swapTokenAddress,
    originConfig.bridgeToken,
    amountBN,
  );

  const bridge = await getBridgeFee(
    ethersProvider,
    originConfig.warpRoute,
    destConfig.domainId,
    swapOutput,
  );

  const sdkParams = {
    originToken: swapTokenAddress,
    bridgeToken: originConfig.bridgeToken,
    destinationToken: destinationTokenAddress,
    amount: amountBN,
    recipient: icaAddress,
    originDomain: originConfig.domainId,
    destinationDomain: destConfig.domainId,
    warpRouteAddress: originConfig.warpRoute,
    icaRouterAddress: originConfig.icaRouter,
    remoteIcaRouterAddress: destConfig.icaRouter,
    universalRouterAddress: universalRouter,
    ismAddress: ZERO_ADDRESS,
    commitment: commitmentHash,
    slippage: DEFAULT_SLIPPAGE,
    bridgeMsgFee: bridge.fee,
  };

  const { commands, inputs, value } = buildSwapAndBridgeTx(sdkParams);

  if (!isNativeToken) {
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

  const txValue = BigInt(value.toString()) + (isNativeToken ? amountWei : 0n);
  const hash = await walletClient.sendTransaction({
    account,
    to: universalRouter,
    data,
    value: txValue,
    chain: walletClient.chain,
  });

  onStatusChange(TransferStatus.ConfirmingSwapBridge);
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  if (rawDestCalls.length > 0) {
    onStatusChange(TransferStatus.PostingCommitment);
    await shareCallsWithPrivateRelayer(COMMITMENTS_SERVICE_URL, {
      calls: rawDestCalls,
      relayers: [],
      salt,
      commitmentDispatchTx: hash,
      originDomain: originConfig.domainId,
    });
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
