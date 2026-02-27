import type { NextApiRequest, NextApiResponse } from 'next';

const PREDICATE_API_KEY = process.env.NEXT_PUBLIC_PREDICATE_API_KEY;
const PREDICATE_API_URL =
  process.env.NEXT_PUBLIC_PREDICATE_API_URL || 'https://api.predicate.io/v2/attestation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PREDICATE_API_KEY) {
    return res.status(500).json({ error: 'Predicate API key not configured' });
  }

  try {
    const response = await fetch(PREDICATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PREDICATE_API_KEY,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Predicate API proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch attestation' });
  }
}
