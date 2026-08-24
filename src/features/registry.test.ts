import { GithubRegistry, HttpClientRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import { describe, expect, test } from 'vitest';

import { createConfiguredRegistry } from './registry';

describe('createConfiguredRegistry', () => {
  test('uses an HTTP registry for a non-GitHub URL', () => {
    expect(createConfiguredRegistry({ registryUrl: 'http://localhost:3334' })).toBeInstanceOf(
      HttpClientRegistry,
    );
  });

  test('uses a GitHub registry for a supported repository URL', () => {
    expect(
      createConfiguredRegistry({
        registryUrl: 'https://github.com/hyperlane-xyz/hyperlane-registry',
      }),
    ).toBeInstanceOf(GithubRegistry);
  });

  test('uses a GitHub registry for a repository URL with a branch path', () => {
    expect(
      createConfiguredRegistry({
        registryUrl: 'https://github.com/hyperlane-xyz/hyperlane-registry/tree/test-branch',
      }),
    ).toBeInstanceOf(GithubRegistry);
  });

  test('uses an HTTP registry when a non-GitHub path contains github', () => {
    expect(
      createConfiguredRegistry({
        registryUrl: 'https://registry.example/github/owner/repo',
      }),
    ).toBeInstanceOf(HttpClientRegistry);
  });

  test('uses an HTTP registry for a GitHub URL without a repository path', () => {
    expect(
      createConfiguredRegistry({ registryUrl: 'https://github.com/hyperlane-xyz' }),
    ).toBeInstanceOf(HttpClientRegistry);
  });

  test('uses the embedded partial registry without custom configuration', () => {
    expect(createConfiguredRegistry({})).toBeInstanceOf(PartialRegistry);
  });
});
