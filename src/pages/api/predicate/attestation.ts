import type { NextApiRequest, NextApiResponse } from 'next';

const PREDICATE_API_KEY = process.env.PREDICATE_API_KEY;
const PREDICATE_API_URL =
  process.env.PREDICATE_API_URL || 'https://api.predicate.io/v2/attestation';
const ALLOWED_PREDICATE_DOMAINS = ['api.predicate.io', 'predicate.io'];

// Validate PREDICATE_API_URL to prevent SSRF
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PREDICATE_API_KEY) {
    return res.status(500).json({ error: 'Predicate API key not configured' });
  }

  // Validate API URL to prevent SSRF
  if (!validateApiUrl(PREDICATE_API_URL)) {
    console.error('Invalid PREDICATE_API_URL:', PREDICATE_API_URL);
    return res.status(500).json({ error: 'Invalid API configuration' });
  }

  // Input validation
  const { to, from, data, msg_value, chain } = req.body || {};
  if (!to || !from || !data || !msg_value || !chain) {
    return res.status(400).json({
      error: 'Missing required fields: to, from, data, msg_value, chain',
    });
  }

  // Validate field types
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
    const response = await fetch(PREDICATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PREDICATE_API_KEY,
      },
      body: JSON.stringify({ to, from, data, msg_value, chain }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Sanitize error response - don't leak Predicate API internals
      console.error('Predicate API error:', response.status, responseData);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: 'Failed to fetch attestation',
      });
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Predicate API proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch attestation' });
  }
}
