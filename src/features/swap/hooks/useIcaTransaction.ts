import { InterchainAccount } from '@hyperlane-xyz/sdk';
import { addressToBytes32 } from '@hyperlane-xyz/utils';
import { useCallback, useState } from 'react';
import { Hex, encodeFunctionData, isAddress, parseAbi, parseUnits } from 'viem';
import { usePublicClient } from 'wagmi';
import { getSwapConfig } from '../swapConfig';

type IcaTransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'complete' | 'failed';

const erc20Abi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);
const erc20TransferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

const warpRouteAbi = parseAbi([
  'function transferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) payable returns (bytes32)',
  'function quoteTransferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) view returns (uint256, (address,uint256)[])',
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

  const sendFromIca = useCallback(
    async (params: {
      token: string;
      amount: string;
      recipient: string;
      mode: 'send-destination' | 'return-origin';
      signer: {
        account?: { address: `0x${string}` };
        chain?: { id: number };
        sendTransaction: (args: {
          account: `0x${string}`;
          to: `0x${string}`;
          data: Hex;
          value?: bigint;
          chain?: { id: number };
        }) => Promise<Hex>;
      };
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
          throw new Error(`Wrong connected origin chain. Switch wallet to ${originChainName}.`);
        }
        if (!isAddress(params.token)) throw new Error('Invalid token address.');
        if (!isAddress(params.recipient)) throw new Error('Invalid recipient address.');

        const amount = parseUnits(params.amount, params.decimals ?? 6);
        if (amount <= 0n) throw new Error('Amount must be greater than zero.');

        let innerCalls: Array<{ to: string; data: `0x${string}`; value: string }>;

        if (params.mode === 'return-origin') {
          if (!isAddress(destConfig.icaBridgeRoute)) {
            throw new Error('ICA bridge route not configured for destination chain.');
          }
          if (!destinationPublicClient) {
            throw new Error('Fee quote failure: destination public client unavailable.');
          }

          const recipientBytes32 = addressToBytes32(params.recipient);

          let msgFee: bigint;
          try {
            const quote = await destinationPublicClient.readContract({
              address: destConfig.icaBridgeRoute as `0x${string}`,
              abi: warpRouteAbi,
              functionName: 'quoteTransferRemote',
              args: [originConfig.domainId, recipientBytes32 as `0x${string}`, amount],
            });
            msgFee = quote[0];
          } catch (error) {
            throw new Error('Fee quote failure while preparing ICA return transaction.');
          }

          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [destConfig.icaBridgeRoute as `0x${string}`, amount],
          });

          const transferRemoteData = encodeFunctionData({
            abi: warpRouteAbi,
            functionName: 'transferRemote',
            args: [originConfig.domainId, recipientBytes32 as `0x${string}`, amount],
          });

          innerCalls = [
            { to: params.token, data: approveData, value: '0' },
            {
              to: destConfig.icaBridgeRoute,
              data: transferRemoteData,
              value: msgFee.toString(),
            },
          ];
        } else {
          const transferData = encodeFunctionData({
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [params.recipient as `0x${string}`, amount],
          });

          innerCalls = [{ to: params.token, data: transferData, value: '0' }];
        }

        const populatedTx = await icaApp.getCallRemote({
          chain: originChainName,
          destination: destinationChainName,
          innerCalls,
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
          chain: params.signer.chain,
        });

        setTxHash(hash);
        setStatus('confirming');

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }

        setStatus('complete');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send from ICA';
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
    ],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { status, error, txHash, sendFromIca, reset };
}
