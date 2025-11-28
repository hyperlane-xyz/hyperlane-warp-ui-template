import { useAccountForChain, useTimeout } from '@hyperlane-xyz/widgets';
import { useAccounts as useBtcAccounts } from '@midl-xyz/midl-js-react';
import { useFormikContext } from 'formik';
import { useCallback } from 'react';
import { useMultiProvider } from '../../features/chains/hooks';
import { useStore } from '../../features/store';
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
  const multiProvider = useMultiProvider();
  const account = useAccountForChain(multiProvider, chainName);

  // Check Bitcoin wallet status
  const { isConnected: isBtcConnected } = useBtcAccounts();

  // Account is ready if either protocol account is ready OR Bitcoin wallet is connected
  const isAccountReady = account?.isReady || isBtcConnected;

  // Get wallet type select modal control
  const { setShowEnvSelectModal } = useStore((s) => ({
    setShowEnvSelectModal: s.setShowEnvSelectModal,
  }));

  const { errors, setErrors, touched, setTouched } = useFormikContext<FormValues>();

  const hasError = Object.keys(touched).length > 0 && Object.keys(errors).length > 0;
  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  const color = hasError ? 'red' : 'violet';
  const content = hasError ? firstError : isAccountReady ? text : 'Connect Wallet';
  const type =
    disabled || !isAccountReady
      ? 'button' // never submits when deliberately disabled
      : 'submit';

  const onClick = () => {
    if (isAccountReady) return undefined;

    // Open wallet type select modal to let user choose between EVM and Bitcoin
    setShowEnvSelectModal(true);
  };

  // Automatically clear error state after a timeout
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrors, setTouched, errors, touched]);

  useTimeout(clearErrors, 3500);

  return (
    <SolidButton
      disabled={disabled}
      type={type}
      color={color}
      onClick={onClick}
      className={classes}
    >
      {content}
    </SolidButton>
  );
}
