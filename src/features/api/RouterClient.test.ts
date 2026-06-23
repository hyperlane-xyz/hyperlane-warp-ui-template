import { afterEach, describe, expect, test, vi } from 'vitest';

import { RouterClient } from './RouterClient';

describe('RouterClient.availableRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('serializes source-side query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          direction: 'fromSource',
          tokens: [],
        }),
      ),
    );

    await new RouterClient('https://router.test').availableRoutes({
      srcChain: 1,
      srcToken: '0x1111111111111111111111111111111111111111',
      dstChain: null,
      dstToken: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/available-routes?srcChain=1&srcToken=0x1111111111111111111111111111111111111111',
    );
  });

  test('serializes destination-side query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          direction: 'toDestination',
          tokens: [],
        }),
      ),
    );

    await new RouterClient('https://router.test').availableRoutes({
      srcChain: null,
      srcToken: null,
      dstChain: 'stride-1',
      dstToken: 'uusdc',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.test/v1/available-routes?dstChain=stride-1&dstToken=uusdc',
    );
  });

  test('rejects malformed side selection before calling the engine', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const client = new RouterClient('https://router.test');

    expect(() => client.availableRoutes({ srcChain: 1 })).toThrow('srcChain and srcToken together');
    expect(() =>
      client.availableRoutes({
        srcChain: 1,
        srcToken: '0x1111111111111111111111111111111111111111',
        dstChain: 10,
        dstToken: '0x2222222222222222222222222222222222222222',
      }),
    ).toThrow('exactly one source or destination token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
