// React 19's renderToString writes the resource hints it collects (an <img> above the fold becomes
// <link rel="preload" as="image">) at the START of its output, because a string render has no <head> to put them in.
// Spliced into <div id="root">, they are the root's first children; the client tree starts with <div class="a ...">,
// so hydrateRoot hit a <link> where it expected the app and threw minified React error #418 (args HTML) on every load
// of the landing (live sweep 2026-11-11). Moving them to <head> keeps the preloads and makes the root match.

/** Splits the leading <link ...> tags off a renderToString result: { head: the links, body: the rest }. Pure. */
export function splitLeadingLinks(html) {
  const m = /^(?:\s*<link\b[^>]*>)+/i.exec(html);
  if (!m) return { head: '', body: html };
  return { head: m[0].trim(), body: html.slice(m[0].length) };
}

/** Puts the app markup into the page: links before </head>, the rest at the marker. */
export function placeApp(page, appHtml, marker = '<!--gb-app-->') {
  const { head, body } = splitLeadingLinks(appHtml);
  let out = page.replace(marker, () => body);
  if (head) out = out.replace('</head>', () => `${head}</head>`);
  return out;
}
