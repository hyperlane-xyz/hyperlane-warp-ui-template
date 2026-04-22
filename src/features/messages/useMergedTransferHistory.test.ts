import { MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';
import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { ChainMap } from '@hyperlane-xyz/sdk/types';
import { ProtocolType, normalizeAddress } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { createMockToken } from '../../utils/test';
import type { RouterAddressInfo } from '../store';
import { MessageStatus, type MessageStub } from './types';
import { messageToTransferContext } from './useMergedTransferHistory';

const TEST_CHAIN_METADATA: ChainMap<ChainMetadata<{ mailbox?: string }>> = {
  ethereum: {
    name: 'ethereum',
    chainId: 1,
    domainId: 1,
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'http://localhost:8545' }],
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    domainId: 42161,
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'http://localhost:8546' }],
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};

describe('messageToTransferContext', () => {
  test('uses the concrete route token when same-symbol tokens share a chain', () => {
    const matchingRouteToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      decimals: 6,
      addressOrDenom: '0x00000000000000000000000000000000000000a1',
    });
    const wrongRouteToken = createMockToken({
      chainName: 'ethereum',
      symbol: 'USDC',
      decimals: 18,
      addressOrDenom: '0x00000000000000000000000000000000000000b2',
    });
    const multiProvider = new MultiProtocolProvider(TEST_CHAIN_METADATA);
    const warpCore = new WarpCore(multiProvider, [wrongRouteToken, matchingRouteToken]);
    const msg: MessageStub = {
      status: MessageStatus.Delivered,
      id: 'db-id',
      msgId: 'msg-id',
      nonce: 1,
      sender: matchingRouteToken.addressOrDenom,
      recipient: '0x00000000000000000000000000000000000000c3',
      originChainId: 1,
      originDomainId: 1,
      destinationChainId: 42161,
      destinationDomainId: 42161,
      origin: {
        timestamp: 123,
        hash: '0x0000000000000000000000000000000000000000000000000000000000000123',
        from: '0x0000000000000000000000000000000000000f01',
        to: '0x0000000000000000000000000000000000000f02',
      },
      warpTransfer: {
        recipient: '0x0000000000000000000000000000000000000f03',
        amount: '1000000',
      },
    };
    // Key format must match production: messageToTransferContext uses
    // `normalizeAddress(sender, protocol)` (EIP-55 checksummed for EVM), not
    // `.toLowerCase()`. Use wireDecimals that DIFFERS from token.decimals so
    // the test can distinguish the router-info path from the token fallback.
    const normalizedRouter = normalizeAddress(matchingRouteToken.addressOrDenom);
    const routerAddressesByChainMap: Record<string, Record<string, RouterAddressInfo>> = {
      ethereum: {
        [normalizedRouter]: { wireDecimals: 9 },
      },
    };

    const result = messageToTransferContext(
      msg,
      multiProvider,
      warpCore,
      routerAddressesByChainMap,
    );

    expect(result.origin).toBe('ethereum');
    expect(result.destination).toBe('arbitrum');
    // 1_000_000 wire units with wireDecimals=9 → "0.001". If the router-info
    // lookup failed and we fell back to token.decimals=6, this would be "1".
    expect(result.amount).toBe('0.001');
    expect(result.originTokenAddressOrDenom).toBe(matchingRouteToken.addressOrDenom);
    expect(result.destTokenAddressOrDenom).toBe(msg.recipient);
  });
});
