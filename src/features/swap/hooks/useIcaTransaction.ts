import { InterchainAccount } from '@hyperlane-xyz/sdk';
import { addressToBytes32 } from '@hyperlane-xyz/utils';
import { useCallback, useState } from 'react';
import { Hex, WalletClient, encodeFunctionData, isAddress, parseAbi, parseUnits } from 'viem';
import { usePublicClient } from 'wagmi';
import { getSwapConfig } from '../swapConfig';

type IcaTransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'complete' | 'failed';

const erc20Abi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);
const erc20BalanceAbi = parseAbi(['function balanceOf(address account) view returns (uint256)']);
const erc20TransferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const warpRouteAbi = parseAbi([
  'function transferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) payable returns (bytes32)',
  'function quoteTransferRemote(uint32 destinationDomain, bytes32 recipient, uint256 amount) view returns ((address token, uint256 amount)[] quotes)',
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
        if (!isAddress(params.recipient)) throw new Error('Invalid recipient address.');

        const amount = parseUnits(params.amount, params.decimals ?? 6);
        if (amount <= 0n) throw new Error('Amount must be greater than zero.');

        let innerCalls: Array<{ to: string; data: `0x${string}`; value: string }>;

        if (params.mode === 'return-origin') {
          if (!isAddress(destConfig.icaBridgeRoute)) {
            throw new Error('ICA bridge route not configured for destination chain.');
          }
          if (params.token.toLowerCase() !== destConfig.bridgeToken.toLowerCase()) {
            throw new Error(
              'Return to origin currently supports the canonical bridge token only. Select USDC on Base and retry.',
            );
          }
          if (!destinationPublicClient) {
            throw new Error('Fee quote failure: destination public client unavailable.');
          }

          const recipientBytes32 = addressToBytes32(params.recipient);

          let msgFee: bigint;
          let tokenPull = amount;
          try {
            const quotes = await destinationPublicClient.readContract({
              address: destConfig.icaBridgeRoute as `0x${string}`,
              abi: warpRouteAbi,
              functionName: 'quoteTransferRemote',
              args: [originConfig.domainId, recipientBytes32 as `0x${string}`, amount],
            });

            msgFee = 0n;
            const normalizedToken = params.token.toLowerCase();
            for (const quoteEntry of quotes) {
              const quoteToken = quoteEntry.token.toLowerCase();
              if (quoteToken === ZERO_ADDRESS) msgFee = quoteEntry.amount;
              if (quoteToken === normalizedToken) tokenPull = quoteEntry.amount;
            }
            if (tokenPull < amount) tokenPull = amount;
          } catch (error) {
            throw new Error('Fee quote failure while preparing ICA return transaction.');
          }

          const icaAddress = await icaApp.getAccount(destinationChainName, {
            origin: originChainName,
            owner: account,
          });
          if (!isAddress(icaAddress)) {
            throw new Error('Invalid ICA address while preparing return transaction.');
          }

          const icaNativeBalance = await destinationPublicClient.getBalance({
            address: icaAddress as `0x${string}`,
          });
          if (icaNativeBalance < msgFee) {
            throw new Error(
              `Insufficient ${destinationChainName} native balance in ICA to cover return fee. Fund ICA with gas token and retry.`,
            );
          }

          const icaTokenBalance = await destinationPublicClient.readContract({
            address: params.token as `0x${string}`,
            abi: erc20BalanceAbi,
            functionName: 'balanceOf',
            args: [icaAddress as `0x${string}`],
          });
          if (icaTokenBalance < tokenPull) {
            throw new Error(
              `Insufficient token balance in ICA for return. Required amount includes bridge token fee.`,
            );
          }

          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [destConfig.icaBridgeRoute as `0x${string}`, tokenPull],
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
          chain: null,
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
