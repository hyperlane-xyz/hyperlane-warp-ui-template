import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// This is an undocumented Next.js build artifact; fail loudly if its shape or
// location changes so a framework upgrade cannot silently disable the guard.
const STATS_PATH = '.next/diagnostics/route-bundle-stats.json';
const MIB = 1024 * 1024;
const ROUTE_BUDGETS = {
  '/': { raw: 204 * MIB, gzip: 37 * MIB },
  '/embed': { raw: 207 * MIB, gzip: 38 * MIB },
  '/blocked': { raw: 108 * MIB, gzip: 20 * MIB },
};

const formatMib = (bytes) => `${(bytes / MIB).toFixed(2)} MiB`;

let stats;
try {
  stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
} catch (error) {
  console.error(`Unable to read ${STATS_PATH}. Run a production build first.`, error);
  process.exit(1);
}

let overBudget = false;
for (const [route, budget] of Object.entries(ROUTE_BUDGETS)) {
  const routeStats = stats.find((entry) => entry.route === route);
  if (!routeStats) {
    console.error(`Missing bundle stats for ${route}`);
    overBudget = true;
    continue;
  }

  let gzipBytes = 0;
  try {
    gzipBytes = routeStats.firstLoadChunkPaths.reduce(
      (total, chunkPath) => total + gzipSync(readFileSync(chunkPath)).length,
      0,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to calculate gzip size for ${route}: ${message}`);
    overBudget = true;
    continue;
  }
  const rawBytes = routeStats.firstLoadUncompressedJsBytes;
  const withinBudget = rawBytes <= budget.raw && gzipBytes <= budget.gzip;
  const status = withinBudget ? 'PASS' : 'FAIL';
  console.log(
    `${status} ${route.padEnd(8)} ${formatMib(rawBytes)} raw / ${formatMib(budget.raw)} budget; ${formatMib(gzipBytes)} gzip / ${formatMib(budget.gzip)} budget`,
  );
  overBudget ||= !withinBudget;
}

if (overBudget) process.exit(1);
