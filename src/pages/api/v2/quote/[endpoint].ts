import {
  FeeQuotingNoQuoteAvailableError,
  FeeQuotingV2Client,
  NO_QUOTE_AVAILABLE_ERROR,
  QuoteV2Endpoint,
  type QuoteV2Response,
  type NoQuoteAvailableError as NoQuoteAvailableBody,
} from '@hyperlane-xyz/sdk';
import { isValidAddressSealevel } from '@hyperlane-xyz/utils';
import type { NextApiRequest, NextApiResponse } from 'next';
import { type Hex, isHex } from 'viem';

const apiKey = process.env.FEE_QUOTING_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_FEE_QUOTING_URL || undefined;

// bytes32 wire encoding (e.g. salt, recipient, targetRouter): 0x + 64 hex chars.
const BYTES32_HEX_LEN = 2 + 64;
function isBytes32Hex(v: string): v is Hex {
  return v.length === BYTES32_HEX_LEN && isHex(v, { strict: true });
}

// Strict allowlist — `endpoint` is a path segment forwarded into the v2
// FeeQuotingV2Client (`${baseUrl}/v2/quote/${endpoint}?...`), so a bare cast
// would be a path-injection surface.
const ALLOWED_ENDPOINTS = new Set<QuoteV2Endpoint>(Object.values(QuoteV2Endpoint));

// Browser-reachable proxy; FEE_QUOTING_API_KEY lives server-side only. Abuse
// protection is at the platform layer (Vercel rate-limiting) and at the
// upstream Hyperlane fee quoting service — don't add an app-layer limiter
// here, it would double-count against the same per-IP / per-key budget.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  if (!apiKey || !baseUrl)
    return res.status(503).json({ message: 'Fee quoting not configured' });

  const endpoint = firstString(req.query.endpoint);
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint as QuoteV2Endpoint)) {
    return res.status(400).json({ message: 'Invalid endpoint' });
  }

  const origin = firstString(req.query.origin);
  const router = firstString(req.query.router);
  const destination = firstString(req.query.destination);
  const salt = firstString(req.query.salt);
  const txSubmitter = firstString(req.query.txSubmitter);
  const recipient = firstString(req.query.recipient);
  const targetRouter = firstString(req.query.targetRouter);

  if (!origin || !router || !destination || !salt || !txSubmitter) {
    return res.status(400).json({ message: 'Missing required query parameters' });
  }

  const destinationDomainId = Number(destination);
  if (!Number.isInteger(destinationDomainId) || destinationDomainId <= 0) {
    return res.status(400).json({ message: 'destination must be a positive integer domain id' });
  }
  if (!isBytes32Hex(salt)) {
    return res.status(400).json({ message: 'salt must be 32-byte hex' });
  }
  // The v2 API is protocol-agnostic at the wire — router / txSubmitter accept
  // either EVM hex or SVM base58. SVM is the only consumer of this UI proxy
  // today, so validate as Sealevel addresses. Add EVM/cross-VM acceptance when
  // we wire the EVM path through v2.
  if (!isValidAddressSealevel(router)) {
    return res.status(400).json({ message: 'router must be a valid Sealevel address' });
  }
  if (!isValidAddressSealevel(txSubmitter)) {
    return res.status(400).json({ message: 'txSubmitter must be a valid Sealevel address' });
  }

  const client = new FeeQuotingV2Client({ baseUrl, apiKey });

  try {
    if (endpoint === QuoteV2Endpoint.Warp) {
      if (!recipient || !targetRouter) {
        return res
          .status(400)
          .json({ message: 'recipient and targetRouter required for warp endpoint' });
      }
      if (!isBytes32Hex(recipient)) {
        return res.status(400).json({ message: 'recipient must be 32-byte hex' });
      }
      if (!isBytes32Hex(targetRouter)) {
        return res.status(400).json({ message: 'targetRouter must be 32-byte hex' });
      }
      const quote = await client.getWarpQuote({
        origin,
        router,
        destination: destinationDomainId,
        salt,
        recipient,
        targetRouter,
        txSubmitter,
      });
      const response: QuoteV2Response = { quote };
      return res.status(200).json(response);
    }

    // endpoint === QuoteV2Endpoint.Igp
    const quote = await client.getIgpQuote({
      origin,
      router,
      destination: destinationDomainId,
      salt,
      txSubmitter,
    });
    const response: QuoteV2Response = { quote };
    return res.status(200).json(response);
  } catch (err) {
    // Preserve the v2 404 body shape so the browser-side client can re-throw
    // its typed `FeeQuotingNoQuoteAvailableError` and let UI logic branch on
    // `reason` (e.g. fall through to onchain quoting on `not_configured`).
    if (err instanceof FeeQuotingNoQuoteAvailableError) {
      const body: NoQuoteAvailableBody = {
        error: NO_QUOTE_AVAILABLE_ERROR,
        reason: err.reason,
        detail: err.detail,
      };
      return res.status(404).json(body);
    }
    // Log full error server-side; return generic message to avoid leaking
    // upstream URLs, status text, or auth hints to the browser.
    console.error('v2 fee quoting request failed', err);
    return res.status(502).json({ message: 'Fee quoting request failed' });
  }
}

function firstString(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
