import { DirectSecp256k1HdWallet, type OfflineDirectSigner } from '@cosmjs/proto-signing';
import {
  ChainWalletBase,
  MainWalletBase,
  type ChainRecord,
  type SimpleAccount,
  type Wallet,
  type WalletAccount,
  type WalletClient,
} from '@cosmos-kit/core';

import { pushCosmosTx } from './windowState';

// Well-known BIP39 test vector. Not a production key, no funds on it — safe to
// hard-code. Any fixture change here will shift the derived address, so update
// MOCK_COSMOS_ADDRESS in ../constants.ts alongside it.
const FIXED_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Minimal 1x1 transparent PNG for cosmos-kit's wallet-list icon slot.
const TRANSPARENT_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

export const mockCosmosWalletInfo: Wallet = {
  name: 'warp-e2e-mock-cosmos',
  prettyName: 'Warp E2E Mock (Cosmos)',
  logo: TRANSPARENT_ICON,
  mode: 'extension',
  mobileDisabled: true,
  rejectMessage: { source: 'Request rejected' },
  connectEventNamesOnWindow: [],
  downloads: [],
};

class MockCosmosClient implements WalletClient {
  // chainId → bech32 prefix, populated as cosmos-kit discovers chains.
  private prefixByChainId = new Map<string, string>();
  // Per-prefix signer cache. Instance-scoped so multiple MockCosmosWallet
  // instances (e.g. across unit tests) stay isolated.
  private signerCache = new Map<string, Promise<DirectSecp256k1HdWallet>>();

  private getSignerFor(prefix: string): Promise<DirectSecp256k1HdWallet> {
    const cached = this.signerCache.get(prefix);
    if (cached) return cached;
    const fresh = DirectSecp256k1HdWallet.fromMnemonic(FIXED_MNEMONIC, { prefix });
    this.signerCache.set(prefix, fresh);
    return fresh;
  }

  async enable(_chainIds: string | string[]): Promise<void> {
    // No-op — the mock is always "connected".
  }

  async disconnect(): Promise<void> {
    // No-op.
  }

  async addChain(chainInfo: ChainRecord): Promise<void> {
    const chain = chainInfo.chain;
    if (chain?.chain_id && chain?.bech32_prefix) {
      this.prefixByChainId.set(chain.chain_id, chain.bech32_prefix);
    }
  }

  async getSimpleAccount(chainId: string): Promise<SimpleAccount> {
    const account = await this.getAccount(chainId);
    // Cast through unknown — cosmos-kit's WalletAccount references an
    // AccountData declared from a different @cosmjs/amino version than the one
    // `signer.getAccounts()` resolves against, so TS sees the shapes as
    // distinct even though they're structurally compatible at runtime.
    return {
      namespace: 'cosmos',
      chainId,
      address: (account as unknown as { address: string }).address,
    };
  }

  async getAccount(chainId: string): Promise<WalletAccount> {
    const prefix = this.prefixByChainId.get(chainId);
    // Throwing when the prefix isn't yet recorded forces cosmos-kit's
    // chain-wallet update() loop into its addChain fallback — otherwise it
    // happily hands back a cosmos-prefixed address for every chainId.
    if (!prefix) throw new Error(`No bech32 prefix recorded for ${chainId}`);
    const signer = await this.getSignerFor(prefix);
    const [first] = await signer.getAccounts();
    return {
      address: first.address,
      pubkey: first.pubkey,
      algo: 'secp256k1',
      username: 'warp-e2e-mock',
    } as unknown as WalletAccount;
  }

  getOfflineSigner(chainId: string): OfflineDirectSigner {
    return this.getOfflineSignerDirect(chainId);
  }

  getOfflineSignerDirect(chainId: string): OfflineDirectSigner {
    const prefix = this.prefixByChainId.get(chainId);
    if (!prefix) throw new Error(`No bech32 prefix recorded for ${chainId}`);
    // Build the signer lazily inside each method call so the top-level API
    // stays synchronous (cosmos-kit's WalletClient type requires it), while
    // still letting us await the async DirectSecp256k1HdWallet.fromMnemonic.
    return {
      getAccounts: async () => {
        const underlying = await this.getSignerFor(prefix);
        return underlying.getAccounts();
      },
      signDirect: async (signerAddress, signDoc) => {
        try {
          pushCosmosTx({
            chainId,
            signerAddress,
            typeUrls: [],
            messagesJson: JSON.stringify({
              accountNumber: signDoc.accountNumber?.toString(),
              chainId: signDoc.chainId,
            }),
          });
        } catch {
          /* capture is best-effort */
        }
        const underlying = await this.getSignerFor(prefix);
        return underlying.signDirect(signerAddress, signDoc);
      },
    };
  }
}

class MockCosmosChainWallet extends ChainWalletBase {
  constructor(walletInfo: Wallet, chainInfo: ChainRecord) {
    super(walletInfo, chainInfo);
  }
}

export class MockCosmosWallet extends MainWalletBase {
  constructor(walletInfo: Wallet = mockCosmosWalletInfo) {
    super(walletInfo, MockCosmosChainWallet);
  }

  async initClient(): Promise<void> {
    this.initingClient();
    try {
      this.initClientDone(new MockCosmosClient());
    } catch (err) {
      this.initClientError(err as Error);
    }
  }
}
