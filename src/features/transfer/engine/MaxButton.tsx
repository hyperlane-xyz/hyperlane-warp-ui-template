import { SpinnerIcon } from '@hyperlane-xyz/widgets';

interface Props {
  onClick: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function MaxButton({ onClick, isLoading, disabled }: Props) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={isDisabled}
      className="transfer-max-btn rounded border border-gray-300 px-2 py-0.5 font-secondary text-sm text-gray-450 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-300/40 dark:text-foreground-secondary dark:hover:border-primary-300/65 dark:hover:text-foreground-primary"
    >
      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : 'Max'}
    </button>
  );
}
