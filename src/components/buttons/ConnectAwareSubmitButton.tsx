import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useFormikContext } from 'formik';
import { useCallback } from 'react';
import { useAccount } from 'wagmi';

import { useTimeout } from '../../utils/timeout';

import { SolidButton } from './SolidButton';

interface Props {
  text: string;
  classes?: string;
}

export function ConnectAwareSubmitButton<FormValues = any>({ text, classes }: Props) {
  const { address, isConnected, connector } = useAccount();
  const { openConnectModal } = useConnectModal();

  const isAccountReady = !!(address && isConnected && connector);

  const { errors, setErrors, touched, setTouched } = useFormikContext<FormValues>();

  const hasError = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  const color = hasError ? 'red' : 'blue';
  const content = hasError ? firstError : isAccountReady ? text : 'Connect Wallet';
  const type = isAccountReady ? 'submit' : 'button';
  const onClick = isAccountReady ? undefined : openConnectModal;

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
