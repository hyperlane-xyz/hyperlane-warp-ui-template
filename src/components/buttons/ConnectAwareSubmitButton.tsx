import { ProtocolType } from '@hyperlane-xyz/utils';
import { useTimeout } from '@hyperlane-xyz/widgets/utils/timeout';
import { useFormikContext } from 'formik';
import { useCallback } from 'react';

import { EVENT_NAME } from '../../features/analytics/types';
import { trackEvent } from '../../features/analytics/utils';
import { useChainProtocol, useMultiProvider } from '../../features/chains/hooks';
import { ProtocolWalletBridge } from '../../features/wallet/ProtocolWalletBridge';
import { SolidButton } from './SolidButton';

interface Props {
  chainName: ChainName;
  text: string;
  classes?: string;
  disabled?: boolean;
}

export function ConnectAwareSubmitButton<FormValues = any>({
  chainName,
  text,
  classes,
  disabled,
}: Props) {
  const protocol = useChainProtocol(chainName) || ProtocolType.Ethereum;
  const multiProvider = useMultiProvider();
  const { errors, setErrors, touched, setTouched } = useFormikContext<FormValues>();

  const hasError = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  // Automatically clear error state after a timeout
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrors, setTouched, errors, touched]);

  useTimeout(clearErrors, 3500);

  return (
    <ProtocolWalletBridge
      protocol={protocol}
      multiProvider={multiProvider}
      chainName={chainName}
    >
      {({ account, connectFn }) => {
        const isAccountReady = account?.isReady;
        const color = hasError ? 'red' : 'accent';
        const content = hasError ? firstError : isAccountReady ? text : 'Connect wallet';
        const type = disabled || !isAccountReady ? 'button' : 'submit';

        const onClick = () => {
          if (isAccountReady) return undefined;
          trackEvent(EVENT_NAME.WALLET_CONNECTION_INITIATED, { protocol });
          connectFn?.();
        };

        return (
          <SolidButton
            disabled={disabled && isAccountReady}
            type={type}
            color={color}
            onClick={onClick}
            className={classes}
          >
            {content}
          </SolidButton>
        );
      }}
    </ProtocolWalletBridge>
  );
}
