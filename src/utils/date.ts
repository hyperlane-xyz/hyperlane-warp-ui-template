export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
}

function toMs(timestamp: number): number {
  // Timestamps below 1e12 are likely epoch seconds (ms didn't reach 1e12 until 2001)
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

export function formatTransferHistoryTimestamp(timestamp: number, now = Date.now()): string {
  const tsMs = toMs(timestamp);
  const elapsedMs = now - tsMs;
  if (elapsedMs < 0) return formatTimestamp(tsMs);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return formatTimestamp(tsMs);
}
