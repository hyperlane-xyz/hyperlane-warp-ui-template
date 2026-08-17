import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useFormikContext } from 'formik';
import { formatUnits } from 'viem';

import type { UiToken } from '../../tokens/types';
import type { TransferFormValues } from './types';

interface Props {
  balance?: bigint;
  isLoading?: boolean;
  disabled?: boolean;
  token?: UiToken;
  onMax?: (balance: bigint, token: UiToken) => void;
}

export function MaxButton({ balance, isLoading, disabled, token, onMax }: Props) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const isDisabled = disabled || isLoading || balance == null || balance <= 0n || !token;

  const onClick = () => {
    if (isDisabled || balance == null || !token) return;
    if (onMax) onMax(balance, token);
    else setFieldValue('amount', formatUnits(balance, token.decimals));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="transfer-max-btn rounded border border-gray-300 px-2 py-0.5 font-secondary text-sm text-gray-450 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-300/40 dark:text-foreground-secondary dark:hover:border-primary-300/65 dark:hover:text-foreground-primary"
    >
      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : 'Max'}
    </button>
  );
}
