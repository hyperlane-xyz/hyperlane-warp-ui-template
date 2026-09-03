import {
  Adapter,
  AdapterState,
  WalletReadyState,
  type AdapterName,
  type SignedTransaction,
  type Transaction,
} from '@tronweb3/tronwallet-abstract-adapter';

// Fixed base58 address for deterministic E2E. Not a real address; the adapter
// never broadcasts. Tron base58 addresses start with "T" and are 34 chars.
export const MOCK_TRON_ADDRESS = 'TE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2E';

export class MockTronAdapter extends Adapter<'WarpE2EMockTron'> {
  name = 'WarpE2EMockTron' as AdapterName<'WarpE2EMockTron'>;
  url = 'https://hyperlane.xyz';
  icon = '';
  readyState = WalletReadyState.Found;
  state = AdapterState.Disconnect;
  address: string | null = null;
  connecting = false;

  get connected(): boolean {
    return this.state === AdapterState.Connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connecting = true;
    this.address = MOCK_TRON_ADDRESS;
    this.state = AdapterState.Connected;
    this.connecting = false;
    (this as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'connect',
      MOCK_TRON_ADDRESS,
    );
    (this as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'stateChanged',
      AdapterState.Connected,
    );
  }

  async disconnect(): Promise<void> {
    this.address = null;
    this.state = AdapterState.Disconnect;
    (this as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit('disconnect');
    (this as unknown as { emit: (event: string, ...args: unknown[]) => void }).emit(
      'stateChanged',
      AdapterState.Disconnect,
    );
  }

  async signMessage(message: string): Promise<string> {
    // Deterministic hex-like stub; not a valid signature, but tests that
    // reach this path would need to assert captured message, not validate sig.
    return '0x' + Buffer.from(message).toString('hex').padEnd(130, '0').slice(0, 130);
  }

  async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
    // Echo back with a fake signature array.
    return {
      ...(transaction as SignedTransaction),
      signature: ['0x' + 'e2'.repeat(32)],
    };
  }

  async switchChain(_chainId: string): Promise<void> {
    // No-op for mock.
  }
}
