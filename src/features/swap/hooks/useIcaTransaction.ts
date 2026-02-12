import {
  InterchainAccount,
  buildErc20ApproveCall,
  buildIcaCommitmentFromRawCalls,
  buildPostCallsPayload,
  buildWarpTransferRemoteCall,
  getBridgeFee,
  getSwapQuote,
  shareCallsWithPrivateRelayer,
} from '@hyperlane-xyz/sdk';
import { addressToBytes32, eqAddress, isZeroishAddress } from '@hyperlane-xyz/utils';
import { BigNumber } from 'ethers';
import { useCallback, useState } from 'react';
import {
  Hex,
  WalletClient,
  encodeFunctionData,
  isAddress,
  maxUint256,
  parseAbi,
  parseUnits,
} from 'viem';
import { usePublicClient } from 'wagmi';
import { useMultiProvider } from '../../chains/hooks';
import { getIcaFee } from '@hyperlane-xyz/sdk';
import { DEFAULT_SLIPPAGE, getSwapConfig } from '../swapConfig';
import {
  CommitmentCall,
  applySlippage,
  buildUniversalRouterV3SwapExactInCall,
} from '../universalRouter';
import { COMMITMENTS_SERVICE_URL, randomSalt, toErrorMessage } from '../utils';

type IcaTransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'complete' | 'failed';

const erc20BalanceAbi = parseAbi(['function balanceOf(address account) view returns (uint256)']);
const erc20TransferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const icaRouterAbi = parseAbi([
  'function callRemoteCommitReveal(uint32 destinationDomain, bytes32 commitment, uint256 gasLimit) payable returns (bytes32 commitmentMsgId, bytes32 revealMsgId)',
]);

