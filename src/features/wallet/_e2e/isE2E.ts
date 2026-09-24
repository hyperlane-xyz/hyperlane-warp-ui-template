// E2E test gate. Only active on local test hosts plus `?_e2e=1`, so deployed
// prod/preview URLs cannot switch wallet contexts over to mocks.
export function isE2EMode(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalHost && new URLSearchParams(window.location.search).has('_e2e');
}
