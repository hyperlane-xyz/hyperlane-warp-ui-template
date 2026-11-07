#!/usr/bin/env node
// The lab run behind the load gate: one fixed mobile profile, so before and after are comparable. Runs in the Playwright
// image on a box (never on the laptop).
//   node load/lab.mjs <url> [--runs 3] [--gate]      --gate: exit 1 when LCP is over 2.5 s or CLS over 0.1
// Profile: 390x844, Fast 3G-like (1.6 Mbit down, 750 kbit up, 150 ms latency), CPU slowed 4x, empty cache. Prints the
// median of the runs and a repeat view (same browser context, so the service worker and cache apply).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const LIMITS = { lcpMs: 2500, cls: 0.1 };
export const verdict = (m, limits = LIMITS) => [
  ...(m.lcpMs === null ? ['LCP was not reported'] : m.lcpMs > limits.lcpMs ? [`LCP ${m.lcpMs} ms is over ${limits.lcpMs} ms`] : []),
  ...(m.cls > limits.cls ? [`CLS ${m.cls} is over ${limits.cls}`] : []),
];
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const OBSERVE = `(() => {
  window.__lab = { lcp: null, cls: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lab.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__lab.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
})()`;

async function view(context, url) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(OBSERVE);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  const m = await page.evaluate(() => ({ lcp: window.__lab.lcp, cls: window.__lab.cls, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null }));
  await page.close();
  return { lcpMs: m.lcp === null ? null : Math.round(m.lcp), fcpMs: m.fcp === null ? null : Math.round(m.fcp), cls: Number(m.cls.toFixed(3)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2); const url = argv[0];
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
  const runs = Number(opt('runs', '3'));
  const require = createRequire(`${process.cwd()}/`);
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core')); }
  const browser = await chromium.launch();
  const first = []; const repeat = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    first.push(await view(context, url));
    await new Promise((s) => setTimeout(s, 1500));
    repeat.push(await view(context, url));
    await context.close();
  }
  await browser.close();
  const med = (rows) => ({ lcpMs: rows.some((r) => r.lcpMs === null) ? null : median(rows.map((r) => r.lcpMs)), fcpMs: median(rows.map((r) => r.fcpMs ?? 0)), cls: median(rows.map((r) => r.cls)) });
  const a = med(first); const b = med(repeat);
  console.log(JSON.stringify({ url, profile: '390x844, 1.6 Mbit, 150 ms, CPU x4', runs, first: a, repeat: b }));
  const bad = verdict(a);
  if (argv.includes('--gate') && bad.length) { for (const p of bad) console.error(`FAIL ${p}`); process.exit(1); }
}
