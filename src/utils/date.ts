export function formatTimestamp(timestamp: number): string {
  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp');
  }
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
}
