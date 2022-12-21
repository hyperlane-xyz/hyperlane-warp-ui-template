import Image from 'next/image';
import { memo } from 'react';

import { chainMetadata } from '@hyperlane-xyz/sdk';
import ArbitrumMono from '@hyperlane-xyz/sdk/logos/black/arbitrum.svg';
import AvalancheMono from '@hyperlane-xyz/sdk/logos/black/avalanche.svg';
import BscMono from '@hyperlane-xyz/sdk/logos/black/bsc.svg';
import CeloMono from '@hyperlane-xyz/sdk/logos/black/celo.svg';
import EthereumMono from '@hyperlane-xyz/sdk/logos/black/ethereum.svg';
import MoonbeamMono from '@hyperlane-xyz/sdk/logos/black/moonbeam.svg';
import OptimismMono from '@hyperlane-xyz/sdk/logos/black/optimism.svg';
import PolygonMono from '@hyperlane-xyz/sdk/logos/black/polygon.svg';
import ArbitrumColor from '@hyperlane-xyz/sdk/logos/color/arbitrum.svg';
import AvalancheColor from '@hyperlane-xyz/sdk/logos/color/avalanche.svg';
import BscColor from '@hyperlane-xyz/sdk/logos/color/bsc.svg';
import CeloColor from '@hyperlane-xyz/sdk/logos/color/celo.svg';
import EthereumColor from '@hyperlane-xyz/sdk/logos/color/ethereum.svg';
import MoonbeamColor from '@hyperlane-xyz/sdk/logos/color/moonbeam.svg';
import OptimismColor from '@hyperlane-xyz/sdk/logos/color/optimism.svg';
import PolygonColor from '@hyperlane-xyz/sdk/logos/color/polygon.svg';

import QuestionMark from '../../images/icons/question-mark.svg';
import { getChainDisplayName } from '../../utils/chains';

// Keep up to date as new chains are added or
// icon will fallback to default
const CHAIN_TO_MONOCHROME_ICON = {
  [chainMetadata.alfajores.id]: CeloMono,
  [chainMetadata.arbitrum.id]: ArbitrumMono,
  [chainMetadata.arbitrumgoerli.id]: ArbitrumMono,
  [chainMetadata.avalanche.id]: AvalancheMono,
  [chainMetadata.bsc.id]: BscMono,
  [chainMetadata.bsctestnet.id]: BscMono,
  [chainMetadata.celo.id]: CeloMono,
  [chainMetadata.ethereum.id]: EthereumMono,
  [chainMetadata.fuji.id]: AvalancheMono,
  [chainMetadata.goerli.id]: EthereumMono,
  [chainMetadata.moonbasealpha.id]: MoonbeamMono,
  [chainMetadata.moonbeam.id]: MoonbeamMono,
  [chainMetadata.mumbai.id]: PolygonMono,
  [chainMetadata.optimism.id]: OptimismMono,
  [chainMetadata.optimismgoerli.id]: OptimismMono,
  [chainMetadata.polygon.id]: PolygonMono,
};

const CHAIN_TO_COLOR_ICON = {
  [chainMetadata.alfajores.id]: CeloColor,
  [chainMetadata.arbitrum.id]: ArbitrumColor,
  [chainMetadata.arbitrumgoerli.id]: ArbitrumColor,
  [chainMetadata.avalanche.id]: AvalancheColor,
  [chainMetadata.bsc.id]: BscColor,
  [chainMetadata.bsctestnet.id]: BscColor,
  [chainMetadata.celo.id]: CeloColor,
  [chainMetadata.ethereum.id]: EthereumColor,
  [chainMetadata.fuji.id]: AvalancheColor,
  [chainMetadata.goerli.id]: EthereumColor,
  [chainMetadata.moonbasealpha.id]: MoonbeamColor,
  [chainMetadata.moonbeam.id]: MoonbeamColor,
  [chainMetadata.mumbai.id]: PolygonColor,
  [chainMetadata.optimism.id]: OptimismColor,
  [chainMetadata.optimismgoerli.id]: OptimismColor,
  [chainMetadata.polygon.id]: PolygonColor,
};

interface Props {
  chainId?: number;
  size?: number;
  color?: boolean;
  background?: boolean;
}

function _ChainIcon({ chainId, size = 32, color = true, background = false }: Props) {
  const iconSet = color ? CHAIN_TO_COLOR_ICON : CHAIN_TO_MONOCHROME_ICON;
  const imageSrc = (chainId && iconSet[chainId]) || QuestionMark;

  if (background) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className="flex items-center justify-center rounded-full bg-gray-100 transition-all"
        title={getChainDisplayName(chainId)}
      >
        <Image
          src={imageSrc}
          alt=""
          width={Math.floor(size / 1.8)}
          height={Math.floor(size / 1.8)}
        />
      </div>
    );
  } else {
    return <Image src={imageSrc} alt="" width={size} height={size} />;
  }
}

export const ChainIcon = memo(_ChainIcon);
