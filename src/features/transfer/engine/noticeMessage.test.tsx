import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { NoticeMessage, noticeMessageToPlainText, parseNoticeMessage } from './noticeMessage';

describe('parseNoticeMessage', () => {
  test('keeps plain text as text', () => {
    expect(parseNoticeMessage('Route unavailable.')).toEqual([
      { type: 'text', text: 'Route unavailable.' },
    ]);
  });

  test('parses a single link', () => {
    expect(parseNoticeMessage('Read [docs](https://example.com/routes).')).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', text: 'docs', href: 'https://example.com/routes' },
      { type: 'text', text: '.' },
    ]);
  });

  test('parses multiple links', () => {
    expect(
      parseNoticeMessage('[Docs](https://example.com/docs) and [status](http://status.example).'),
    ).toEqual([
      { type: 'link', text: 'Docs', href: 'https://example.com/docs' },
      { type: 'text', text: ' and ' },
      { type: 'link', text: 'status', href: 'http://status.example/' },
      { type: 'text', text: '.' },
    ]);
  });

  test('keeps javascript scheme links literal', () => {
    const message = 'Bad [link](javascript:alert(1)).';

    expect(parseNoticeMessage(message)).toEqual([{ type: 'text', text: message }]);
  });

  test('keeps malformed brackets literal', () => {
    const message = 'Broken [docs](https://example.com/routes.';

    expect(parseNoticeMessage(message)).toEqual([{ type: 'text', text: message }]);
  });
});

describe('noticeMessageToPlainText', () => {
  test('replaces links with link text', () => {
    expect(noticeMessageToPlainText('Read [docs](https://example.com/routes).')).toBe('Read docs.');
  });
});

describe('NoticeMessage', () => {
  test('renders anchors when linkify is enabled', () => {
    const markup = renderToStaticMarkup(
      <NoticeMessage message="Read [docs](https://example.com/routes)." linkify />,
    );

    expect(markup).toContain(
      '<a href="https://example.com/routes" target="_blank" rel="noopener noreferrer" class="underline">docs</a>',
    );
  });

  test('renders underlined spans when linkify is disabled', () => {
    const markup = renderToStaticMarkup(
      <NoticeMessage message="Read [docs](https://example.com/routes)." linkify={false} />,
    );

    expect(markup).not.toContain('<a ');
    expect(markup).toContain('<span class="underline">docs</span>');
  });
});
