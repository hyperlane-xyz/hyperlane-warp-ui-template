<<<<<<< HEAD
import { useFormikContext } from 'formik';
import { CHAIN_NAMES, WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { useStore } from '../../features/store';
import { getTokenByIndex, getTokenIndexFromChains, useWarpCore } from '../../features/tokens/hooks';
import { TransferFormValues } from '../../features/transfer/types';
import { updateQueryParam } from '../../utils/queryParams';
import { Card } from '../layout/Card';
=======
import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';

import { config } from '../../consts/config';
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
    <div className="tip-card relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24 dark:bg-gradient-to-t dark:from-primary-500/30 dark:to-[#111]/95 dark:shadow-lg dark:ring-1 dark:ring-inset dark:ring-primary-500/50">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600 dark:text-foreground-secondary dark:hover:text-foreground-primary dark:[&_path]:fill-current"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
>>>>>>> origin/main
      </div>

      <h2 className="pr-6 font-secondary text-lg font-normal text-gray-900 dark:text-white">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-foreground-muted">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-secondary text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-primary-500/80 dark:bg-primary-500/20 dark:text-white dark:hover:bg-primary-500/30"
      >
        <Image src={InfoCircle} width={12} alt="" className="dark:invert" />
        <span>More</span>
      </a>

      <div className="tip-card-logo pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}

const styles = {
  list: 'list-inside underline marker:text-primary-500 hover:text-blue-500',
  highlighted: 'text-primary-500 font-bold',
};
