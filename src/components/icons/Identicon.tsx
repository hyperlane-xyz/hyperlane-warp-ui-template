import jazzicon from '@metamask/jazzicon';
import { memo } from 'react';

import { Circle } from '@hyperlane-xyz/widgets';

import { isEvmAddress, normalizeEvmAddress } from '../../utils/addresses';

type Props = {
  address?: string;
  size?: number;
};

// This should match metamask: https://github.com/MetaMask/metamask-extension/blob/master/ui/helpers/utils/icon-factory.js#L84
function addressToSeed(address: string) {
  const addrStub = normalizeEvmAddress(address).slice(2, 10);
  return parseInt(addrStub, 16);
}

function _Identicon({ address, size: _size }: Props) {
  const size = _size ?? 34;

  if (!address || !isEvmAddress(address)) {
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
