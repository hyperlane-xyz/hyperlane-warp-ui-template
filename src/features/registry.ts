import { GithubRegistry, HttpClientRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import type { IRegistry } from '@hyperlane-xyz/registry';

export function createConfiguredRegistry(config: {
  registryUrl?: string;
  registryBranch?: string;
  registryProxyUrl?: string;
}): IRegistry {
  if (!config.registryUrl && !config.registryBranch) return new PartialRegistry({});
  if (config.registryUrl && !config.registryUrl.toLowerCase().includes('github')) {
    return new HttpClientRegistry(config.registryUrl);
  }
  return new GithubRegistry({
    uri: config.registryUrl,
    branch: config.registryBranch,
    proxyUrl: config.registryProxyUrl,
  });
}
