import { Token } from '@hyperlane-xyz/sdk';
import { PlusIcon } from '@hyperlane-xyz/widgets';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { logger } from '../../utils/logger';
import { useAddToken } from './hooks';

const USER_REJECTED_ERROR = 'User rejected';

interface ImportTokenButtonProps {
  token?: Token;
}

export function ImportTokenButton({ token }: ImportTokenButtonProps) {
  const { addToken, canAddAsset, isLoading } = useAddToken(token);

  const handleAddToken = useCallback(async () => {
    try {
      await addToken();
    } catch (error: any) {
      const errorDetails = error.message || error.toString();
      if (!errorDetails.includes(USER_REJECTED_ERROR)) toast.error(errorDetails);
      logger.debug(error);
    }
  }, [addToken]);

  if (!canAddAsset) return null;

  return (
    <button
      type="button"
      className="flex items-center text-sm text-primary-500 hover:text-primary-700 disabled:opacity-50 [&_path]:fill-primary-500 [&_path]:hover:fill-primary-700"
      onClick={handleAddToken}
      disabled={isLoading}
    >
      <PlusIcon width={18} height={18} className="-mr-0.5" />
      <span>Add token to Wallet</span>
    </button>
  );
}
