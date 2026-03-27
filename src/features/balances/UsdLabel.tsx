import type { TokenAmount } from '@hyperlane-xyz/sdk/token/TokenAmount';

import { getUsdDisplayForFee } from './feeUsdDisplay';
import type { FeePrices } from './useFeePrices';

export function UsdLabel({
  tokenAmount,
  feePrices,
}: {
  tokenAmount?: TokenAmount;
  feePrices: FeePrices;
}) {
  const usd = getUsdDisplayForFee(tokenAmount, feePrices);
  if (!usd) return null;
  return <span className="ml-1 text-gray-500">{usd}</span>;
}
