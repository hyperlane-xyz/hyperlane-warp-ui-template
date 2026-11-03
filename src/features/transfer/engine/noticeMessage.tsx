export type NoticeMessageSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string };

function getNoticeLinkHref(rawHref: string) {
  try {
    const url = new URL(rawHref);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

function appendText(segments: NoticeMessageSegment[], text: string) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.type === 'text') {
    previous.text += text;
    return;
  }
  segments.push({ type: 'text', text });
}

export function parseNoticeMessage(message: string): NoticeMessageSegment[] {
  const segments: NoticeMessageSegment[] = [];
  let cursor = 0;

  while (cursor < message.length) {
    const openBracket = message.indexOf('[', cursor);
    if (openBracket === -1) {
      appendText(segments, message.slice(cursor));
      break;
    }

    const closeBracket = message.indexOf(']', openBracket + 1);
    if (closeBracket === -1) {
      appendText(segments, message.slice(cursor));
      break;
    }

    if (message[closeBracket + 1] !== '(') {
      appendText(segments, message.slice(cursor, closeBracket + 1));
      cursor = closeBracket + 1;
      continue;
    }

    const closeParen = message.indexOf(')', closeBracket + 2);
    if (closeParen === -1) {
      appendText(segments, message.slice(cursor));
      break;
    }

    appendText(segments, message.slice(cursor, openBracket));

    const text = message.slice(openBracket + 1, closeBracket);
    const rawHref = message.slice(closeBracket + 2, closeParen);
    const href = getNoticeLinkHref(rawHref);
    if (href) {
      segments.push({ type: 'link', text, href });
    } else {
      appendText(segments, message.slice(openBracket, closeParen + 1));
    }

    cursor = closeParen + 1;
  }

  return segments;
}

export function noticeMessageToPlainText(message: string) {
  return parseNoticeMessage(message)
    .map((segment) => segment.text)
    .join('');
}

export function NoticeMessage({ message, linkify }: { message: string; linkify: boolean }) {
  return (
    <>
      {parseNoticeMessage(message).map((segment, index) => {
        if (segment.type === 'text') return segment.text;
        if (!linkify) {
          return (
            <span key={`${segment.text}-${index}`} className="underline">
              {segment.text}
            </span>
          );
        }
        return (
          <a
            key={`${segment.href}-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {segment.text}
          </a>
        );
      })}
    </>
  );
}
