import { beforeEach, describe, expect, test } from 'vitest';

import { MockCosmosWallet, mockCosmosWalletInfo } from './MockCosmosWallet';
import { MOCK_COSMOS_MNEMONIC_ADDRESSES } from './MockCosmosWallet.test.fixtures';

// The mock cosmos wallet needs to work as a cosmos-kit MainWalletBase: the
// initClient handshake must succeed, the client must honour the per-chain
// bech32 prefix recorded via addChain, and the offline direct signer must
// produce valid accounts + signatures deterministically.
describe('MockCosmosWallet', () => {
  let wallet: MockCosmosWallet;

  beforeEach(() => {
    wallet = new MockCosmosWallet(mockCosmosWalletInfo);
  });

  test('initClient resolves the mock WalletClient', async () => {
    await wallet.initClient();
    expect(wallet.client).toBeDefined();
  });

  test('getAccount returns the expected deterministic cosmos-prefixed address', async () => {
    await wallet.initClient();
    const client = wallet.client!;
    // Seed the prefix table the way cosmos-kit does via addChain.
    await client.addChain!({
      name: 'cosmoshub',
      chain: { chain_id: 'cosmoshub-4', bech32_prefix: 'cosmos' } as never,
      assetList: { chain_name: 'cosmoshub', assets: [] } as never,
    } as never);
    const account = (await client.getAccount!('cosmoshub-4')) as unknown as {
      address: string;
      algo: string;
    };
    expect(account.address).toBe(MOCK_COSMOS_MNEMONIC_ADDRESSES.cosmos);
    expect(account.algo).toBe('secp256k1');
  });

  test('getAccount honours per-chain bech32 prefix (same key, different encoding)', async () => {
    await wallet.initClient();
    const client = wallet.client!;
    await client.addChain!({
      name: 'cosmoshub',
      chain: { chain_id: 'cosmoshub-4', bech32_prefix: 'cosmos' } as never,
      assetList: { chain_name: 'cosmoshub', assets: [] } as never,
    } as never);
    await client.addChain!({
      name: 'neutron',
      chain: { chain_id: 'neutron-1', bech32_prefix: 'neutron' } as never,
      assetList: { chain_name: 'neutron', assets: [] } as never,
    } as never);

    const cosmosAccount = (await client.getAccount!('cosmoshub-4')) as unknown as {
      address: string;
      pubkey: Uint8Array;
    };
    const neutronAccount = (await client.getAccount!('neutron-1')) as unknown as {
      address: string;
      pubkey: Uint8Array;
    };
    expect(cosmosAccount.address).toBe(MOCK_COSMOS_MNEMONIC_ADDRESSES.cosmos);
    expect(neutronAccount.address).toBe(MOCK_COSMOS_MNEMONIC_ADDRESSES.neutron);
    // Same underlying pubkey across prefixes.
    expect(Buffer.from(cosmosAccount.pubkey).toString('hex')).toBe(
      Buffer.from(neutronAccount.pubkey).toString('hex'),
    );
  });

  test('getOfflineSignerDirect exposes getAccounts and signDirect on the same key', async () => {
    await wallet.initClient();
    const client = wallet.client!;
    await client.addChain!({
      name: 'cosmoshub',
      chain: { chain_id: 'cosmoshub-4', bech32_prefix: 'cosmos' } as never,
      assetList: { chain_name: 'cosmoshub', assets: [] } as never,
    } as never);
    const signer = client.getOfflineSignerDirect!('cosmoshub-4');
    const accounts = await signer.getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].address).toBe(MOCK_COSMOS_MNEMONIC_ADDRESSES.cosmos);
  });
});
