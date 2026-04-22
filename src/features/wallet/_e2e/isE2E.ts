// E2E test gate. Activated by `?_e2e=1` query param at runtime so prod builds
// never hit mock code paths (the param is absent in prod URLs). Runtime check
// (not NEXT_PUBLIC_*) so the same build serves prod and E2E.
export function isE2EMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('_e2e');
}
