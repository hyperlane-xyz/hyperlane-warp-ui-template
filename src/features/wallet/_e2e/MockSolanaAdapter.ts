import {
  BaseMessageSignerWalletAdapter,
  WalletReadyState,
  type SendTransactionOptions,
  type WalletName,
} from '@solana/wallet-adapter-base';
import type {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import { pushSolanaTx } from './windowState';

// Fixed-seed keypair. Derived lazily inside the class constructor so that
// merely importing this module (e.g. during tree-shake analysis or from
// bundles that include cosmos-kit chain plumbing) doesn't run ed25519 key
// derivation on prod page loads.
const FIXED_SEED = new Uint8Array(32).fill(0xe2);

const MOCK_SIGNATURE = 'e2e' + '1'.repeat(85);

export class MockSolanaAdapter extends BaseMessageSignerWalletAdapter {
  name = 'WarpE2EMock' as WalletName<'WarpE2EMock'>;
  url = 'https://hyperlane.xyz';
  // Minimal 1x1 transparent PNG data URI.
  icon =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';
  readyState = WalletReadyState.Installed;
  publicKey: PublicKey | null = null;
  connecting = false;
  supportedTransactionVersions = new Set([0, 'legacy'] as const);

  async connect(): Promise<void> {
    // BaseWalletAdapter.connected is derived from !!this.publicKey, so we
    // must leave publicKey null until connect() runs. Otherwise every
    // subsequent connect() short-circuits via `if (this.connected) return;`
    // without ever firing the 'connect' event, so wallet-adapter-react's
    // internal publicKey state stays null and useSolanaAccount hands back
    // an empty addresses array.
    if (this.connected) return;
    this.connecting = true;
    this.publicKey = Keypair.fromSeed(FIXED_SEED).publicKey;
    (this as unknown as { emit: (event: string, payload?: unknown) => void }).emit(
      'connect',
      this.publicKey,
    );
    this.connecting = false;
  }

  async disconnect(): Promise<void> {
    this.publicKey = null;
    (this as unknown as { emit: (event: string, payload?: unknown) => void }).emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    captureTx(transaction);
    return transaction;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // Return a deterministic 64-byte "signature".
    const out = new Uint8Array(64);
    for (let i = 0; i < 64; i++) out[i] = (message[i % message.length] ^ 0xe2) & 0xff;
    return out;
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    _connection: Connection,
    _options?: SendTransactionOptions,
  ): Promise<TransactionSignature> {
    captureTx(transaction);
    return MOCK_SIGNATURE;
  }
}

function captureTx(transaction: Transaction | VersionedTransaction): void {
  try {
    const bytes =
      'serialize' in transaction
        ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        : new Uint8Array();
    const serializedBase64 = bufferToBase64(bytes);
    let programIds: string[] = [];
    let feePayer: string | undefined;
    if ('message' in transaction && transaction.message) {
      const msg = transaction.message;
      feePayer = msg.staticAccountKeys?.[0]?.toBase58();
      programIds = msg.compiledInstructions.map((ix) =>
        msg.staticAccountKeys[ix.programIdIndex].toBase58(),
      );
    } else if ('instructions' in transaction) {
      feePayer = transaction.feePayer?.toBase58();
      programIds = transaction.instructions.map((ix) => ix.programId.toBase58());
    }
    pushSolanaTx({ feePayer, serializedBase64, programIds });
  } catch {
    // Best-effort capture; don't break the signer on serialization issues.
  }
}

function bufferToBase64(buf: Uint8Array): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return window.btoa(bin);
  }
  return '';
}
