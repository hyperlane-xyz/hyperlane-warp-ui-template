import { GithubRegistry, HttpClientRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import type { IRegistry } from '@hyperlane-xyz/registry';

export function createConfiguredRegistry(config: {
  registryUrl?: string;
  registryBranch?: string;
  registryProxyUrl?: string;
}): IRegistry {
  if (!config.registryUrl && !config.registryBranch) return new PartialRegistry({});
  const registryUrl = config.registryUrl?.replace(/\/+$/, '');
  if (registryUrl && !isGithubRepositoryUrl(registryUrl)) {
    return new HttpClientRegistry(registryUrl);
  }
  return new GithubRegistry({
    uri: registryUrl,
    branch: config.registryBranch,
    proxyUrl: config.registryProxyUrl,
  });
}

function isGithubRepositoryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return false;

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 2) return true;
    return segments.length >= 4 && segments[2] === 'tree';
  } catch {
    return false;
  }
}
