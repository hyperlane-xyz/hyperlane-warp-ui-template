// Real-browser check of the chain picker modals at 390 / 768 / 1440 (Playwright).
//   BASE=https://testnet-bridge.gullychain.xyz/ node tests/modal-check.mjs <outdir> [label]
//   DIR=<staged build> node tests/modal-check.mjs <outdir> [label]   (serves the folder itself)
// Opens "Bridge from" and "Bridge to", asserts with elementFromPoint that nothing of the page is stacked over the modal,
// that Esc closes it and returns focus, that Tab stays inside, and that the page logs no console errors.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const OUT = process.argv[2] || 'shots';
const LABEL = process.argv[3] || 'after';
mkdirSync(OUT, { recursive: true });
let BASE = process.env.BASE;
let server;
if (!BASE) {
  const dir = process.env.DIR;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    let p = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!existsSync(p) || statSync(p).isDirectory()) p = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  }).listen(0);
  BASE = `http://127.0.0.1:${server.address().port}/`;
}

const browser = await chromium.launch();
let failed = 0;
const fail = (m) => { failed++; console.log('  FAIL', m); };
for (const w of [390, 768, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|429|rpc|CORS|favicon/i.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.chain-btn', { timeout: 30000 });
  await page.waitForTimeout(2500);
  for (const which of ['from', 'to']) {
    if (which === 'to') {
      const flip = page.locator('.swap-flip').first();
      if (await flip.count()) { await flip.click(); await page.waitForTimeout(400); }
    }
    // bring the steps strip into view behind the modal so a leak would show
    await page.evaluate(() => document.querySelector('.stepper')?.scrollIntoView({ block: 'center' }));
    const btn = page.locator('.chain-btn').first();
    await page.evaluate(() => window.scrollTo(0, 0));
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForSelector('[role=dialog]');
    await page.waitForTimeout(450);
    const title = await page.locator('[role=dialog] h2').innerText();
    console.log(`${w}px ${which}: "${title}"`);
    const res = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const r = d.getBoundingClientRect();
      const bad = [];
      const pts = [];
      for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) for (const fy of [0.05, 0.25, 0.5, 0.75, 0.95]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
      d.querySelectorAll('li, button, .fine').forEach((e) => { const b = e.getBoundingClientRect(); pts.push([b.left + b.width / 2, b.top + b.height / 2]); });
      for (const [x, y] of pts) {
        const el = document.elementFromPoint(x, y);
        if (!el || !d.contains(el)) bad.push(`${Math.round(x)},${Math.round(y)} -> ${el ? el.tagName + '.' + el.className : 'null'}`);
      }
      const rows = [...d.querySelectorAll('.chain-list button')].map((b) => Math.round(b.getBoundingClientRect().height));
      const dots = [...document.querySelectorAll('.step-dot')].filter((e) => { const b = e.getBoundingClientRect(); return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom; }).map((e) => { const b = e.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === e; });
      return { bad, rows, dotsOverModal: dots.filter(Boolean).length, inPortal: d.closest('#root') === null, vw: innerWidth, rect: [r.left, r.right, r.bottom, innerHeight] };
    });
    if (res.bad.length) fail(`${w} ${which}: page painted over the modal at ${res.bad.slice(0, 4).join(' | ')}`);
    if (res.dotsOverModal) fail(`${w} ${which}: ${res.dotsOverModal} step dot(s) on top of the modal`);
    if (res.rows.some((h) => h < 44)) fail(`${w} ${which}: row under 44px ${res.rows}`);
    if (res.rect[0] < -1 || res.rect[1] > res.vw + 1) fail(`${w} ${which}: modal wider than the screen`);
    console.log('  rows', res.rows.join(','), 'portal', res.inPortal);
    await page.screenshot({ path: `${OUT}/${LABEL}-${which}-${w}.png` });
    // focus trap: tab many times, focus must stay inside the dialog (new build only)
    if (LABEL !== 'before') {
      for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement));
      if (!inside) fail(`${w} ${which}: focus left the dialog`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (await page.locator('[role=dialog]').count()) fail(`${w} ${which}: Esc did not close`);
    else if (LABEL !== 'before') {
      const back = await page.evaluate(() => document.activeElement?.className || '');
      if (!/chain-btn/.test(back)) fail(`${w} ${which}: focus not returned to the opener (${back})`);
    }
    // backdrop click closes
    await btn.click();
    await page.waitForSelector('[role=dialog]');
    await page.mouse.click(4, 4);
    await page.waitForTimeout(300);
    if (await page.locator('[role=dialog]').count()) fail(`${w} ${which}: backdrop click did not close`);
  }
  // token picker row + steps strip, page-level shots
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/${LABEL}-page-${w}.png` });
  if (errs.length) fail(`${w}: console errors ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await browser.close();
server?.close();
console.log(failed ? `FAILED ${failed}` : 'ALL OK');
process.exit(failed ? 1 : 0);
