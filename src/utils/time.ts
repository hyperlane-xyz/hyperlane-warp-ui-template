// Inspired by https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
export function getHumanReadableTimeString(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds <= 1) {
    return 'Just now';
  }
  if (seconds <= 60) {
    return `${seconds} seconds ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes <= 1) {
    return '1 minute ago';
  }
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours <= 1) {
    return '1 hour ago';
  }
  if (hours < 24) {
    return `${hours} hours ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function getHumanReadableDuration(ms: number, minSec?: number) {
  let seconds = Math.round(ms / 1000);

  if (minSec) {
    seconds = Math.max(seconds, minSec);
  }

  if (seconds <= 60) {
    return `${seconds} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} hr`;
}

export function getDateTimeString(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
}

// Adjusts a timestamp forward/backward based on
// the local time's for the timezone offset
export function adjustToUtcTime(timestamp: number) {
  const offsetMs = new Date().getTimezoneOffset() * 60_000;
  const adjusted = new Date(timestamp + offsetMs);
  return adjusted.toISOString();
}
