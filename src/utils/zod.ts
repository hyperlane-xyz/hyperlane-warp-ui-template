import { SafeParseReturnType } from 'zod';
import { logger } from './logger';

// TODO move to utils package
export function validateZodResult<T>(
  result: SafeParseReturnType<T, T>,
  desc: string = 'config',
): T {
  if (!result.success) {
    logger.warn(`Invalid ${desc}`, result.error);
    throw new Error(`Invalid desc: ${result.error.toString()}`);
  } else {
    return result.data;
  }
}
