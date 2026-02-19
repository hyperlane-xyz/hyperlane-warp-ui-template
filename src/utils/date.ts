export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
}

export function formatTransferHistoryTimestamp(timestamp: number, now = Date.now()): string {
  const elapsedMs = now - timestamp;
  if (elapsedMs < 0) return formatTimestamp(timestamp);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return formatTimestamp(timestamp);
}
