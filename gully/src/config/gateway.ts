// USDC from Arbitrum Sepolia to Gully Chain Testnet through the canonical Arbitrum token bridge, on the dedicated
// USDC gateways (Circle Bridged USDC Standard, gully-ops l3/usdc). Checked on chain 2026-11-22: the L1 router sends
// the parent USDC to USDC_GATEWAY_L1, and the child router's calculateL2TokenAddress(USDC) is USDC.e.
// Testnet only: there is no mainnet USDC bridge yet.
import type { Address } from 'viem';

import { IS_TESTNET } from './network';

export interface UsdcGateway {
  /** L1GatewayRouter on Arbitrum Sepolia (the entry point; it finds the gateway for the token) */
  l1Router: Address;
  /** L1USDCGateway: holds the USDC (escrow) and is the contract that is approved */
  l1Gateway: Address;
  /** Circle USDC on Arbitrum Sepolia */
  parentUsdc: Address;
  /** USDC.e on Gully Chain, minted by the L2 USDC gateway */
  childUsdc: Address;
  /** the child-chain router, used to confirm that USDC maps to USDC.e */
  childRouter: Address;
  /** Circle's testnet faucet (choose Arbitrum Sepolia) */
  faucet: string;
}

export const USDC_GATEWAY: UsdcGateway | undefined = IS_TESTNET
  ? {
      l1Router: '0xfbd7503009AB4ee5A1f980a2fCDEE4C7BEB6b2B9',
      l1Gateway: '0xF904064BE100489a200EB754E591362C7Ced2D5b',
      parentUsdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      childUsdc: '0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76',
      childRouter: '0x32C680cA4c27A3566fE5Dfd4643fE420eE1039B7',
      faucet: 'https://faucet.circle.com/',
    }
  : undefined;

/** Seconds a USDC deposit takes: the retryable ticket auto-redeems on Gully Chain, usually 10 to 15 minutes. */
export const USDC_DEPOSIT_ETA = 12 * 60;
