# Hyperliquid Core transfers

This note scopes how Nexus can add Hyperliquid Core deposit and withdrawal flows on top of the existing HyperEVM warp routes.

## Boundary model

HyperEVM is already available as a Hyperlane chain, so the open work is the HyperCore <> HyperEVM boundary:

- Hyperliquid read precompiles are not a transfer path. They expose Core state to HyperEVM contracts.
- CoreWriter is the HyperEVM -> HyperCore write path. A contract calling CoreWriter can enqueue Core actions for that contract's own Core account.
- HyperCore -> HyperEVM does not call arbitrary EVM calldata. It credits the linked EVM asset through the protocol transfer path.
- HyperEVM -> HyperCore for generic linked spot assets is token-specific. For USDC, use Circle's `CoreDepositWallet.depositFor` so the adapter can credit the user's Core account.

## Supported product shapes

### Deposit into Hyperliquid Core

The clean first target is USDC:

1. User bridges USDC to HyperEVM through the existing warp route.
2. The HyperEVM recipient is either the user for a manual second leg, or a future adapter contract for a one-click flow.
3. The second leg approves Circle's CoreDepositWallet and calls `depositFor(user, amount, destinationDex)`.

Generic linked spot assets need more care. Sending from an adapter to a token system address may credit the adapter's Core account, not the user's Core account, unless the asset exposes a recipient-aware deposit path similar to USDC.

### Withdraw out of Hyperliquid Core

There is no direct HyperCore -> warp-route call path.

The practical staged flow is:

1. User signs a Hyperliquid Core action that brings the linked asset to the same address on HyperEVM.
2. Once the EVM balance is credited, Nexus uses the existing HyperEVM warp route as the second leg.

A future adapter can support contract-owned liquidity by recording an intent, calling CoreWriter for the adapter's Core account, waiting for the HyperEVM credit, then calling the warp route. It cannot pull arbitrary user Core balances.

## UI implications

- Treat Hyperliquid Core transfers as staged flows, not ordinary one-call warp routes.
- Keep the destination DEX explicit: `0` for perps and `uint32.max` for spot.
- Do not imply atomicity across Core <> EVM.
- Only advertise one-click adapter support for assets with recipient-aware Core deposit semantics.
