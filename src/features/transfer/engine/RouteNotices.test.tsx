import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { RouteNotices } from './RouteNotices';

describe('RouteNotices', () => {
  test('renders blocking and non-blocking messages with their severity', () => {
    const markup = renderToStaticMarkup(
      <RouteNotices
        notices={[
          { blocksTransfer: true, message: 'Route unavailable.', severity: 'error' },
          { blocksTransfer: false, message: 'Unaudited code.', severity: 'warning' },
          { blocksTransfer: false, message: 'More information.', severity: 'info' },
        ]}
      />,
    );

    expect(markup).toContain('Route unavailable.');
    expect(markup).toContain('Unaudited code.');
    expect(markup).toContain('More information.');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-testid="route-notice-warning"');
    expect(markup).toContain('data-testid="route-notice-info"');
  });
});
