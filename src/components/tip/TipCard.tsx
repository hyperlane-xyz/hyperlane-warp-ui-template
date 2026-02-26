import { useFormikContext } from 'formik';
import { CHAIN_NAMES, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
<<<<<<< HEAD
import { useStore } from '../../features/store';
import { getTokenByIndex, getTokenIndexFromChains, useWarpCore } from '../../features/tokens/hooks';
import { TransferFormValues } from '../../features/transfer/types';
import { updateQueryParam } from '../../utils/queryParams';
import { Card } from '../layout/Card';
=======
import { links } from '../../consts/links';
import InfoCircle from '../../images/icons/info-circle.svg';
import { HyperlaneTransparentLogo } from '../icons/HyperlaneTransparentLogo';
>>>>>>> origin/main

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
<<<<<<< HEAD
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
=======
    <div className="relative w-100 overflow-hidden rounded bg-tip-card-gradient px-3 pb-3 pt-3 shadow-card sm:w-[31rem] sm:px-4 sm:pb-4 sm:pt-4">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
>>>>>>> origin/main
      </div>

      <h2 className="pr-6 font-secondary text-sm font-normal text-gray-900 sm:text-lg">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-1 text-xs text-gray-600 sm:mt-2 sm:text-sm">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1 font-secondary text-xs text-gray-700 transition-colors hover:bg-gray-50 sm:mt-3 sm:px-3 sm:py-1.5 sm:text-sm"
      >
        <Image src={InfoCircle} width={12} alt="" />
        <span>More</span>
      </a>

      <div className="pointer-events-none absolute -bottom-0 left-1/2 -translate-x-1/2 opacity-40">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}

const styles = {
  list: 'list-inside underline marker:text-primary-500 hover:text-blue-500',
  highlighted: 'text-primary-500 font-bold',
};
