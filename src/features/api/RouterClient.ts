// Ported from universal-router-engine/src/api/client.ts.
import { config } from '../../consts/config';
import {
  ChainsResponseSchema,
  HealthResponseSchema,
  QuoteResponseSchema,
  ReadinessResponseSchema,
  TokensResponseSchema,
  type ChainsResponse,
  type QuoteResponse,
  type ReadinessResponse,
  type TokensQuery,
  type TokensResponse,
} from './types';

export interface QuoteParams {
  srcChain: number;
  dstChain: number;
  srcToken: string;
  dstToken: string;
  amount: bigint;
  sender: string;
  recipient?: string;
  slippageBps?: number;
  /** Optional client-supplied salt; engine generates one if absent. */
  commitmentSalt?: `0x${string}`;
}

export class RouterClient {
  constructor(private baseUrl: string) {}

  async health(): Promise<boolean> {
    try {
      const body = await this.get('/health', HealthResponseSchema);
      return body.ok;
    } catch {
      return false;
    }
  }

  readiness(): Promise<ReadinessResponse> {
    return this.get('/readyz', ReadinessResponseSchema);
  }

  chains(): Promise<ChainsResponse> {
    return this.get('/v1/chains', ChainsResponseSchema);
  }

  // Branching matches engine TokensQuerySchema:
  //   {}              → featured list
  //   { chain }       → per-chain list
  //   { chain, search}→ per-chain filtered
  //   { search }      → cross-chain search
  //   { ids }         → explicit lookups (repeated &ids=, max 5)
  // ?ids is mutually exclusive with chain/search.
  tokens(query: TokensQuery = {}): Promise<TokensResponse> {
    const params = new URLSearchParams();
    if (query.ids?.length) {
      for (const id of query.ids) params.append('ids', id);
    } else {
      if (query.chain != null) params.set('chain', String(query.chain));
      if (query.search) params.set('search', query.search);
    }
    const qs = params.toString();
    return this.get(`/v1/tokens${qs ? `?${qs}` : ''}`, TokensResponseSchema);
  }

  async quote(params: QuoteParams): Promise<QuoteResponse> {
    const res = await fetch(`${this.baseUrl}/v1/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcChain: params.srcChain,
        dstChain: params.dstChain,
        srcToken: params.srcToken,
        dstToken: params.dstToken,
        amount: params.amount.toString(),
        sender: params.sender,
        ...(params.recipient && { recipient: params.recipient }),
        ...(params.slippageBps != null && { slippageBps: params.slippageBps }),
        ...(params.commitmentSalt && { commitmentSalt: params.commitmentSalt }),
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Quote failed: ${res.status} ${body}`);
    return QuoteResponseSchema.parse(JSON.parse(body));
  }

  private async get<T>(path: string, schema: { parse(value: unknown): T }): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    const body = await res.text();
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${body}`);
    return schema.parse(JSON.parse(body));
  }
}

// Singleton — keep the same client across hooks/queries.
export const routerClient = new RouterClient(config.routerApiUrl);
