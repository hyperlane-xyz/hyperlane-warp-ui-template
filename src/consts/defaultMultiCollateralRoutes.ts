import { DefaultMultiCollateralRoutes } from '../features/tokens/types';

// Default multi-collateral warp route configuration
// Maps: chainName -> collateralAddress -> warpRouteAddressOrDenom
//
// For ERC20/collateralized tokens:
//   { "ethereum": { "0xUSDC...": "0xWarpRoute..." } }
//
// For native tokens (HypNative), use 'native' as the key:
//   { "ethereum": { "native": "0xWarpRoute..." } }
export const defaultMultiCollateralRoutes: DefaultMultiCollateralRoutes | undefined = {
  arbitrum: {
    // USDC
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': '0xAd4350Ee0f9f5b85BaB115425426086Ae8384ebb',
    // ETH
    native: '0xbcDAA686CD93188527A6020ba3D75f926f9e3c92',
    //USDT
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': '0x42B794FbF2Ae97d7E9001e21D36B0A5595B51B11',
  },
  avalanche: {
    // USDC:
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': '0x252833ad2daa5BCb7C251Aa8E12ce97D6Bd4765E',
  },
  base: {
    // USDC
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': '0x37e637891A558B5b621723cbf8Fc771525f280C1',
    // ETH
    native: '0xD3b9dDaC349E808B07845e01bae3Bf3464FB45b3',
  },
  bsc: {
    // USDC
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': '0x1eebF9d94a5E707E30f18b9aB3295D963C111fb7',
    //USDT
    '0x55d398326f99059fF775485246999027B3197955': '0xc13d466B9E196AfdE472856923E857cc298EDf1b',
  },
  ethereum: {
    // USDC
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0xe1De9910fe71cC216490AC7FCF019e13a34481D7',
    // ETH
    native: '0x7DCA030594C6695fc24b874917d0beAA38715639',
    //USDT
    '0xdac17f958d2ee523a2206206994597c13d831ec7': '0x647C621CEb36853Ef6A907E397Adf18568E70543',
  },
  hyperevm: {
    // USDC
    '0xb88339CB7199b77E23DB6E890353E22632Ba630f': '0xA1B10De5b3A131B02bcE94864943426d901d98B5',
  },
  ink: {
    // USDC
    '0x2D270e6886d130D724215A266106e6832161EAEd': '0x0DE665377A5B0D390469d0ea0FCae55e0c14f4c4',
  },
  katana: {
    // USDC
    '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36': '0x680e8ECB908A2040232ef139A0A52cbE47b9F15B',
  },
  linea: {
    // USDC
    '0x176211869cA2b568f2A7D4EE941E073a821EE1ff': '0x34eaC2132BB041B3F789cC7B5665dAbdF6ac3f12',
  },
  monad: {
    //USDC
    '0x754704Bc059F8C67012fEd69BC8A327a5aafb603': '0xC2e074F6AeC27c39FA9423E2D5752C31a7b0a75E',
  },
  optimism: {
    // USDC
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': '0x02bFd67829317D666dc7dFA030F18eaCC12c2cfb',
    // ETH
    native: '0xEF096995d7C4FE68abF9C96042521A61bEdd596D',
  },
  plasma: {
    //USDT
    '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb': '0xa119087116aDC61ade063105644795cb7BC0009D',
  },
  polygon: {
    // USDC
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': '0xCb9F833f4d6D9Bb9767CDb25c487DA54D67731D6',
  },
  solanamainnet: {
    // USDC
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: '3EpVCPUgyjq2MfGeCttyey6bs5zya5wjYZ2BE6yDg6bm',
    // USDT
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'Bk79wMjvpPCh5iQcCEjPWFcG1V2TfgdwaBsWBEYFYSNU',
  },
  tron: {
    '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c': '0xbf8078818627110fD05827Ca0aa9E4518d3421ec',
  },
  unichain: {
    // USDC
    '0x078D782b760474a361dDA0AF3839290b0EF57AD6': '0xa7E4dC4078bAc6e97Eec52a4F7642fF51cbb17C1',
  },
  worldchain: {
    //USDC
    '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1': '0x485dE5Aa437d46B925D800929CcCA587e6e9d2c3',
  },
};
