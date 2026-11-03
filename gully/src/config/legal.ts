// Gully Chain has one Terms of Service and one Privacy Policy, on gullychain.xyz; they cover the bridge
// (bridge.gullychain.xyz and testnet-bridge.gullychain.xyz). /terms and /privacy on this host redirect there.
import { LINKS } from './chains';

const PATHS: Record<string, string> = {
  '/terms': LINKS.terms,
  '/terms/': LINKS.terms,
  '/privacy': LINKS.privacy,
  '/privacy/': LINKS.privacy,
};

/** Where a legal path on this host goes, or null for every other path. */
export function legalRedirect(pathname: string): string | null {
  return PATHS[pathname] ?? null;
}
