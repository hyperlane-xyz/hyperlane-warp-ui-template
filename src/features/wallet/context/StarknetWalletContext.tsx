import { Chain } from '@starknet-react/chains';
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core';
import { PropsWithChildren } from 'react';

// temporary using const sepolia chain
const sepolia: Chain = {
  id: BigInt('0x534e5f5345504f4c4941'),
  network: 'sepolia',
  name: 'Starknet Sepolia Testnet',
  nativeCurrency: {
    address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  testnet: true,
  rpcUrls: {
    blast: {
      http: ['https://starknet-sepolia.blastapi.io'],
    },
    infura: {
      http: ['https://starknet-sepolia.infura.io/v3'],
    },
    nethermind: {
      http: ['https://rpc.nethermind.io/sepolia-juno'],
    },
    reddio: {
      http: ['https://starknet-sepolia.reddio.com'],
    },
    cartridge: {
      http: ['https://api.cartridge.gg/x/starknet/sepolia'],
    },
    default: {
      http: [],
    },
    public: {
      http: [
        'https://starknet-sepolia.public.blastapi.io',
        'https://free-rpc.nethermind.io/sepolia-juno',
      ],
    },
  },
  explorers: {
    starkscan: ['https://sepolia.starkscan.co'],
    voyager: ['https://sepolia.voyager.online'],
  },
};

export function StarknetWalletContext({ children }: PropsWithChildren<unknown>) {
  return (
    <StarknetConfig chains={[sepolia]} provider={publicProvider()} explorer={voyager}>
      {children}
    </StarknetConfig>
  );
}
