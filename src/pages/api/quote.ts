import { FeeQuotingClient, type FeeQuotingCommand, WARP_FEE_COMMANDS } from '@hyperlane-xyz/sdk';
import type { NextApiRequest, NextApiResponse } from 'next';

const apiKey = process.env.FEE_QUOTING_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_FEE_QUOTING_URL || undefined;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  if (!apiKey || !baseUrl) return res.status(503).json({ message: 'Fee quoting not configured' });

  const command = firstString(req.query.command);
  const origin = firstString(req.query.origin);
  const router = firstString(req.query.router);
  const destination = firstString(req.query.destination);
  const salt = firstString(req.query.salt);
  const recipient = firstString(req.query.recipient);
  const targetRouter = firstString(req.query.targetRouter);

  if (!command || !origin || !router || !destination || !salt) {
    return res.status(400).json({ message: 'Missing required query parameters' });
  }
  // Warp commands (transferRemote / transferRemoteTo) require a recipient.
  if (WARP_FEE_COMMANDS.has(command as FeeQuotingCommand) && !recipient) {
    return res.status(400).json({ message: 'recipient required for warp commands' });
  }

  const client = new FeeQuotingClient({ baseUrl, apiKey });

  try {
    const response = await client.getQuote({
      command: command as FeeQuotingCommand,
      origin,
      router: router as `0x${string}`,
      destination: Number(destination),
      salt: salt as `0x${string}`,
      recipient: recipient as `0x${string}` | undefined,
      targetRouter: targetRouter as `0x${string}` | undefined,
    });
    return res.status(200).json(response);
  } catch (error: any) {
    const message = error?.message || 'Fee quoting request failed';
    return res.status(502).json({ message });
  }
}

function firstString(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
