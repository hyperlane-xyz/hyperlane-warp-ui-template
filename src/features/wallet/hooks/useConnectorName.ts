import { useAccount } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { AccountInfo } from './types';

function useEvmConnectorName(accountInfo: AccountInfo | undefined) {
  const account = useAccount();

  if (
    account.connector instanceof InjectedConnector &&
    accountInfo?.connectorName === account.connector.name
  ) {
    if (window.ethereum?.isOkxWallet || window.ethereum?.isOKExWallet)
      if (window.ethereum?.isBackpack) return 'Backpack';
    if (window.ethereum?.isFrame) return 'Frame';
    if (window.ethereum?.isPhantom) return 'Phantom';

    const keys = Object.keys({ ...window.ethereum });
    if (keys.includes('isOkxWallet') || keys.includes('isOKExWallet')) {
      return 'OKX';
    }
  }

  return account.connector?.name;
}

export function useConnectorName(account: AccountInfo | undefined) {
  const evmConnectorName = useEvmConnectorName(account);

  if (account?.protocol === ProtocolType.Ethereum && evmConnectorName) {
    return evmConnectorName;
  }

  return account?.connectorName || 'Wallet';
}
