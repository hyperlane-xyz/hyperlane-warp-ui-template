import { useFormikContext } from 'formik';
import { CHAIN_NAMES, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { useStore } from '../../features/store';
import { getTokenByIndex, getTokenIndexFromChains, useWarpCore } from '../../features/tokens/hooks';
import { TransferFormValues } from '../../features/transfer/types';
import { updateQueryParam } from '../../utils/queryParams';
import { Card } from '../layout/Card';

export function TipCard() {
  const warpCore = useWarpCore();
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const setOriginChainName = useStore((s) => s.setOriginChainName);

  const handleSetOriginChain = (chainName: string) => {
    setFieldValue(WARP_QUERY_PARAMS.ORIGIN, chainName);
    updateQueryParam(WARP_QUERY_PARAMS.ORIGIN, chainName);
    setOriginChainName(chainName);

    const tokenIndex = getTokenIndexFromChains(warpCore, null, chainName, values.destination);
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
          <li
            className={`${styles.list} cursor-pointer`}
            onClick={() => handleSetOriginChain(CHAIN_NAMES.ETHEREUM)}
          >
            Send USDT From Ethereum to get OpenUSDT on other chains
          </li>
          <li
            className={`${styles.list} cursor-pointer`}
            onClick={() => handleSetOriginChain(CHAIN_NAMES.CELO)}
          >
            Send USDT From Celo to get OpenUSDT on other chains
          </li>
        </ul>
      </div>
    </Card>
  );
}

const styles = {
  list: 'list-inside underline marker:text-primary-500 hover:text-blue-500',
  highlighted: 'text-primary-500 font-bold',
};
