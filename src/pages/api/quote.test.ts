import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockGetQuote = vi.fn();

vi.mock('@hyperlane-xyz/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hyperlane-xyz/sdk')>()),
  FeeQuotingClient: class {
    getQuote = mockGetQuote;
  },
}));

vi.stubEnv('FEE_QUOTING_API_KEY', 'test-api-key');
vi.stubEnv('NEXT_PUBLIC_FEE_QUOTING_URL', 'https://quoting.test');

const { default: handler } = await import('./quote');

function mockReqRes(method: string, query: Record<string, string> = {}) {
  const req = { method, query } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
  return { req, res };
}

beforeEach(() => vi.clearAllMocks());

describe('quote API handler', () => {
  const validQuery = {
    command: 'transferRemote',
    origin: 'ethereum',
    router: '0x1234',
    destination: '1',
    salt: '0xabcd',
    recipient: '0x5678',
  };

  test('rejects non-GET methods', async () => {
    const { req, res } = mockReqRes('POST', validQuery);
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 for missing required params', async () => {
    const { req, res } = mockReqRes('GET', { command: 'transferRemote' });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('proxies successful quote response', async () => {
    const mockResponse = { quotes: [{ token: '0x1', amount: '100' }] };
    mockGetQuote.mockResolvedValue(mockResponse);

    const { req, res } = mockReqRes('GET', validQuery);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResponse);
    expect(mockGetQuote).toHaveBeenCalledWith({
      command: 'transferRemote',
      origin: 'ethereum',
      router: '0x1234',
      destination: 1,
      salt: '0xabcd',
      recipient: '0x5678',
    });
  });

  test('returns 400 when command is not in the allowlist', async () => {
    const { req, res } = mockReqRes('GET', { ...validQuery, command: 'foo/../admin' });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid command' });
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  test('returns 400 when destination is not a positive integer', async () => {
    const { req, res } = mockReqRes('GET', { ...validQuery, destination: 'abc' });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'destination must be a positive integer domain id',
    });
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  test('returns 400 when warp command is missing recipient', async () => {
    const { recipient: _omitted, ...noRecipient } = validQuery;
    const { req, res } = mockReqRes('GET', noRecipient);
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'recipient required for warp commands' });
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  test('returns 502 with a generic message on upstream error (no leak)', async () => {
    mockGetQuote.mockRejectedValue(new Error('Invalid API key'));

    const { req, res } = mockReqRes('GET', validQuery);
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fee quoting request failed' });
  });
});
