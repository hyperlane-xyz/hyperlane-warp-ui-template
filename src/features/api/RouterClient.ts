// Ported from universal-router-engine/src/api/client.ts.
import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import {
  ChainsResponseSchema,
  AvailableRoutesResponseSchema,
  HealthResponseSchema,
  MaxQuoteResponseSchema,
  QuoteResponseSchema,
  ReadinessResponseSchema,
  TokensResponseSchema,
  type AvailableRoutesResponse,
  type ChainsResponse,
  type MaxQuoteResponse,
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

export interface MaxQuoteParams extends Omit<QuoteParams, 'amount'> {
  senderPubKey?: `0x${string}`;
}

export interface AvailableRoutesParams {
  srcChain?: string | number | null;
  srcToken?: string | null;
  dstChain?: string | number | null;
  dstToken?: string | null;
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_QUOTE_TIMEOUT_MS = 30_000;

export class RouterClient {
  constructor(private baseUrl: string) {}

  async health(options: RequestOptions = {}): Promise<boolean> {
    try {
      const body = await this.get('/health', HealthResponseSchema, options);
      return body.ok;
    } catch (err) {
      logger.warn('Router health check failed', err as Error);
      return false;
    }
  }

  readiness(options: RequestOptions = {}): Promise<ReadinessResponse> {
    return this.get('/readyz', ReadinessResponseSchema, options);
  }

  chains(options: RequestOptions = {}): Promise<ChainsResponse> {
    return this.get('/v1/chains', ChainsResponseSchema, options);
  }

  // Branching matches engine TokensQuerySchema:
  //   {}              → featured list
  //   { chain }       → per-chain list
  //   { chain, search}→ per-chain filtered
  //   { search }      → cross-chain search
  //   { ids }         → explicit lookups (repeated &ids=, max 5)
  // ?ids is mutually exclusive with chain/search.
  tokens(query: TokensQuery = {}, options: RequestOptions = {}): Promise<TokensResponse> {
    const params = new URLSearchParams();
    if (query.ids?.length) {
      for (const id of query.ids) params.append('ids', id);
    } else {
      if (query.chain != null) params.set('chain', String(query.chain));
      if (query.search) params.set('search', query.search);
    }
    const qs = params.toString();
    return this.get(`/v1/tokens${qs ? `?${qs}` : ''}`, TokensResponseSchema, options);
  }

  availableRoutes(
    params: AvailableRoutesParams,
    options: RequestOptions = {},
  ): Promise<AvailableRoutesResponse> {
    const search = new URLSearchParams();
    const { srcChain, srcToken, dstChain, dstToken } = params;
    const hasSource = srcChain != null && srcToken != null;
    const hasDestination = dstChain != null && dstToken != null;

    if ((srcChain != null) !== (srcToken != null)) {
      throw new Error('Available routes requires srcChain and srcToken together');
    }

    if ((dstChain != null) !== (dstToken != null)) {
      throw new Error('Available routes requires dstChain and dstToken together');
    }

    if (hasSource && hasDestination) {
      throw new Error('Available routes requires exactly one source or destination token');
    }

    if (!hasSource && !hasDestination) {
      throw new Error('Available routes requires exactly one source or destination token');
    }

    if (hasSource) {
      search.set('srcChain', String(srcChain));
      search.set('srcToken', srcToken);
    } else if (dstChain != null && dstToken != null) {
      search.set('dstChain', String(dstChain));
      search.set('dstToken', dstToken);
    }
    return this.get(
      `/v1/available-routes?${search.toString()}`,
      AvailableRoutesResponseSchema,
      options,
    );
  }

  async quote(params: QuoteParams, options: RequestOptions = {}): Promise<QuoteResponse> {
    return this.request(
      '/v1/quote',
      QuoteResponseSchema,
      {
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
      },
      options,
    );
  }

  async maxQuote(params: MaxQuoteParams, options: RequestOptions = {}): Promise<MaxQuoteResponse> {
    return this.request(
      '/v1/quote/max',
      MaxQuoteResponseSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srcChain: params.srcChain,
          dstChain: params.dstChain,
          srcToken: params.srcToken,
          dstToken: params.dstToken,
          sender: params.sender,
          ...(params.recipient && { recipient: params.recipient }),
          ...(params.slippageBps != null && { slippageBps: params.slippageBps }),
          ...(params.commitmentSalt && { commitmentSalt: params.commitmentSalt }),
          ...(params.senderPubKey && { senderPubKey: params.senderPubKey }),
        }),
      },
      { ...options, timeoutMs: options.timeoutMs ?? MAX_QUOTE_TIMEOUT_MS },
    );
  }

  private async get<T>(
    path: string,
    schema: { parse(value: unknown): T },
    options: RequestOptions,
  ): Promise<T> {
    return this.request(path, schema, {}, options);
  }

  private async request<T>(
    path: string,
    schema: { parse(value: unknown): T },
    init: RequestInit,
    options: RequestOptions,
  ): Promise<T> {
    const controller = new AbortController();
    const abortFromExternalSignal = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromExternalSignal();
    options.signal?.addEventListener('abort', abortFromExternalSignal, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error('Router request timed out')),
      options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    );
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${body}`);
      return schema.parse(JSON.parse(body));
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromExternalSignal);
    }
  }
}

// Singleton — keep the same client across hooks/queries.
export const routerClient = new RouterClient(config.routerApiUrl);
