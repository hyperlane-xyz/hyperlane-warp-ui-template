import type { NextApiRequest, NextApiResponse } from 'next';

import { FeeQuotingClient, type QuotedCallsCommand } from '@hyperlane-xyz/fee-quoting';

const apiKey = process.env.FEE_QUOTING_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_FEE_QUOTING_URL || 'https://quoting.services.hyperlane.xyz';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  if (!apiKey || !baseUrl) return res.status(503).json({ message: 'Fee quoting not configured' });

  const { command, origin, router, destination, salt, recipient } = req.query;

  if (!command || !origin || !router || !destination || !salt) {
    return res.status(400).json({ message: 'Missing required query parameters' });
  }

  const client = new FeeQuotingClient({ baseUrl, apiKey });

  try {
    const response = await client.getQuote({
      command: command as QuotedCallsCommand,
      origin: origin as string,
      router: router as `0x${string}`,
      destination: Number(destination),
      salt: salt as `0x${string}`,
      recipient: recipient as `0x${string}` | undefined,
    });
    return res.status(200).json(response);
  } catch (error: any) {
    const message = error?.message || 'Fee quoting request failed';
    return res.status(502).json({ message });
  }
}
