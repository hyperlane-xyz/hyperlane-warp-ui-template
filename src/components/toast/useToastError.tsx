import { errorToString } from '@hyperlane-xyz/utils';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { logger } from '../../utils/logger';

export function useToastError(error: any, errorMsg?: string) {
  useEffect(() => {
    if (!error) return;
    const message = errorMsg || errorToString(error, 500);
    logger.error(message, error);
    toast.error(errorMsg);
  }, [error, errorMsg]);
}
