export function isBrowser() {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

export function isNode() {
  return typeof process !== 'undefined';
}
