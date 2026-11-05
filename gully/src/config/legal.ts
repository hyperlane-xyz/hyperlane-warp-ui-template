// Gully Chain has one Terms of Service and one Privacy Policy, on gullychain.xyz; they cover the bridge
// (bridge.gullychain.xyz and testnet-bridge.gullychain.xyz). /terms and /privacy on this host redirect there.
import { LINKS } from './chains';

// Only the bare paths: the build uses relative asset URLs (./assets/...), so under /terms/ the bundle itself does not
// load and no client-side redirect can run there (same as any nested path on this site).
const PATHS: Record<string, string> = {
  '/terms': LINKS.terms,
  '/privacy': LINKS.privacy,
};

/** Where a legal path on this host goes, or null for every other path. */
export function legalRedirect(pathname: string): string | null {
  return PATHS[pathname] ?? null;
}
