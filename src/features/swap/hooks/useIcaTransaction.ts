import { useCallback, useState } from 'react';
import { Hex, encodeFunctionData, isAddress, pad, parseAbi, parseUnits } from 'viem';
import { usePublicClient } from 'wagmi';
import { getSwapConfig } from '../swapConfig';

type IcaTransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'complete' | 'failed';

const icaRouterAbi = parseAbi([
  'function callRemote(uint32 destinationDomain, (address to,uint256 value,bytes data)[] calls) payable returns (bytes32)',
  'function quoteGasPayment(uint32 destinationDomain) view returns (uint256)',
]);

const erc20Abi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);

const warpRouteAbi = parseAbi([
  'function transferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) payable returns (bytes32)',
  'function quoteTransferRemote(uint32 destination, bytes32 recipient, uint256 amount) view returns ((address token, uint256 amount)[])',
]);

export function useIcaTransaction(originChainName?: string, destinationChainName?: string) {
  const originConfig = originChainName ? getSwapConfig(originChainName) : undefined;
  const destConfig = destinationChainName ? getSwapConfig(destinationChainName) : undefined;

  const [status, setStatus] = useState<IcaTransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId: originConfig?.chainId });
  const destPublicClient = usePublicClient({ chainId: destConfig?.chainId });

  const sendFromIca = useCallback(
    async (params: {
      token: string;
      amount: string;
      recipient: string;
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

        if (!originConfig || !destConfig)
          throw new Error('Swap config not available for selected chains.');

        const account = params.signer.account?.address;
        if (!account) throw new Error('Wallet account unavailable. Reconnect wallet and retry.');
        if (!isAddress(params.token)) throw new Error('Invalid token address.');
        if (!isAddress(params.recipient)) throw new Error('Invalid recipient address.');
        if (!isAddress(originConfig.icaRouter))
          throw new Error('ICA router missing in swapConfig.');
        if (!isAddress(destConfig.icaBridgeRoute)) {
          throw new Error('ICA bridge route not configured for destination chain.');
        }

        const amount = parseUnits(params.amount, params.decimals ?? 6);
        if (amount <= 0n) throw new Error('Amount must be greater than zero.');

        const recipientBytes32 = pad(params.recipient as `0x${string}`, { size: 32 });

        let bridgeMsgValue = 0n;
        if (destPublicClient) {
          const quotes = await destPublicClient.readContract({
            address: destConfig.icaBridgeRoute as `0x${string}`,
            abi: warpRouteAbi,
            functionName: 'quoteTransferRemote',
            args: [originConfig.domainId, recipientBytes32, amount],
          });
          for (const q of quotes) {
            bridgeMsgValue += q.amount;
          }
        }

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [destConfig.icaBridgeRoute as `0x${string}`, amount],
        });

        const transferRemoteData = encodeFunctionData({
          abi: warpRouteAbi,
          functionName: 'transferRemote',
          args: [originConfig.domainId, recipientBytes32, amount],
        });

        let icaGasPayment = 0n;
        if (publicClient) {
          icaGasPayment = await publicClient.readContract({
            address: originConfig.icaRouter as `0x${string}`,
            abi: icaRouterAbi,
            functionName: 'quoteGasPayment',
            args: [destConfig.domainId],
          });
        }

        const callRemoteData = encodeFunctionData({
          abi: icaRouterAbi,
          functionName: 'callRemote',
          args: [
            destConfig.domainId,
            [
              { to: params.token as `0x${string}`, value: 0n, data: approveData },
              {
                to: destConfig.icaBridgeRoute as `0x${string}`,
                value: bridgeMsgValue,
                data: transferRemoteData,
              },
            ],
          ],
        });

        const totalValue = icaGasPayment + bridgeMsgValue;

        setStatus('signing');
        const hash = await params.signer.sendTransaction({
          account,
          to: originConfig.icaRouter as `0x${string}`,
          data: callRemoteData,
          value: totalValue,
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
    [publicClient, destPublicClient, originConfig, destConfig],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return { status, error, txHash, sendFromIca, reset };
}
