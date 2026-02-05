import { config } from '../../consts/config';

export async function executeGraphQLQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: Error }> {
  try {
    const response = await fetch(config.explorerApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return { error: new Error(`HTTP error: ${response.status}`) };
    }

    const result = await response.json();

    if (result.errors?.length) {
      return { error: new Error(result.errors[0].message) };
    }

    return { data: result.data };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}
