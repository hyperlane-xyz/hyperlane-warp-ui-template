import type { NextApiRequest, NextApiResponse } from 'next';

// Server-side proxy for Solana JSON-RPC calls. Browser clients can't call
// Solana RPC endpoints directly (CORS/origin restrictions), so balance fetches
// go through here instead.
//
// SOLANA_RPC_URL can be set to a private endpoint (QuickNode, Helius, etc.)
// without exposing it to the client bundle. Falls back to the public endpoint.
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const upstream = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch {
    res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Proxy error' } });
  }
}
