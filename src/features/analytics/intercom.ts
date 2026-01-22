import Intercom from '@intercom/messenger-js-sdk';
import { logger } from '../../utils/logger';

export const INTERCOM_APP_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID || '';

let isInitialized = false;

/**
 * Initialize Intercom messenger widget
 * Should be called once when the app loads
 */
export function initIntercom(): void {
  if (typeof window === 'undefined' || !INTERCOM_APP_ID || isInitialized) return;

  try {
    Intercom({
      // eslint-disable-next-line camelcase
      app_id: INTERCOM_APP_ID,
      alignment: 'left',
    });
    isInitialized = true;
  } catch (error) {
    logger.warn('Failed to initialize Intercom:', error);
  }
}
