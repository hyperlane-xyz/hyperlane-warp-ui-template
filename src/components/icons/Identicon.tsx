import jazzicon from '@metamask/jazzicon';
import { memo } from 'react';

import { isValidAddressEvm, normalizeAddressEvm } from '@hyperlane-xyz/utils';
import { Circle } from '@hyperlane-xyz/widgets';

type Props = {
  address?: string;
  size?: number;
};

// This should match metamask: https://github.com/MetaMask/metamask-extension/blob/master/ui/helpers/utils/icon-factory.js#L84
function addressToSeed(address: string) {
  const addrStub = normalizeAddressEvm(address).slice(2, 10);
  return parseInt(addrStub, 16);
}

// TODO move to widgets lib
function _Identicon({ address, size: _size }: Props) {
  const size = _size ?? 34;

  // TODO better handling of non-evm addresses here
  if (!address || !isValidAddressEvm(address)) {
    return <Circle size={size} classes="bg-blue-500" title="" />;
  }

  const jazziconResult = jazzicon(size, addressToSeed(address));

  return (
    <div
      style={{ height: size }}
      ref={(nodeElement) => {
        if (nodeElement) {
          nodeElement.innerHTML = '';
          nodeElement.appendChild(jazziconResult);
        }
      }}
    ></div>
  );
}

export const Identicon = memo(_Identicon);
