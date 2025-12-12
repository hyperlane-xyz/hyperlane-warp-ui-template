/**
 * Extracts fulfilled values from Promise.allSettled results, filtering out rejected and null values.
 */
export function getPromisesFulfilledValues<T>(results: PromiseSettledResult<T | null>[]): T[] {
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v) => v != null);
}
