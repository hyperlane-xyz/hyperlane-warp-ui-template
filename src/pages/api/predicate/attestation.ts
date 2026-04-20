import { PredicateApiClient } from '@hyperlane-xyz/sdk';
import type { NextApiRequest, NextApiResponse } from 'next';

import { logger } from '../../../utils/logger';

const PREDICATE_API_KEY = process.env.PREDICATE_API_KEY;
const PREDICATE_API_URL = process.env.PREDICATE_API_URL;
const ALLOWED_PREDICATE_DOMAINS = ['api.predicate.io', 'predicate.io'];

// Validate PREDICATE_API_URL override to prevent SSRF
function validateApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_PREDICATE_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain),
      )
    );
  } catch {
    return false;
  }
}

// In-memory sliding-window rate limiter: 10 req / IP / 60s.
// Per-instance only (no Redis), which is sufficient to slow automated abuse
// against any single warm serverless instance.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ipRequestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  ipRequestLog.set(ip, timestamps);
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip =
    (req.headers['x-real-ip'] as string | undefined) ||
    req.socket?.remoteAddress ||
    'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (!PREDICATE_API_KEY) {
    return res.status(500).json({ error: 'Predicate API key not configured' });
  }

  if (PREDICATE_API_URL && !validateApiUrl(PREDICATE_API_URL)) {
    logger.error('Invalid PREDICATE_API_URL', new Error(PREDICATE_API_URL));
    return res.status(500).json({ error: 'Invalid API configuration' });
  }

  // Input validation
  const { to, from, data, msg_value, chain } = req.body || {};
  if (!to || !from || !data || !msg_value || !chain) {
    return res.status(400).json({
      error: 'Missing required fields: to, from, data, msg_value, chain',
    });
  }

  if (
    typeof to !== 'string' ||
    typeof from !== 'string' ||
    typeof data !== 'string' ||
    typeof msg_value !== 'string' ||
    typeof chain !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid field types' });
  }

  try {
    const client = new PredicateApiClient(PREDICATE_API_KEY, PREDICATE_API_URL);
    const result = await client.fetchAttestation({ to, from, data, msg_value, chain });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Predicate API error', error);
    return res.status(502).json({ error: 'Failed to fetch attestation' });
  }
}
