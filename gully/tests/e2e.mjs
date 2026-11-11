// End-to-end check of the bridge page at 375 / 768 / 1280 / 1920 px.
//   BASE=http://127.0.0.1:5234/ CHROME=<chrome.exe> node tests/e2e.mjs [outdir]
// A mock EIP-6963 wallet is injected: reads go to the real chains; eth_sendTransaction does NOT broadcast. It runs the
// exact transaction the UI built as an eth_call with a state-override balance (a simulation against the live
// contracts), stores the result in window.__sims, then answers "user rejected" so the UI's rejection path runs too.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:5234/';
const OUT = process.argv[2] || 'screenshots';
const ACCOUNT = process.env.ACCOUNT || '0x12Fa4F1F2b90422Da4D425FbcF4BE50e80Fd7a93'; // public testnet address with history
const GULLY_RPC = new URL('rpc/gully', BASE).href; // dev proxy to the GullyChain tunnel
mkdirSync(OUT, { recursive: true });

const walletScript = ({ account, gullyRpc }) => {
  const rpcs = { 421614: 'https://sepolia-rollup.arbitrum.io/rpc', 485590: gullyRpc };
  let chainId = 421614;
  const listeners = {};
  const emit = (e, v) => (listeners[e] || []).forEach((f) => f(v));
  window.__sims = [];
  const rpc = async (method, params) => {
    const r = await fetch(rpcs[chainId], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
    return j.result;
  };
  const provider = {
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account];
        case 'eth_chainId':
          return '0x' + chainId.toString(16);
        case 'wallet_switchEthereumChain':
          chainId = parseInt(params[0].chainId, 16);
          emit('chainChanged', params[0].chainId);
          return null;
        case 'wallet_addEthereumChain':
          return null;
        case 'eth_sendTransaction': {
          const tx = params[0];
          const call = { from: tx.from, to: tx.to, data: tx.data, value: tx.value };
          let result;
          try {
            await rpc('eth_call', [call, 'latest', { [tx.from]: { balance: '0xde0b6b3a7640000' } }]);
            result = 'OK';
          } catch (e) {
            result = 'REVERT ' + e.message;
          }
          window.__sims.push({ chainId, to: tx.to, value: tx.value, selector: (tx.data || '').slice(0, 10), result });
          throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
        }
        default:
          return rpc(method, params);
      }
    },
    on: (e, f) => ((listeners[e] ||= []).push(f), provider),
    removeListener: () => provider,
  };
  const info = { uuid: 'e2e-wallet', name: 'Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'xyz.gullylabs.e2e' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
};

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function open(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference' });
  if (opts.wallet) await ctx.addInitScript(walletScript, { account: ACCOUNT, gullyRpc: GULLY_RPC });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  if (opts.blockArb) await page.route('https://sepolia-rollup.arbitrum.io/**', (r) => r.abort());
  await page.goto(BASE + (opts.query || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(opts.wait ?? 5000);
  return { ctx, page, errors };
}
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const w of (process.env.WIDTHS || "375,768,1280,1920").split(",").map(Number)) {
  // 1. disconnected: quote preview, connect-wallet CTA
  {
    const { ctx, page, errors } = await open(w);
    await page.fill('#amount', '0.0002');
    await page.waitForTimeout(1500);
    check(`${w} disconnected: no horizontal scroll`, await noScroll(page));
    check(`${w} disconnected: connect CTA`, await page.getByRole('button', { name: /connect wallet/i }).isVisible());
    check(`${w} disconnected: quote shows receive`, /0\.0002/.test(await page.locator('.quote').innerText()));
    check(`${w} disconnected: live transfers listed`, (await page.locator('#activity .feed-row').count()) > 0);
    await page.locator('#stats').scrollIntoViewIfNeeded();
    await page.waitForSelector('#stats .an-grid', { timeout: 40000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    check(`${w} analytics: 6 live chart cards`, (await page.locator('#stats .chart-card').count()) === 6);
    check(`${w} analytics: liquidity or backing`, /Fast lane liquidity|backed|outstanding/i.test(await page.locator('.analytics, main').first().innerText().catch(() => '')));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/c-${w}-disconnected.png`, fullPage: true });
    check(`${w} disconnected: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // 2. connected: balances, fast + canonical send simulated through the UI
  {
    const { ctx, page, errors } = await open(w, { wallet: true });
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByRole('button', { name: /test wallet/i }).click();
    await page.waitForTimeout(2500);
    check(`${w} connected: address pill`, await page.locator('.wallet-pill').isVisible());
    await page.fill('#amount', '0.0002');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/c-${w}-quote.png`, fullPage: true });
    if (w === 1280) {
      for (const [lane, dir] of [['Fast', 'deposit'], ['Cheapest', 'deposit'], ['Fast', 'withdraw'], ['Cheapest', 'withdraw']]) {
        if (dir === 'withdraw' && !(await page.locator('.swap-chain').first().innerText()).includes('GullyChain')) await page.getByRole('button', { name: /switch direction/i }).click();
        await page.getByRole('radio', { name: new RegExp(lane) }).first().click();
        await page.fill('#amount', '0.0002');
        await page.waitForTimeout(2500);
        const btn = page.locator('.swap .btn-block');
        const label = await btn.innerText();
        if (await btn.isDisabled()) {
          check(`simulate ${lane} ${dir} through the UI`, /insufficient/i.test(label), `button: "${label.trim()}" (wallet holds no funds for this path)`);
          continue;
        }
        const before = await page.evaluate(() => window.__sims.length);
        await btn.click();
        await page.waitForFunction((n) => window.__sims.length > n, before, { timeout: 30000 }).catch(() => undefined);
        const sim = await page.evaluate(() => window.__sims.at(-1));
        await page.waitForTimeout(800);
        const toast = await page.locator('.toast').last().innerText().catch(() => '');
        check(`simulate ${lane} ${dir} through the UI`, sim?.result === 'OK', `${sim?.selector} -> ${sim?.to} on ${sim?.chainId}: ${sim?.result}; toast "${toast.replace(/\s+/g, ' ').slice(0, 60)}"`);
      }
      await page.screenshot({ path: `${OUT}/c-${w}-rejected.png`, fullPage: true });
      // error state: more than the balance
      await page.fill('#amount', '100000');
      await page.waitForTimeout(2000);
      check('error state: insufficient balance blocks the CTA', /insufficient/i.test(await page.locator('.swap .btn-block').innerText()));
      await page.screenshot({ path: `${OUT}/c-${w}-insufficient.png`, fullPage: true });
    }
    const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.tape, .marquee')).slice(0, 4).map((e) => `${e.tagName}.${typeof e.className === 'string' ? e.className : e.className.baseVal} ${Math.round(e.getBoundingClientRect().right)}`).join(', '));
    check(`${w} connected: no horizontal scroll`, await noScroll(page), wide);
    const real = errors.filter((e) => !/rejected/i.test(e));
    check(`${w} connected: no console errors`, real.length === 0, real.slice(0, 3).join(' | '));
    await ctx.close();
  }
}
// 3. RPC down: error states
{
  const { ctx, page } = await open(375, { blockArb: true, wait: 9000 });
  const text = await page.locator('body').innerText();
  check('RPC down: error state shown', /not answering|could not reach|unavailable/i.test(text));
  await page.screenshot({ path: `${OUT}/c-375-rpc-down.png`, fullPage: true });
  await ctx.close();
}
// 4. integrator + embed
{
  const { ctx, page, errors } = await open(420, { query: '?embed=1&ref=0x000000000000000000000000000000000000dEaD' });
  check('embed: no header', (await page.locator('header.top').count()) === 0);
  check('embed: integrator shown', (await page.locator('.quote').innerText()).toLowerCase().includes('integrator'));
  await page.screenshot({ path: `${OUT}/c-embed.png`, fullPage: true });
  check('embed: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
// 5. reduced motion
{
  const { ctx, page } = await open(1280, { reducedMotion: 'reduce' });
  const dur = await page.locator('.tape-in').evaluate((el) => getComputedStyle(el).animationDuration);
  check('reduced motion: tape animation off', parseFloat(dur) < 0.01, dur);
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
