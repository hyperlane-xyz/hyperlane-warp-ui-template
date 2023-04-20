// TODO move to hyperlane/utils package
import { logger } from './logger';

export function toBase64(data: any): string | undefined {
  try {
    if (!data) throw new Error('No data to encode');
    return btoa(JSON.stringify(data));
  } catch (error) {
    logger.error('Unable to serialize + encode data to base64', data);
    return undefined;
  }
}

export function fromBase64<T>(data: string | string[]): T | undefined {
  try {
    if (!data) throw new Error('No data to decode');
    const msg = Array.isArray(data) ? data[0] : data;
    return JSON.parse(atob(msg));
  } catch (error) {
    logger.error('Unable to decode + deserialize data from base64', data);
    return undefined;
  }
}
