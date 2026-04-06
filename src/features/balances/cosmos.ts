import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { StargateClient } from '@cosmjs/stargate';
import { HttpBatchClient, Tendermint37Client } from '@cosmjs/tendermint-rpc';
import { Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import { getTokenKey } from '../tokens/utils';
import { TokenEntry } from './tokens';

type CosmosTokenClassification = 'bank' | 'cw20' | 'unknown';

export interface CosmosChainGroup {
  chainName: string;
  /** Tokens queryable via bank module allBalances (native, IBC, CWNative denoms) */
  bankTokens: { key: string; denom: string }[];
  /** CW20 contract tokens that need individual queryContractSmart calls */
  cw20Tokens: { key: string; contractAddress: string }[];
  /** Tokens that don't fit either category — use SDK fallback */
  fallbackTokens: TokenEntry[];
}

function classifyCosmosToken(token: Token): {
  type: CosmosTokenClassification;
  denom?: string;
  contractAddress?: string;
} {
  switch (token.standard) {
    // Bank module tokens — denom is in addressOrDenom
    case TokenStandard.CosmosNative:
    case TokenStandard.CosmosIbc:
    case TokenStandard.CosmosIcs20:
    case TokenStandard.CWNative:
      return { type: 'bank', denom: token.addressOrDenom };

    // CW20 contract tokens — contract address in addressOrDenom
    case TokenStandard.CW20:
      return { type: 'cw20', contractAddress: token.addressOrDenom };

    // CwHyp tokens — collateral uses the underlying token's contract/denom
    case TokenStandard.CwHypCollateral:
      return token.collateralAddressOrDenom
        ? { type: 'cw20', contractAddress: token.collateralAddressOrDenom }
        : { type: 'unknown' };

    case TokenStandard.CwHypSynthetic:
      // Synthetic CW20 — the router itself is the token contract
      return { type: 'cw20', contractAddress: token.addressOrDenom };

    case TokenStandard.CwHypNative:
      // HypNative on CosmWasm — bank denom resolved from addressOrDenom
      return { type: 'bank', denom: token.addressOrDenom };

    // CosmosNative module Hyp tokens — use bank denom
    case TokenStandard.CosmNativeHypCollateral:
    case TokenStandard.CosmNativeHypSynthetic:
      return { type: 'unknown' }; // denom needs dynamic resolution, use SDK fallback

    default:
      return { type: 'unknown' };
  }
}

/** Group Cosmos/CosmosNative tokens by chain. */
export function groupCosmosTokensByChain(tokens: Token[]): Map<string, CosmosChainGroup> {
  const chainGroups = new Map<string, CosmosChainGroup>();

  for (const token of tokens) {
    if (token.protocol !== ProtocolType.Cosmos && token.protocol !== ProtocolType.CosmosNative)
      continue;

    const key = getTokenKey(token);
    const classification = classifyCosmosToken(token);

    if (!chainGroups.has(token.chainName)) {
      chainGroups.set(token.chainName, {
        chainName: token.chainName,
        bankTokens: [],
        cw20Tokens: [],
        fallbackTokens: [],
      });
    }
    const group = chainGroups.get(token.chainName)!;

    if (classification.type === 'bank' && classification.denom) {
      group.bankTokens.push({ key, denom: classification.denom });
    } else if (classification.type === 'cw20' && classification.contractAddress) {
      group.cw20Tokens.push({ key, contractAddress: classification.contractAddress });
    } else {
      group.fallbackTokens.push({ token, key });
    }
  }

  return chainGroups;
}

/**
 * Fetch all cosmos token balances for a single chain.
 * - Bank tokens: single `getAllBalances` call
 * - CW20 tokens: batched via `HttpBatchClient` into one HTTP request
 * - Fallback: SDK `token.getBalance()` per token
 */
export async function fetchCosmosChainBalances(
  group: CosmosChainGroup,
  rpcUrl: string,
  address: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  const promises: Promise<void>[] = [];

  // Phase 1: Bank module — getAllBalances
  if (group.bankTokens.length > 0) {
    promises.push(
      (async () => {
        try {
          const client = await StargateClient.connect(rpcUrl);
          const allCoins = await client.getAllBalances(address);
          const coinMap = new Map(allCoins.map((c) => [c.denom, BigInt(c.amount)]));
          for (const { key, denom } of group.bankTokens) {
            const balance = coinMap.get(denom);
            if (balance !== undefined) {
              out[key] = balance;
            }
          }
        } catch (err) {
          logger.warn(`Bank allBalances failed on ${group.chainName}`, err);
        }
      })(),
    );
  }

  // Phase 2: CW20 tokens — batch via HttpBatchClient
  if (group.cw20Tokens.length > 0) {
    promises.push(
      (async () => {
        try {
          const batchClient = new HttpBatchClient(rpcUrl, {
            batchSizeLimit: group.cw20Tokens.length,
            dispatchInterval: 100,
          });
          const tmClient = await Tendermint37Client.create(batchClient);
          const cwClient = await CosmWasmClient.create(tmClient);

          const cw20Promises = group.cw20Tokens.map(async ({ key, contractAddress }) => {
            try {
              const result = await cwClient.queryContractSmart(contractAddress, {
                balance: { address },
              });
              if (result?.balance) {
                out[key] = BigInt(result.balance);
              }
            } catch (err) {
              logger.warn(`CW20 balance query failed for ${contractAddress}`, err);
            }
          });

          await Promise.all(cw20Promises);
          tmClient.disconnect();
        } catch (err) {
          logger.warn(`CW20 batch client failed on ${group.chainName}`, err);
        }
      })(),
    );
  }

  await Promise.all(promises);
  return out;
}
