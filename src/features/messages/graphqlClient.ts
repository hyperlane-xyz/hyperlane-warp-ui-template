const EXPLORER_API_URL = 'https://explorer4.hasura.app/v1/graphql';

export async function executeGraphQLQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; error?: Error }> {
  try {
    const response = await fetch(EXPLORER_API_URL, {
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
