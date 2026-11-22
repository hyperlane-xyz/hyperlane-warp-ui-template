import { decodeAbiParameters } from 'viem';
import { describe, expect, it } from 'vitest';

import type { McRoute } from '../config/multichain';
import type { UsdcGateway } from '../config/gateway';
import { DEFAULT_SOURCES, pickOption, tokenOptions, type LaneSources } from './lanes';
import { dataLength, depositArgs, routerExtraData, sizeRetryable } from './usdcGateway';

const g: UsdcGateway = {
  l1Router: '0xfbd7503009AB4ee5A1f980a2fCDEE4C7BEB6b2B9',
  l1Gateway: '0xF904064BE100489a200EB754E591362C7Ced2D5b',
  parentUsdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  childUsdc: '0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76',
  childRouter: '0x32C680cA4c27A3566fE5Dfd4643fE420eE1039B7',
  faucet: 'https://faucet.circle.com/',
};
const tok = (symbol: string, decimals: number, collateral: string | null) => ({
  address: null, standard: null, tokenType: 'collateral', symbol, name: symbol, decimals, collateralAddress: collateral,
});
const usdc = (deployed: boolean): McRoute => ({
  id: 'USDC/x', key: 'USDC', symbol: 'USDC', name: 'USD Coin', deployed,
  tokens: { arbitrumsepolia: tok('USDC', 6, g.parentUsdc), gullychaintestnet: tok('USDC', 6, g.childUsdc) },
});
const src = (deployed: boolean, gw: UsdcGateway | undefined): LaneSources => ({
  classic: [], defaultClassicId: '', multichain: [usdc(deployed)], canonicalChains: ['arbitrumsepolia'], usdcGateway: gw,
});

describe('USDC gateway option', () => {
  it('is live on Arbitrum Sepolia deposits: USDC -> USDC.e, 6 decimals', () => {
    const [o] = tokenOptions('arbitrumsepolia', 'deposit', src(false, g));
    expect(o.gateway).toBe(true);
    expect(o.live).toBe(true);
    expect(o.send.symbol).toBe('USDC');
    expect(o.send.collateralAddress).toBe(g.parentUsdc);
    expect(o.receive.symbol).toBe('USDC.e');
    expect(o.receive.address).toBe(g.childUsdc);
    expect(pickOption([o])?.gateway).toBe(true);
  });
  it('withdrawals stay "soon" (no claim flow yet)', () => {
    const [o] = tokenOptions('arbitrumsepolia', 'withdraw', src(false, g));
    expect(o.gateway).toBeUndefined();
    expect(o.live).toBe(false);
  });
  it('a deployed Hyperlane USDC route, or no gateway config, uses the normal route', () => {
    expect(tokenOptions('arbitrumsepolia', 'deposit', src(true, g))[0].gateway).toBeUndefined();
    expect(tokenOptions('arbitrumsepolia', 'deposit', src(false, undefined))[0].live).toBe(false);
  });
  it('the default (testnet) sources carry the gateway', () => {
    expect(DEFAULT_SOURCES.usdcGateway?.l1Gateway).toBe(g.l1Gateway);
  });
});

describe('retryable sizing and deposit args', () => {
  it('sizes like gully-ops l3/usdc/lib.mjs', () => {
    const c = sizeRetryable({ estimatedGas: 200_000n, childGasPrice: 100n, submissionFee: 1000n });
    expect(c.gasLimit).toBe(400_000n);
    expect(c.maxFeePerGas).toBe(300n);
    expect(c.maxSubmissionCost).toBe(3000n);
    expect(c.value).toBe(3000n + 400_000n * 300n);
  });
  it('never goes under 300k gas, and falls back to it without an estimate', () => {
    expect(sizeRetryable({ estimatedGas: 10n, childGasPrice: 1n, submissionFee: 1n }).gasLimit).toBe(300_000n);
    expect(sizeRetryable({ childGasPrice: 1n, submissionFee: 1n }).gasLimit).toBe(300_000n);
  });
  it('encodes extra data as (maxSubmissionCost, empty bytes)', () => {
    const [cost, bytes] = decodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], routerExtraData(12345n));
    expect(cost).toBe(12345n);
    expect(bytes).toBe('0x');
  });
  it('deposits the parent USDC to the recipient, refunding the sender', () => {
    const cost = sizeRetryable({ childGasPrice: 1n, submissionFee: 1n });
    const a = depositArgs(g, { refundTo: '0x0000000000000000000000000000000000000001', to: '0x0000000000000000000000000000000000000002', amount: 5_000_000n, cost });
    expect(a.slice(0, 6)).toEqual([g.parentUsdc, '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002', 5_000_000n, cost.gasLimit, cost.maxFeePerGas]);
  });
  it('counts bytes', () => expect(dataLength('0x0102')).toBe(2n));
});
