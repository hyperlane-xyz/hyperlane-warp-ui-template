import { TokenType } from '@hyperlane-xyz/sdk';

import { SOL_ZERO_ADDRESS } from '../../consts/values';

import { computeTokenRoutes } from './routes';

describe('computeTokenRoutes', () => {
  it('Handles empty list', () => {
    const routesMap = computeTokenRoutes([]);
    expect(routesMap).toBeTruthy();
    expect(Object.values(routesMap).length).toBe(0);
  });

  it('Handles basic 3-node route', () => {
    const routesMap = computeTokenRoutes([
      {
        type: TokenType.collateral,
        tokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
        routerAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
        name: 'Weth',
        symbol: 'WETH',
        decimals: 18,
        hypTokens: [
          {
            decimals: 18,
            chain: 'ethereum:11155111',
            router: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
          },
          {
            decimals: 18,
            chain: 'ethereum:44787',
            router: '0xEcbc0faAA269Cf649AC8950838664BB7B355BD6C',
          },
        ],
      },
    ]);
    expect(routesMap).toEqual({
      'ethereum:5': {
        'ethereum:11155111': [
          {
            type: 'collateralToSynthetic',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:5',
            originRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originDecimals: 18,
            destCaip2Id: 'ethereum:11155111',
            destRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            destDecimals: 18,
          },
        ],
        'ethereum:44787': [
          {
            type: 'collateralToSynthetic',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:5',
            originRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originDecimals: 18,
            destCaip2Id: 'ethereum:44787',
            destRouterAddress: '0xEcbc0faAA269Cf649AC8950838664BB7B355BD6C',
            destDecimals: 18,
          },
        ],
      },
      'ethereum:11155111': {
        'ethereum:5': [
          {
            type: 'syntheticToCollateral',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:11155111',
            originRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            originDecimals: 18,
            destCaip2Id: 'ethereum:5',
            destRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            destDecimals: 18,
          },
        ],
        'ethereum:44787': [
          {
            type: 'syntheticToSynthetic',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:11155111',
            originRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            originDecimals: 18,
            destCaip2Id: 'ethereum:44787',
            destRouterAddress: '0xEcbc0faAA269Cf649AC8950838664BB7B355BD6C',
            destDecimals: 18,
          },
        ],
      },
      'ethereum:44787': {
        'ethereum:5': [
          {
            type: 'syntheticToCollateral',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:44787',
            originRouterAddress: '0xEcbc0faAA269Cf649AC8950838664BB7B355BD6C',
            originDecimals: 18,
            destCaip2Id: 'ethereum:5',
            destRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            destDecimals: 18,
          },
        ],
        'ethereum:11155111': [
          {
            type: 'syntheticToSynthetic',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:44787',
            originRouterAddress: '0xEcbc0faAA269Cf649AC8950838664BB7B355BD6C',
            originDecimals: 18,
            destCaip2Id: 'ethereum:11155111',
            destRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            destDecimals: 18,
          },
        ],
      },
    });
  });

  it('Handles multi-collateral route', () => {
    const routesMap = computeTokenRoutes([
      {
        type: TokenType.collateral,
        tokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
        routerAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
        name: 'Weth',
        symbol: 'WETH',
        decimals: 18,
        hypTokens: [
          {
            decimals: 18,
            chain: 'ethereum:11155111',
            router: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
          },
          {
            decimals: 6,
            chain: 'sealevel:1399811151',
            router: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
          },
        ],
      },
      {
        type: TokenType.native,
        tokenCaip19Id: `sealevel:1399811151/native:${SOL_ZERO_ADDRESS}`,
        routerAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
        name: 'Zebec',
        symbol: 'ZBC',
        decimals: 6,
        hypTokens: [
          {
            decimals: 18,
            chain: 'ethereum:11155111',
            router: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
          },
          {
            decimals: 18,
            chain: 'ethereum:5',
            router: '0x145de8760021c4ac6676376691b78038d3DE9097',
          },
        ],
      },
    ]);
    expect(routesMap).toEqual({
      'ethereum:5': {
        'ethereum:11155111': [
          {
            type: 'collateralToSynthetic',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:5',
            originRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originDecimals: 18,
            destCaip2Id: 'ethereum:11155111',
            destRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            destDecimals: 18,
          },
        ],
        'sealevel:1399811151': [
          {
            type: 'collateralToCollateral',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:5',
            originRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originDecimals: 18,
            destCaip2Id: 'sealevel:1399811151',
            destRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            destDecimals: 6,
            destTokenCaip19Id:
              'sealevel:1399811151/native:00000000000000000000000000000000000000000000',
          },
        ],
      },
      'ethereum:11155111': {
        'ethereum:5': [
          {
            type: 'syntheticToCollateral',
            baseTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
            baseRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            originCaip2Id: 'ethereum:11155111',
            originRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            originDecimals: 18,
            destCaip2Id: 'ethereum:5',
            destRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            destDecimals: 18,
          },
        ],
        'sealevel:1399811151': [
          {
            type: 'syntheticToCollateral',
            baseTokenCaip19Id:
              'sealevel:1399811151/native:00000000000000000000000000000000000000000000',
            baseRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            originCaip2Id: 'ethereum:11155111',
            originRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            originDecimals: 18,
            destCaip2Id: 'sealevel:1399811151',
            destRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            destDecimals: 6,
          },
        ],
      },
      'sealevel:1399811151': {
        'ethereum:5': [
          {
            type: 'collateralToCollateral',
            baseTokenCaip19Id:
              'sealevel:1399811151/native:00000000000000000000000000000000000000000000',
            baseRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            originCaip2Id: 'sealevel:1399811151',
            originRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            originDecimals: 6,
            destCaip2Id: 'ethereum:5',
            destRouterAddress: '0x145de8760021c4ac6676376691b78038d3DE9097',
            destDecimals: 18,
            destTokenCaip19Id: 'ethereum:5/erc20:0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
          },
        ],
        'ethereum:11155111': [
          {
            type: 'collateralToSynthetic',
            baseTokenCaip19Id:
              'sealevel:1399811151/native:00000000000000000000000000000000000000000000',
            baseRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            originCaip2Id: 'sealevel:1399811151',
            originRouterAddress: 'PJH5QAbxAqrrnSXfH3GHR8icua8CDFZmo97z91xmpvx',
            originDecimals: 6,
            destCaip2Id: 'ethereum:11155111',
            destRouterAddress: '0xDcbc0faAA269Cf649AC8950838664BB7B355BD6B',
            destDecimals: 18,
          },
        ],
      },
    });
  });
});
