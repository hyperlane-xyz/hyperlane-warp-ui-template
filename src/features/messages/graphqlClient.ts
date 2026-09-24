import { config } from '../../consts/config';

export type GraphQLResult<T> = { type: 'success'; data: T } | { type: 'error'; error: Error };

export async function executeGraphQLQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQLResult<T>> {
  try {
    const response = await fetch(config.explorerApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return { type: 'error', error: new Error(`HTTP error: ${response.status}`) };
    }

    const result = await response.json();

    const [err] = result.errors ?? [];
    if (err) {
      return { type: 'error', error: new Error(err.message) };
    }

    return { type: 'success', data: result.data };
  } catch (err) {
    return { type: 'error', error: err instanceof Error ? err : new Error('Unknown error') };
  }
}
