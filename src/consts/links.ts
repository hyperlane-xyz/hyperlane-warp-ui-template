import { baseChain, openUsdtTokenAddress, optimismChain } from './args';

export const links = {
  home: 'https://www.hyperlane.xyz',
  explorer: 'https://explorer.hyperlane.xyz',
  discord: 'https://discord.gg/VK9ZUy3aTV',
  github: 'https://github.com/hyperlane-xyz/hyperlane-warp-ui-template',
  docs: 'https://docs.hyperlane.xyz',
  warpDocs: 'https://docs.hyperlane.xyz/docs/reference/applications/warp-routes',
  gasDocs: 'https://docs.hyperlane.xyz/docs/reference/hooks/interchain-gas',
  chains: 'https://docs.hyperlane.xyz/docs/resources/domains',
  twitter: 'https://x.com/hyperlane',
  blog: 'https://medium.com/hyperlane',
  tos: 'https://hyperlane.xyz/terms-of-service',
  privacyPolicy: 'https://hyperlane.xyz/privacy-policy',
  bounty:
    'https://github.com/search?q=org:hyperlane-xyz+label:bounty+is:open+is:issue&type=issues&s=&o=desc',
  swapUsdtVelodrome: `https://velodrome.finance/swap?from=${optimismChain.token}&to=${openUsdtTokenAddress}&chain0=${optimismChain.chainId}&chain1=${optimismChain.chainId}`,
  swapUsdtAerodrome: `https://aerodrome.finance/swap?from=${baseChain.token}&to=${openUsdtTokenAddress}&chain0=${baseChain.chainId}&chain1=${baseChain.chainId}`,
};
