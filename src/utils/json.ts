export function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch (e) {
    console.warn('unable to parse JSON', e);
    return null;
  }
}
