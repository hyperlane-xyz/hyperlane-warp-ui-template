import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { messageSnapshotSchema } from './queries/fragments';

export async function fetchMessages(
  request: { query: string; variables: Record<string, unknown> },
  signal: AbortSignal,
) {
  try {
    const response = await fetch(config.explorerApiUrl, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(result.errors[0].message);
    return messageSnapshotSchema.parse(result.data).message_view;
  } catch (error) {
    if (!signal.aborted) logger.error('Failed to fetch message status', error);
    throw error;
  }
}