export function useIcaTransaction(
  icaApp: InterchainAccount | null,
  originChainName?: string,
  destinationChainName?: string,
) {
  const originConfig = originChainName ? getSwapConfig(originChainName) : undefined;
  const destConfig = destinationChainName ? getSwapConfig(destinationChainName) : undefined;

  const [status, setStatus] = useState<IcaTransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId: originConfig?.chainId });
  const destinationPublicClient = usePublicClient({ chainId: destConfig?.chainId });
  const multiProvider = useMultiProvider();

  const sendFromIca = useCallback(
    async (params: {
      token: string;
      amount: string;
      recipient: string;
      mode: 'send-destination' | 'return-origin';
      signer: WalletClient;
      decimals?: number;
    }) => {
      try {
        setStatus('building');
        setError(null);
        setTxHash(null);

        if (!icaApp || !originChainName || !destinationChainName)
          throw new Error('ICA app not initialized.');
        if (!originConfig || !destConfig)
          throw new Error('Swap config not available for selected chains.');

        const account = params.signer.account?.address;
        if (!account) throw new Error('Wallet account unavailable. Reconnect wallet and retry.');
        if (params.signer.chain?.id !== originConfig.chainId) {
          try {
            await params.signer.switchChain({ id: originConfig.chainId });
          } catch {
            throw new Error(`Wrong connected origin chain. Switch wallet to ${originChainName}.`);
          }
        }
        if (!isAddress(params.token)) throw new Error('Invalid token address.');
        if (isZeroishAddress(params.token))
          throw new Error('Native-token ICA sends are not supported in this flow.');
        if (!isAddress(params.recipient)) throw new Error('Invalid recipient address.');

        const amount = parseUnits(params.amount, params.decimals ?? 18);
        if (amount <= 0n) throw new Error('Amount must be greater than zero.');
        const amountBN = BigNumber.from(amount.toString());

        if (params.mode === 'return-origin') {
          if (!isAddress(destConfig.icaBridgeRoute)) {
            throw new Error('ICA bridge route not configured for destination chain.');
          }
          if (!isAddress(destConfig.universalRouter)) {
            throw new Error('Destination universal router not configured.');
          }
          if (!destinationPublicClient) {
            throw new Error('Destination public client unavailable.');
          }

          const destinationProvider = multiProvider.getEthersV5Provider(destinationChainName);
          const originProvider = multiProvider.getEthersV5Provider(originChainName);

          const icaAddress = await icaApp.getAccount(destinationChainName, {
            origin: originChainName,
            owner: account,
          });
          if (!isAddress(icaAddress)) {
            throw new Error('Invalid ICA address while preparing return transaction.');
          }

          const inputIsBridgeToken = eqAddress(params.token, destConfig.bridgeToken);

          let swapOutputMin: BigNumber | undefined;
          if (!inputIsBridgeToken) {
            const swapOutput = await (async () => {
              try {
                return await getSwapQuote(
                  destinationProvider,
                  destConfig.quoterV2,
                  params.token,
                  destConfig.bridgeToken,
                  amountBN,
                  {
                    poolParam: destConfig.poolParam,
                    dexFlavor: destConfig.dexFlavor,
                  },
                );
              } catch (quoteError) {
                throw new Error(
                  `Failed to quote destination swap for ICA return flow. Root cause: ${toErrorMessage(quoteError)}`,
                );
              }
            })();
            swapOutputMin = applySlippage(swapOutput, DEFAULT_SLIPPAGE);
            if (swapOutputMin.lte(0)) {
              throw new Error('Destination swap output is too low after slippage.');
            }
          }

          let bridgeAmount = inputIsBridgeToken ? amountBN : swapOutputMin!;
          const recipientBytes32 = addressToBytes32(params.recipient);

          const quoteBridge = async (amountToBridge: BigNumber) =>
            getBridgeFee(
              destinationProvider,
              destConfig.icaBridgeRoute,
              originConfig.domainId,
              amountToBridge,
              destConfig.bridgeToken,
              recipientBytes32,
            );

          let bridgeQuote = await quoteBridge(bridgeAmount);
          let tokenPull = bridgeQuote.tokenPull.lt(bridgeAmount)
            ? bridgeAmount
            : bridgeQuote.tokenPull;

          if (!inputIsBridgeToken && swapOutputMin) {
            for (let attempts = 0; attempts < 4 && tokenPull.gt(swapOutputMin); attempts += 1) {
              const deficit = tokenPull.sub(swapOutputMin);
              if (deficit.gte(bridgeAmount)) {
                throw new Error('Swap output is insufficient to cover bridge token fees.');
              }
              bridgeAmount = bridgeAmount.sub(deficit);
              bridgeQuote = await quoteBridge(bridgeAmount);
              tokenPull = bridgeQuote.tokenPull.lt(bridgeAmount)
                ? bridgeAmount
                : bridgeQuote.tokenPull;
            }
            if (tokenPull.gt(swapOutputMin)) {
              throw new Error(
                'Swap output is insufficient to cover bridge token fees after adjustment.',
              );
            }
          }

          const msgFee = bridgeQuote.fee;

          const [icaNativeBalance, inputTokenBalance] = await Promise.all([
            destinationPublicClient.getBalance({
              address: icaAddress as `0x${string}`,
            }),
            destinationPublicClient.readContract({
              address: params.token as `0x${string}`,
              abi: erc20BalanceAbi,
              functionName: 'balanceOf',
              args: [icaAddress as `0x${string}`],
            }),
          ]);

          if (icaNativeBalance < BigInt(msgFee.toString())) {
            throw new Error(
              `Insufficient ${destinationChainName} native balance in ICA to cover bridge message fee.`,
            );
          }
          if (inputTokenBalance < amount) {
            throw new Error('Insufficient ICA input token balance for requested amount.');
          }
          if (inputIsBridgeToken && inputTokenBalance < BigInt(tokenPull.toString())) {
            throw new Error(
              'Insufficient ICA bridge-token balance to cover amount plus bridge fees.',
            );
          }

          const rawCalls: CommitmentCall[] = [];
          if (!inputIsBridgeToken && swapOutputMin) {
            rawCalls.push(
              buildErc20ApproveCall({
                token: params.token,
                spender: destConfig.universalRouter,
                amount: maxUint256.toString(),
              }),
            );
            rawCalls.push(
              buildUniversalRouterV3SwapExactInCall({
                universalRouter: destConfig.universalRouter,
                recipient: icaAddress,
                tokenIn: params.token,
                tokenOut: destConfig.bridgeToken,
                amountIn: amountBN,
                amountOutMinimum: swapOutputMin,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                dexFlavor: destConfig.dexFlavor,
                poolParam: destConfig.poolParam,
                payerIsUser: true,
              }),
            );
          }

          rawCalls.push(
            buildErc20ApproveCall({
              token: destConfig.bridgeToken,
              spender: destConfig.icaBridgeRoute,
              amount: tokenPull.toString(),
            }),
          );
          rawCalls.push(
            buildWarpTransferRemoteCall({
              warpRoute: destConfig.icaBridgeRoute,
              destinationDomain: originConfig.domainId,
              recipient: params.recipient,
              amount: bridgeAmount,
              msgFee,
            }),
          );

          const estimatedHandleGas = await icaApp.estimateIcaHandleGas({
            origin: originChainName,
            destination: destinationChainName,
            innerCalls: rawCalls.map((call) => ({
              ...call,
              value: call.value?.toString() ?? '0',
            })),
            config: {
              origin: originChainName,
              owner: account,
            },
          });

          const commitRevealMsgFee = await getIcaFee(
            originProvider,
            originConfig.icaRouter,
            destConfig.domainId,
            estimatedHandleGas.toString(),
          );

          const salt = randomSalt();
          const commitmentPayload = buildIcaCommitmentFromRawCalls(rawCalls, salt);
          const txData = encodeFunctionData({
            abi: icaRouterAbi,
            functionName: 'callRemoteCommitReveal',
            args: [
              destConfig.domainId,
              commitmentPayload.commitment as `0x${string}`,
              BigInt(estimatedHandleGas.toString()),
            ],
          });

          setStatus('signing');
          const hash = await params.signer.sendTransaction({
            account,
            to: originConfig.icaRouter as `0x${string}`,
            data: txData as Hex,
            value: BigInt(commitRevealMsgFee.toString()),
            chain: null,
          });
          setTxHash(hash);
          setStatus('confirming');

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
          }

          const payload = buildPostCallsPayload({
            calls: commitmentPayload.normalizedCalls,
            relayers: [],
            salt,
            commitmentDispatchTx: hash,
            originDomain: originConfig.domainId,
            destinationDomain: destConfig.domainId,
            owner: account,
          });
          const relayerResponse = await shareCallsWithPrivateRelayer(
            COMMITMENTS_SERVICE_URL,
            payload,
          );
          if (!relayerResponse.ok) {
            throw new Error('Relayer rejected commitment payload.');
          }

          setStatus('complete');
          return;
        }

        const transferData = encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: 'transfer',
          args: [params.recipient as `0x${string}`, amount],
        });

        const populatedTx = await icaApp.getCallRemote({
          chain: originChainName,
          destination: destinationChainName,
          innerCalls: [{ to: params.token, data: transferData, value: '0' }],
          config: {
            origin: originChainName,
            owner: account,
          },
        });

        setStatus('signing');
        const hash = await params.signer.sendTransaction({
          account,
          to: populatedTx.to as `0x${string}`,
          data: populatedTx.data as Hex,
          value: populatedTx.value ? BigInt(populatedTx.value.toString()) : 0n,
          chain: null,
        });

        setTxHash(hash);
        setStatus('confirming');

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }

        setStatus('complete');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : `Failed to send from ICA: ${toErrorMessage(err)}`;
        setError(message);
        setStatus('failed');
      }
    },
    [
      publicClient,
      destinationPublicClient,
      icaApp,
      originChainName,
      destinationChainName,
      originConfig,
      destConfig,
      multiProvider,
    ],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { status, error, txHash, sendFromIca, reset };
}
