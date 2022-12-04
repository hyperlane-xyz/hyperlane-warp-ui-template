import Image from 'next/image';
import { memo } from 'react';
import { chain } from 'wagmi';

import {
  alfajoresChain,
  auroraTestnetChain,
  avalancheChain,
  bscChain,
  bscTestnetChain,
  celoMainnetChain,
  fujiTestnetChain,
  moonbaseAlphaChain,
  moonbeamChain,
} from '../../consts/chains';
import QuestionMark from '../../images/icons/question-mark.svg';
import ArbitrumColor from '../../images/logos/chains-color/arbitrum.svg';
import AvalancheColor from '../../images/logos/chains-color/avalanche.svg';
import BscColor from '../../images/logos/chains-color/bsc.svg';
import CeloColor from '../../images/logos/chains-color/celo.svg';
import EthereumColor from '../../images/logos/chains-color/ethereum.svg';
import MoonbeamColor from '../../images/logos/chains-color/moonbeam.png';
import OptimismColor from '../../images/logos/chains-color/optimism.svg';
import PolygonColor from '../../images/logos/chains-color/polygon.svg';
import ArbitrumMono from '../../images/logos/chains-mono/arbitrum.svg';
import AvalancheMono from '../../images/logos/chains-mono/avalanche.svg';
import BscMono from '../../images/logos/chains-mono/bsc.svg';
import CeloMono from '../../images/logos/chains-mono/celo.svg';
import EthereumMono from '../../images/logos/chains-mono/ethereum.svg';
import MoonbeamMono from '../../images/logos/chains-mono/moonbeam.svg';
import Near from '../../images/logos/chains-mono/near.svg';
import OptimismMono from '../../images/logos/chains-mono/optimism.svg';
import PolygonMono from '../../images/logos/chains-mono/polygon.svg';
import { getChainDisplayName } from '../../utils/chains';

// Keep up to date as new chains are added or
// icon will fallback to default
const CHAIN_TO_MONOCHROME_ICON = {
  // Prod chains
  [chain.mainnet.id]: EthereumMono,
  [chain.arbitrum.id]: ArbitrumMono,
  [chain.optimism.id]: OptimismMono,
  [chain.polygon.id]: PolygonMono,
  [avalancheChain.id]: AvalancheMono,
  [bscChain.id]: BscMono,
  [celoMainnetChain.id]: CeloMono,
  [moonbeamChain.id]: MoonbeamMono,

  // Test chains
  [chain.goerli.id]: EthereumMono,
  [chain.arbitrumGoerli.id]: ArbitrumMono,
  [chain.optimismGoerli.id]: OptimismMono,
  [chain.polygonMumbai.id]: PolygonMono,
  [fujiTestnetChain.id]: AvalancheMono,
  [bscTestnetChain.id]: BscMono,
  [alfajoresChain.id]: CeloMono,
  [auroraTestnetChain.id]: Near,
  [moonbaseAlphaChain.id]: MoonbeamMono,
};

const CHAIN_TO_COLOR_ICON = {
  // Prod chains
  [chain.mainnet.id]: EthereumColor,
  [chain.arbitrum.id]: ArbitrumColor,
  [chain.optimism.id]: OptimismColor,
  [chain.polygon.id]: PolygonColor,
  [avalancheChain.id]: AvalancheColor,
  [bscChain.id]: BscColor,
  [celoMainnetChain.id]: CeloColor,
  [moonbeamChain.id]: MoonbeamColor,

  // Test chains
  [chain.goerli.id]: EthereumColor,
  [chain.arbitrumGoerli.id]: ArbitrumColor,
  [chain.optimismGoerli.id]: OptimismColor,
  [chain.polygonMumbai.id]: PolygonColor,
  [fujiTestnetChain.id]: AvalancheColor,
  [bscTestnetChain.id]: BscColor,
  [alfajoresChain.id]: CeloColor,
  [auroraTestnetChain.id]: Near,
  [moonbaseAlphaChain.id]: MoonbeamColor,
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
