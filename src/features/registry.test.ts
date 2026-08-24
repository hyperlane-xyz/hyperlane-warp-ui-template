import { GithubRegistry, HttpClientRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import { describe, expect, test } from 'vitest';

import { createConfiguredRegistry } from './registry';

describe('createConfiguredRegistry', () => {
  test('uses an HTTP registry for a non-GitHub URL', () => {
    expect(createConfiguredRegistry({ registryUrl: 'http://localhost:3334' })).toBeInstanceOf(
      HttpClientRegistry,
    );
  });

  test('uses a GitHub registry when github appears in the configured URL', () => {
    expect(
      createConfiguredRegistry({
        registryUrl: 'https://github.com/hyperlane-xyz/hyperlane-registry',
      }),
    ).toBeInstanceOf(GithubRegistry);
  });

  test('uses the embedded partial registry without custom configuration', () => {
    expect(createConfiguredRegistry({})).toBeInstanceOf(PartialRegistry);
  });
});
