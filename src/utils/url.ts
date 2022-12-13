export function isValidHttpsUrl(urlString: string | null | undefined) {
  try {
    return urlString && Boolean(new URL(urlString)) && urlString.substring(0, 8) === 'https://';
  } catch (e) {
    return false;
  }
}
