import { logger } from './logger';

export function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch (e) {
    logger.warn('unable to parse JSON', e);
    return null;
  }
}
