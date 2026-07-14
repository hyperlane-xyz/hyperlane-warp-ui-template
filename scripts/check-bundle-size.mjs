import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const STATS_PATH = '.next/diagnostics/route-bundle-stats.json';
const MIB = 1024 * 1024;
const ROUTE_BUDGETS = {
  '/': 128 * MIB,
  '/embed': 132 * MIB,
  '/blocked': 108 * MIB,
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

  const gzipBytes = routeStats.firstLoadChunkPaths.reduce(
    (total, chunkPath) => total + gzipSync(readFileSync(chunkPath)).length,
    0,
  );
  const rawBytes = routeStats.firstLoadUncompressedJsBytes;
  const status = rawBytes <= budget ? 'PASS' : 'FAIL';
  console.log(
    `${status} ${route.padEnd(8)} ${formatMib(rawBytes)} raw / ${formatMib(budget)} budget; ${formatMib(gzipBytes)} gzip`,
  );
  overBudget ||= rawBytes > budget;
}

if (overBudget) process.exit(1);
