import { formatBalance } from './balances/utils';
import type { UiToken } from './tokens/types';

// "Balance: 1.23 ETH" — renders "—" while balance is loading.
export function TokenBalance({
  label,
  balance,
  token,
}: {
  label: string;
  balance: bigint | null | undefined;
  token: UiToken | undefined;
}) {
  return (
    <span className="text-xs leading-[18px] text-gray-450 dark:text-foreground-secondary">
      {balance != null && token ? (
        <>
          {label}: {formatBalance(balance, token.decimals)} {token.symbol}
        </>
      ) : (
        <>{label}: —</>
      )}
    </span>
  );
}
