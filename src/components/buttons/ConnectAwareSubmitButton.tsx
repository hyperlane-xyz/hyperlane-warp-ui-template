import { useFormikContext } from 'formik';
import { useCallback } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { tryGetChainProtocol } from '../../features/chains/utils';
import { useAccountForChain, useConnectFns } from '../../features/wallet/hooks/multiProtocol';
import { useTimeout } from '../../utils/timeout';

import { SolidButton } from './SolidButton';

interface Props {
  chainName: ChainName;
  text: string;
  classes?: string;
}

export function ConnectAwareSubmitButton<FormValues = any>({ chainName, text, classes }: Props) {
  const protocol = tryGetChainProtocol(chainName) || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  const account = useAccountForChain(chainName);
  const isAccountReady = account?.isReady;

  const { errors, setErrors, touched, setTouched } = useFormikContext<FormValues>();

  const hasError = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  const color = hasError ? 'red' : 'pink';
  const content = hasError ? firstError : isAccountReady ? text : 'Connect Wallet';
  const type = isAccountReady ? 'submit' : 'button';
  const onClick = isAccountReady ? undefined : connectFn;

  // Automatically clear error state after a timeout
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrors, setTouched, errors, touched]);

  useTimeout(clearErrors, 3500);

  return (
    <SolidButton type={type} color={color} onClick={onClick} classes={classes}>
      {content}
    </SolidButton>
  );
}
