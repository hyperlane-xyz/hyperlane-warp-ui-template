import jazzicon from '@metamask/jazzicon';
import { CSSProperties, memo } from 'react';

import { isValidEvmAddressFast, normalizeEvmAddress } from '../../utils/addresses';

type Props = {
  address?: string;
  size?: number;
  styles?: CSSProperties;
};

// This should match metamask: https://github.com/MetaMask/metamask-extension/blob/master/ui/helpers/utils/icon-factory.js#L84
function addressToSeed(address: string) {
  const addrStub = normalizeEvmAddress(address).slice(2, 10);
  return parseInt(addrStub, 16);
}

function _Identicon({ address, size: _size, styles }: Props) {
  const size = _size ?? 34;

  if (!address || !isValidEvmAddressFast(address)) {
    return (
      <div
        style={{ height: size, width: size, ...styles }}
        className="bg-blue-500 rounded-full"
      ></div>
    );
  }

  const jazziconResult = jazzicon(size, addressToSeed(address));

  return (
    <div
      style={{ height: size, ...styles }}
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
