#!/usr/bin/env node
// Puts the landing page into <dist>/index.html, with the stylesheet inline, so the first response is the first screen.
//   node scripts/prerender.mjs <dist>   (after vite build and the --ssr build into .ssr)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { placeApp } from './hoist-preloads.mjs';

const dist = process.argv[2];
const ssr = resolve('.ssr', readdirSync('.ssr').find((f) => /^entry-server.*\.m?js$/.test(f)));
const { renderLanding } = await import(pathToFileURL(ssr).href);
const file = join(dist, 'index.html');
let html = readFileSync(file, 'utf8');
if (!html.includes('<!--gb-app-->')) throw new Error('index.html has no <!--gb-app--> marker');
// base './': url(./x) in the stylesheet is relative to assets/, and in the page to the root
html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8').replace(/url\((["']?)\.\//g, 'url($1./assets/');
  return `<style>${css}</style>`;
});
// React's resource-hint <link>s go to <head>, so #root holds exactly what the client renders (no React #418)
html = placeApp(html, renderLanding());
writeFileSync(file, html);
console.log(`prerendered index.html: ${(html.length / 1024).toFixed(1)} KB`);
