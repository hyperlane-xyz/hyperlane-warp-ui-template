import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueryParams, updateQueryParam, updateQueryParams } from '../queryParams';

describe('queryParams utilities', () => {
  let mockLocation: { pathname: string; search: string };
  let locationGetterSpy: ReturnType<typeof vi.spyOn>;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockLocation = { pathname: '/current', search: '?foo=bar' }; // Initial mock location

    locationGetterSpy = vi
      .spyOn(window, 'location', 'get')
      .mockReturnValue(mockLocation as unknown as Location); // Mock window.location

    replaceStateSpy = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation((_state, _title, url) => {
        const urlString = typeof url === 'string' ? url : url?.toString() || '';
        const [pathname, queryString = ''] = urlString.split('?');
        mockLocation.pathname = pathname;
        mockLocation.search = queryString ? `?${queryString}` : '';
      });
  });

  afterEach(() => {
    locationGetterSpy.mockRestore();
    replaceStateSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns the current query params from the URL', () => {
    mockLocation.search = '?alpha=1&beta=two';

    const params = getQueryParams();

    expect(params.get('alpha')).toBe('1');
    expect(params.get('beta')).toBe('two'); // Ensure it was called with correct args
  });

  it('adds or updates a query parameter and replaces history state', () => {
    mockLocation.search = '?foo=bar';

    updateQueryParam('beta', 'two'); // Add new param

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/current?foo=bar&beta=two');
    expect(mockLocation.search).toBe('?foo=bar&beta=two');
  });

  it('removes a query parameter when value is undefined', () => {
    mockLocation.search = '?foo=bar&beta=two';

    updateQueryParam('beta');

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/current?foo=bar');
    expect(mockLocation.search).toBe('?foo=bar'); // Ensure it was called with correct args
  });

  it('updates multiple query parameters sequentially', () => {
    mockLocation.search = '?foo=bar';

    updateQueryParams({ foo: 'baz', beta: 2 });

    expect(replaceStateSpy).toHaveBeenCalledTimes(2);
    expect(replaceStateSpy).toHaveBeenLastCalledWith({}, '', '/current?foo=baz&beta=2');
    expect(mockLocation.search).toBe('?foo=baz&beta=2');
  });
});
