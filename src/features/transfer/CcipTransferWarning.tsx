import { HookType } from '@hyperlane-xyz/sdk';
import { fromWei, objKeys } from '@hyperlane-xyz/utils';
import BigNumber from 'bignumber.js';
import { useMemo, useState } from 'react';
import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { useStore } from '../store';
import { getTokenByIndex, useWarpCore } from '../tokens/hooks';

export function CcipTransferWarning({
  amount,
  origin,
  destination,
  tokenIndex,
}: {
  amount: string;
  origin: ChainName;
  destination: ChainName;
  tokenIndex: number | undefined;
}) {
  const [confirm, setConfirm] = useState(false);
  const warpCore = useWarpCore();
  const { warpDeployConfig } = useStore((s) => ({
    warpDeployConfig: s.warpDeployConfig,
  }));

  const { isVisible } = useMemo(() => {
    let isVisible = false;
    const token = getTokenByIndex(warpCore, tokenIndex);

    if (objKeys(warpDeployConfig).includes(origin) && token) {
      const chain = warpDeployConfig[origin];
      const hook = chain.hook;
      if (
        hook &&
        typeof hook !== 'string' &&
        hook.type === HookType.FALLBACK_ROUTING &&
        objKeys(hook.domains).includes(destination)
      ) {
        const domain = hook.domains[destination];

        if (typeof domain !== 'string' && domain.type === HookType.AMOUNT_ROUTING) {
          const threshold = fromWei(domain.threshold, token.decimals);
          if (BigNumber(amount).toNumber() > BigNumber(threshold).toNumber()) isVisible = true;
        }
      }
    }

    setConfirm(false);
    return { isVisible };
  }, [amount, warpDeployConfig, origin, destination, warpCore, tokenIndex]);

  const onClickChange = () => setConfirm(true);

  return (
    <FormWarningBanner isVisible={isVisible && !confirm} cta="Understood" onClick={onClickChange}>
      Amount is above the threshold, transfer via CCIP will be used and will be subject to a longer
      delay
    </FormWarningBanner>
  );
}
