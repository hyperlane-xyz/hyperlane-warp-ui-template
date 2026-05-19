import { SpinnerIcon } from '@hyperlane-xyz/widgets';
import { useFormikContext } from 'formik';

import { formatBalance } from './balances/utils';
import type { UiToken } from './tokens/types';
import type { SwapFormValues } from './types';

interface Props {
  balance?: bigint;
  isLoading?: boolean;
  disabled?: boolean;
  token?: UiToken;
}

// Sets the amount field to the connected wallet's full balance.
// Approximates "max" as the raw balance; gas reservation can be layered
// in later.
export function MaxButton({ balance, isLoading, disabled, token }: Props) {
  const { setFieldValue } = useFormikContext<SwapFormValues>();
  const isDisabled = disabled || isLoading || balance == null || !token;

  const onClick = () => {
    if (isDisabled || balance == null || !token) return;
    setFieldValue('amount', formatBalance(balance, token.decimals));
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
