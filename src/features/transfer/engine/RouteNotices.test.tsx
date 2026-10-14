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
    expect(markup).toContain('bg-red-400');
    expect(markup).toContain('bg-orange-400');
    expect(markup).toContain('bg-blue-500');
  });

  test('renders markdown links as anchors in full mode', () => {
    const markup = renderToStaticMarkup(
      <RouteNotices
        notices={[
          {
            blocksTransfer: false,
            message: 'Read [docs](https://example.com/routes).',
            severity: 'info',
          },
        ]}
      />,
    );

    expect(markup).toContain(
      '<a href="https://example.com/routes" target="_blank" rel="noopener noreferrer" class="underline">docs</a>',
    );
  });

  test('renders markdown links without anchors in compact mode', () => {
    const markup = renderToStaticMarkup(
      <RouteNotices
        compact
        notices={[
          {
            blocksTransfer: false,
            message: 'Read [docs](https://example.com/routes).',
            severity: 'info',
          },
        ]}
      />,
    );

    expect(markup).not.toContain('<a ');
    expect(markup).toContain('<span class="underline">docs</span>');
  });
});
