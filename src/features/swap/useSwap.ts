import {
  EvmTokenAdapter,
  HyperlaneCore,
  ProviderType,
  SealevelCoreAdapter,
  type TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';
import { isZeroishAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { useCallback, useState } from 'react';
import type { Address } from 'viem';

import { logger } from '../../utils/logger';
import type { RouteTx } from '../api/types';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { submitToRelayApi } from '../transfer/relayApi';
import { postCommitment } from './ccs';
import { SwapStatus } from './types';
import type { AugmentedRoute, LabeledMsgId, SolanaRevealData } from './types';

interface ExecuteArgs {
  transactionId: string;
  route: AugmentedRoute;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  sender: string;
  recipient: string;
  /** UR address to approve. Skips approval flow if absent or `isNative`. */
  spender?: Address;
  /** Amount to approve. Same as `amountAtomic` derived from the quote. */
  approvalAmount?: bigint;
  /** Native source skips approval entirely. */
  isNative?: boolean;
}

// Single execution path covering EVM + Tron via the SDK's protocol-aware
// transaction adapters.
export function useSwap() {
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const chainAddresses = useStore((s) => s.chainAddresses);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (args: ExecuteArgs) => {
      setError(null);
      setIsPending(true);

      const { transactionId, route, srcChainId } = args;

      if (!route.raw.tx) throw new Error('Route has no tx');

      const srcChainName = multiProvider.tryGetChainName(srcChainId);
      const protocol = multiProvider.tryGetProtocol(srcChainId);
      if (!srcChainName || !protocol) {
        throw new Error(`No SDK metadata for chain ${srcChainId} — boot may not have completed.`);
      }

      const fns = transactionFns[protocol as keyof typeof transactionFns];
      if (!fns) throw new Error(`No transaction handler for protocol ${protocol}`);

      const isSealevel = protocol === ProtocolType.Sealevel;
      const txType = isSealevel
        ? ProviderType.SolanaWeb3
        : protocol === ProtocolType.Tron
          ? ProviderType.Tron
          : ProviderType.EthersV5;

      try {
        if (fns.switchNetwork) {
          try {
            await fns.switchNetwork(srcChainName);
          } catch (err) {
            logger.warn(`switchNetwork to ${srcChainName} failed; continuing`, err as Error);
          }
        }

        // ERC20 approval only applies to EVM source chains. Solana uses SPL
        // token program delegates handled by the UR program itself.
        if (!isSealevel && args.spender && args.approvalAmount != null && !args.isNative) {
          const spender = args.spender;
          if (isZeroishAddress(spender)) {
            throw new Error(`Cannot approve: spender is zero address on ${srcChainName}`);
          }
          const adapter = new EvmTokenAdapter(srcChainName, multiProvider, {
            token: args.srcToken,
          });
          const [needsApprove, needsRevoke] = await Promise.all([
            adapter.isApproveRequired(args.sender, spender, args.approvalAmount.toString()),
            adapter.isRevokeApprovalRequired(args.sender, spender),
          ]);
          const doApprove = async (amount: bigint) => {
            updateSwapTransactionStatus(transactionId, SwapStatus.SigningApprove);
            const populated = await adapter.populateApproveTx({
              weiAmountOrId: amount.toString(),
              recipient: spender,
            });
            const { hash, confirm } = await fns.sendTransaction({
              tx: {
                type: txType,
                transaction: { to: populated.to!, data: populated.data!, value: '0' },
                category: 'transfer',
              } as Parameters<typeof fns.sendTransaction>[0]['tx'],
              chainName: srcChainName,
            });
            updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmingApprove);
            const receipt = await confirm();
            if (isReverted(receipt)) {
              logger.error('Approve tx reverted', new Error(`tx=${hash}`));
              throw new Error('Approve transaction reverted on chain');
            }
          };
          if (needsApprove && needsRevoke) await doApprove(0n);
          if (needsApprove) await doApprove(args.approvalAmount);
        }

        // Post EVM CCS commitment before signing origin tx. Solana CCS not yet supported
        // (reveal is handled manually via the reveal modal).
        if (route.raw.callCommitment && !route.raw.solanaCommitment) {
          await postCommitment(route.raw.callCommitment);
        }

        updateSwapTransactionStatus(transactionId, SwapStatus.SigningSwap);
        const rpcUrl = multiProvider.getChainMetadata(srcChainName).rpcUrls[0].http;
        const txPayload = isSealevel
          ? await buildSolanaTransaction(route.raw.tx, args.sender, rpcUrl)
          : { to: route.raw.tx.to, data: route.raw.tx.data, value: route.raw.tx.value };
        const { hash, confirm } = await fns.sendTransaction({
          tx: {
            type: txType,
            transaction: txPayload,
            category: 'transfer',
          } as Parameters<typeof fns.sendTransaction>[0]['tx'],
          chainName: srcChainName,
        });

        updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmingOrigin, {
          originTxHash: hash,
        });

        const receipt = await confirm();
        if (isReverted(receipt)) {
          logger.error('Origin tx reverted', new Error(`tx=${hash}`));
          updateSwapTransactionStatus(transactionId, SwapStatus.Failed, { originTxHash: hash });
          const err = new Error('Origin transaction reverted on chain');
          setError(err);
          throw err;
        }
        const parsed = parseReceipt(receipt);
        const expectsBridge = route.raw.steps.some((s) => s.type === 'bridge');
        // For Solana source, the Dispatch log is on the Solana side — parseReceipt
        // only handles EVM receipts, so skip the log check for Sealevel.
        if (!isSealevel && expectsBridge && !parsed.messages.length) {
          logger.error('Origin tx confirmed but no Dispatch log emitted', new Error(`tx=${hash}`));
          updateSwapTransactionStatus(transactionId, SwapStatus.Failed, {
            originTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          const err = new Error(
            'Origin transaction did not emit a Hyperlane Dispatch — it likely reverted internally',
          );
          setError(err);
          throw err;
        }
        // Same-chain swap (no bridge step): finalize on origin confirm.
        if (!expectsBridge) {
          updateSwapTransactionStatus(transactionId, SwapStatus.ConfirmedDestination, {
            originTxHash: hash,
            destinationTxHash: hash,
            originBlockNumber: parsed.originBlockNumber,
          });
          return hash;
        }
        submitToRelayApi(srcChainName, hash, protocol as ProtocolType, receipt);

        // For Sealevel source, parse dispatched message IDs from the Solana tx.
        // EVM receipts are already parsed via parseReceipt above.
        let msgIds: LabeledMsgId[];
        if (isSealevel) {
          const mailbox = chainAddresses[srcChainName]?.mailbox;
          if (mailbox) {
            try {
              const adapter = new SealevelCoreAdapter(srcChainName, multiProvider, { mailbox });
              const msgs = await adapter.extractMessageIds(receipt);
              msgIds = msgs.map(({ messageId }) => ({
                msgId: messageId as `0x${string}`,
                label: 'warp' as const,
              }));
            } catch (err) {
              logger.warn('Failed to extract Solana message IDs', err as Error);
              msgIds = [];
            }
          } else {
            logger.warn('No mailbox address for Solana source chain', new Error(srcChainName));
            msgIds = [];
          }
        } else {
          msgIds = labelMessages(parsed.messages, route);
        }

        const solanaReveal = buildSolanaRevealData(route, args.srcChainId, args.sender);
        updateSwapTransactionStatus(transactionId, SwapStatus.Bridging, {
          msgIds,
          originBlockNumber: parsed.originBlockNumber,
          solanaReveal,
        });

        return hash;
      } catch (err) {
        logger.error('Swap broadcast failed', err);
        updateSwapTransactionStatus(transactionId, SwapStatus.Failed);
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [transactionFns, multiProvider, updateSwapTransactionStatus, chainAddresses],
  );

  return { execute, isPending, error };
}

function isReverted(receipt: TypedTransactionReceipt): boolean {
  // Tron receipts wrap an ethers v5 receipt (same `status` shape) — treat
  // them identically to EVM for the revert check.
  if (
    receipt.type !== ProviderType.Viem &&
    receipt.type !== ProviderType.EthersV5 &&
    receipt.type !== ProviderType.Tron
  ) {
    return false;
  }
  const status = (receipt.receipt as { status?: string | number }).status;
  if (typeof status === 'string') return status === 'reverted';
  if (typeof status === 'number') return status === 0;
  return false;
}

interface ParsedMessage {
  msgId: `0x${string}`;
  sender: `0x${string}`;
  body: string;
}

function parseReceipt(receipt: TypedTransactionReceipt): {
  messages: ParsedMessage[];
  originBlockNumber: number | undefined;
} {
  // Tron is EVM-like — emits Hyperlane Dispatch logs in the same shape.
  if (
    receipt.type !== ProviderType.Viem &&
    receipt.type !== ProviderType.EthersV5 &&
    receipt.type !== ProviderType.Tron
  ) {
    return { messages: [], originBlockNumber: undefined };
  }
  const rawReceipt = receipt.receipt as Parameters<
    typeof HyperlaneCore.getDispatchedMessages
  >[0] & {
    blockNumber?: bigint | number;
  };
  const dispatched = HyperlaneCore.getDispatchedMessages(rawReceipt);
  const messages = dispatched.map((m) => ({
    msgId: m.id as `0x${string}`,
    sender: m.parsed.sender as `0x${string}`,
    body: m.parsed.body,
  }));
  const blockNumber = rawReceipt.blockNumber;
  return {
    messages,
    originBlockNumber: blockNumber != null ? Number(blockNumber) : undefined,
  };
}

function labelMessages(messages: ParsedMessage[], route: AugmentedRoute): LabeledMsgId[] {
  // Dispatch sender is bytes32 (padded EVM address). Strip leading zeros to get the 20-byte address.
  const addrOf = (sender: string) => sender.replace(/^0x/i, '').toLowerCase().slice(-40);

  const bridgeRouterAddrs = new Set(
    route.raw.steps
      .filter(
        (s): s is Extract<(typeof route.raw.steps)[number], { type: 'bridge' }> =>
          s.type === 'bridge',
      )
      .map((s) => s.router.replace(/^0x/i, '').toLowerCase()),
  );
  // For EVM→Solana CCS routes, the EVM UR (tx.to) sends the commit message directly.
  const urAddr = route.raw.tx?.to?.replace(/^0x/i, '').toLowerCase();

  return messages.map((msg) => {
    const senderAddr = addrOf(msg.sender);

    if (bridgeRouterAddrs.has(senderAddr)) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }

    if (route.raw.solanaCommitment && urAddr && senderAddr === urAddr) {
      return { msgId: msg.msgId, label: 'commit' as const };
    }

    const ccsLabel = getCcsMessageLabel(msg.body);
    if (ccsLabel) return { msgId: msg.msgId, label: ccsLabel };

    logger.warn('Unexpected swap message shape; labeling as warp', {
      msgId: msg.msgId,
      sender: msg.sender,
    });
    return { msgId: msg.msgId, label: 'warp' as const };
  });
}

function buildSolanaRevealData(
  route: AugmentedRoute,
  srcChainId: number,
  sender: string,
): SolanaRevealData | undefined {
  const sc = route.raw.solanaCommitment;
  if (!sc || !route.raw.tx?.to) return undefined;
  const swapStep = route.raw.steps.find(
    (s): s is Extract<(typeof route.raw.steps)[number], { type: 'swap' }> =>
      s.type === 'swap' && s.chain === sc.ccs.body.destinationDomain,
  );
  if (!swapStep) return undefined;
  return {
    commitment: sc.commitment as `0x${string}`,
    calldata: sc.ccs.body.calldata as `0x${string}`,
    revealSalt: sc.ccs.body.revealSalt as `0x${string}` | undefined,
    srcChainId,
    evmUr: route.raw.tx.to.replace(/^0x/i, '').toLowerCase(),
    evmSender: sender,
    tokenIn: swapStep.tokenIn,
    tokenOut: swapStep.tokenOut,
    amountIn: swapStep.amountIn,
  };
}

function getCcsMessageLabel(body: string): LabeledMsgId['label'] | null {
  // CCS message bodies use the first byte as the message type.
  if (body.startsWith('0x01')) return 'commit';
  if (body.startsWith('0x02')) return 'reveal';
  return null;
}

async function buildSolanaTransaction(
  tx: RouteTx,
  sender: string,
  rpcUrl: string,
): Promise<VersionedTransaction> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const programId = new PublicKey(tx.to);
  const data = Buffer.from(tx.data, 'base64');
  const keys = (tx.accounts ?? []).map((a) => ({
    pubkey: new PublicKey(a.pubkey),
    isSigner: a.isSigner,
    isWritable: a.isWritable,
  }));
  const instruction = new TransactionInstruction({ programId, data, keys });

  // Convert pre-instructions (compute budget, idempotent ATA creates) from the
  // engine response into TransactionInstruction objects to prepend.
  const preInstructions = (tx.preInstructions ?? []).map(
    (pi) =>
      new TransactionInstruction({
        programId: new PublicKey(pi.programId),
        keys: pi.accounts.map((a) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })),
        data: Buffer.from(pi.data, 'base64'),
      }),
  );

  // Fetch blockhash and ALTs in parallel.
  const [{ blockhash }, altAccounts] = await Promise.all([
    connection.getLatestBlockhash(),
    loadAltAccounts(connection, tx.altAddresses ?? []),
  ]);

  // V0 VersionedTransaction: compiles to a versioned message that references
  // ALT accounts by 1-byte index instead of 32-byte pubkey, keeping cross-chain
  // transactions under the 1232-byte wire limit.
  const message = new TransactionMessage({
    payerKey: new PublicKey(sender),
    recentBlockhash: blockhash,
    instructions: [...preInstructions, instruction],
  }).compileToV0Message(altAccounts);

  const txn = new VersionedTransaction(message);

  // Partial-sign with ephemeral keypairs (unique Hyperlane message accounts).
  // Each is a base64-encoded 64-byte Solana keypair (privKey[32] || pubKey[32]).
  if (tx.additionalSigners && tx.additionalSigners.length > 0) {
    const keypairs = tx.additionalSigners.map((b64) =>
      Keypair.fromSecretKey(new Uint8Array(Buffer.from(b64, 'base64'))),
    );
    txn.sign(keypairs);
  }

  return txn;
}

async function loadAltAccounts(
  connection: Connection,
  altAddresses: string[],
): Promise<AddressLookupTableAccount[]> {
  if (altAddresses.length === 0) return [];
  const results = await Promise.all(
    altAddresses.map((addr) => connection.getAddressLookupTable(new PublicKey(addr))),
  );
  const accounts: AddressLookupTableAccount[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (!r.value) {
      throw new Error(
        `Address Lookup Table not found: ${altAddresses[i]}. ` +
          'Ensure the ALT is deployed and activated on this network.',
      );
    }
    accounts.push(r.value);
  }
  return accounts;
}
