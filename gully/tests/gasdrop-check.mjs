// Gas on arrival, in a real browser: a fresh wallet that bridges a Gully Warp Mirror coin back to Gully Chain sees the
// GullyGasDrop note ("You also get … ETH for gas") before it sends. Read-only: the mock wallet never signs.
//   BASE=https://testnet-bridge.gullychain.xyz/ CHROME=<chrome> [ACCOUNT=0x…] node tests/gasdrop-check.mjs
// Exit 0 = note shown (or GAS_DROP_EXPECT=off and no note), 1 = not shown, 2 = setup error (no mirror route).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://testnet-bridge.gullychain.xyz/';
const ACCOUNT = process.env.ACCOUNT || '0x' + [...crypto.getRandomValues(new Uint8Array(20))].map((b) => b.toString(16).padStart(2, '0')).join('');
const expectOn = (process.env.GAS_DROP_EXPECT || 'on') !== 'off';

const mirrors = await (await fetch(new URL('mirrors.json', BASE))).json().catch(() => null);
const pair = mirrors?.pairs?.find((p) => p.status === 'active');
if (!pair) {
  console.log('FAIL  no active mirror pair in mirrors.json');
  process.exit(2);
}

const walletScript = ({ account }) => {
  const rpcs = { 421614: 'https://sepolia-rollup.arbitrum.io/rpc', 485590: 'https://rpc.gullychain.xyz' };
  let chainId = 421614;
  const rpc = async (method, params) => {
    const r = await fetch(rpcs[chainId], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
    return j.result;
  };
  const provider = {
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
      if (method === 'eth_chainId') return '0x' + chainId.toString(16);
      if (method === 'wallet_switchEthereumChain') return (chainId = parseInt(params[0].chainId, 16)), null;
      if (method === 'wallet_addEthereumChain') return null;
      if (method === 'eth_sendTransaction' || method.startsWith('eth_sign') || method === 'personal_sign') throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      return rpc(method, params);
    },
    on: () => provider,
    removeListener: () => provider,
  };
  const info = { uuid: 'gasdrop-check', name: 'Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'xyz.gullylabs.gasdrop' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
};

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
let ok = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(walletScript, { account: ACCOUNT });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}?token=${pair.token}&direction=deposit&amount=0.001`, { waitUntil: 'domcontentloaded' });
  const connect = page.getByRole('button', { name: /connect wallet/i }).first();
  if (await connect.isVisible().catch(() => false)) {
    await connect.click();
    await page.getByText(/Test Wallet/).first().click().catch(() => undefined);
  }
  const note = page.locator('.gas-note');
  const shown = await note.waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false);
  const text = shown ? (await note.innerText()).replace(/\s+/g, ' ') : '';
  ok = expectOn ? shown && /for gas/i.test(text) : !shown;
  console.log(`${ok ? 'PASS' : 'FAIL'}  gas on arrival note for ${ACCOUNT} on the ${pair.symbol} bridge-back: ${shown ? `"${text}"` : 'not shown'}`);
  await page.screenshot({ path: process.env.SHOT || 'gasdrop-390.png', fullPage: false });
  if (errors.length) console.log(`note  console errors: ${errors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);
