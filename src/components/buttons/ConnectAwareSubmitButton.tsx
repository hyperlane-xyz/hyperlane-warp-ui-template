import { useFormikContext } from 'formik';
import { useCallback } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { tryGetProtocolType } from '../../features/caip/chains';
import { useAccountForChain, useConnectFns } from '../../features/wallet/hooks';
import { useTimeout } from '../../utils/timeout';

import { SolidButton } from './SolidButton';

interface Props {
  chainCaip2Id: ChainCaip2Id;
  text: string;
  classes?: string;
}

export function ConnectAwareSubmitButton<FormValues = any>({ chainCaip2Id, text, classes }: Props) {
  const protocol = tryGetProtocolType(chainCaip2Id) || ProtocolType.Ethereum;
  const connectFns = useConnectFns();
  const connectFn = connectFns[protocol];

  const account = useAccountForChain(chainCaip2Id);
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

  useTimeout(clearErrors, 3000);

  return (
    <SolidButton type={type} color={color} onClick={onClick} classes={classes}>
      {content}
    </SolidButton>
  );
}
