import { useFormikContext } from 'formik';
import { baseChain, CHAIN_NAMES, optimismChain, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { links } from '../../consts/links';
import { useEvmWalletBalance } from '../../features/tokens/balances';
import { getTokenByIndex, getTokenIndexFromChains, useWarpCore } from '../../features/tokens/hooks';
import { TransferFormValues } from '../../features/transfer/types';
import { updateQueryParam } from '../../utils/queryParams';
import { Card } from '../layout/Card';

export function TipCard() {
  const warpCore = useWarpCore();
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();

  const { balance: baseUsdcBalance } = useEvmWalletBalance(
    baseChain.chainName,
    baseChain.chainId,
    baseChain.token,
    values.origin === baseChain.chainName,
  );
  const { balance: opUsdtBalance } = useEvmWalletBalance(
    optimismChain.chainName,
    optimismChain.chainId,
    optimismChain.token,
    values.origin === optimismChain.chainName,
  );

  const hasBaseUsdcBalance = hasValidChainBalance(values.origin, CHAIN_NAMES.BASE, baseUsdcBalance);
  const hasOpUsdtBalance = hasValidChainBalance(values.origin, CHAIN_NAMES.OPTIMISM, opUsdtBalance);

  const handleSetCeloChain = () => {
    setFieldValue(WARP_QUERY_PARAMS.ORIGIN, CHAIN_NAMES.CELO);
    updateQueryParam(WARP_QUERY_PARAMS.ORIGIN, CHAIN_NAMES.CELO);

    const tokenIndex = getTokenIndexFromChains(
      warpCore,
      null,
      CHAIN_NAMES.CELO,
      values.destination,
    );
    const token = getTokenByIndex(warpCore, tokenIndex);
    updateQueryParam(WARP_QUERY_PARAMS.TOKEN, token?.addressOrDenom);
    setFieldValue('tokenIndex', tokenIndex);
  };

  if (!config.showTipBox) return null;

  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">Get OpenUSDT!</h2>
      <div className="flex items-end justify-between">
        <ul className="mt-1 list-disc text-xs">
          <li className={`${styles.list} cursor-pointer`} onClick={handleSetCeloChain}>
            Send USDT From Celo to get OpenUSDT on other chains
          </li>
          <li className={`${styles.list} ${hasOpUsdtBalance ? styles.highlighted : ''}`}>
            <a href={links.swapUsdtVelodrome} target="_blank" rel="noopener noreferrer">
              Swap OP Mainnet {optimismChain.tokenName} for OpenUSDT on Velodrome
            </a>
          </li>
          <li className={`${styles.list} ${hasBaseUsdcBalance ? styles.highlighted : ''}`}>
            <a href={links.swapUsdtAerodrome} target="_blank" rel="noopener noreferrer">
              Swap Base {baseChain.tokenName} for OpenUSDT on Aerodrome
            </a>
          </li>
        </ul>
      </div>
    </Card>
  );
}

function hasValidChainBalance(
  currentChain: string,
  targetChain: string,
  balance?: {
    value: bigint | undefined;
  },
) {
  if (currentChain !== targetChain || !balance || !balance.value) return false;

  return balance.value > 0;
}

const styles = {
  list: 'list-inside underline marker:text-primary-500 hover:text-blue-500',
  highlighted: 'text-primary-500 font-bold',
};
