import { trimToLength } from './string';

export function errorToString(error: any, maxLength = 300) {
  if (!error) return 'Unknown Error';
  if (typeof error === 'string') return trimToLength(error, maxLength);
  if (typeof error === 'number') return `Error code: ${error}`;
  const details = error.message || error.reason || error;
  if (typeof details === 'string') return trimToLength(details, maxLength);
  return trimToLength(JSON.stringify(details), maxLength);
}
