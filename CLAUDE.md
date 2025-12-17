# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperlane Warp UI Template is a Next.js web application for cross-chain token transfers using [Hyperlane Warp Routes](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes). It enables permissionless bridging of tokens between any supported blockchain.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # Production build
pnpm test             # Run tests (vitest)
pnpm lint             # ESLint check
pnpm typecheck        # TypeScript type checking
pnpm prettier         # Format code with Prettier
pnpm clean            # Remove build artifacts (dist, cache, .next)
```

## Architecture

### Stack
- **Framework**: Next.js 15 with React 18
- **Styling**: Tailwind CSS + Chakra UI
- **State**: Zustand with persist middleware (`src/features/store.ts`)
- **Queries**: TanStack Query
- **Wallets**: Multi-protocol support via context providers (EVM/RainbowKit, Solana, Cosmos, Starknet, Radix)
- **Core Libraries**: `@hyperlane-xyz/sdk`, `@hyperlane-xyz/registry`, `@hyperlane-xyz/widgets`

### Key Directories

- `src/features/` - Core domain logic organized by feature:
  - `transfer/` - Token transfer flow (form, validation, execution via `useTokenTransfer`)
  - `tokens/` - Token selection, balances, approvals
  - `chains/` - Chain metadata, selection UI
  - `wallet/` - Multi-protocol wallet context providers
  - `warpCore/` - WarpCore configuration assembly
  - `store.ts` - Global Zustand store managing WarpContext, transfers, UI state

- `src/consts/` - Configuration files:
  - `config.ts` - App configuration (feature flags, registry settings)
  - `warpRoutes.yaml` - Warp route token definitions
  - `chains.yaml` / `chains.ts` - Custom chain metadata
  - `app.ts` - App branding (name, colors, fonts)

- `src/components/` - Reusable UI components
- `src/pages/` - Next.js pages (main UI at `index.tsx`)

### Data Flow

1. **Initialization**: `WarpContextInitGate` loads registry and assembles `WarpCore` from warp route configs
2. **State Hydration**: Zustand store rehydrates persisted state (chain overrides, transfer history)
3. **Transfer Flow**: `TransferTokenForm` → `useTokenTransfer` → `WarpCore.getTransferRemoteTxs()` → wallet transaction

### Configuration

Environment variables (see `.env.example`):
- `NEXT_PUBLIC_WALLET_CONNECT_ID` - Required for wallet connections
- `NEXT_PUBLIC_REGISTRY_URL` - Custom Hyperlane registry URL
- `NEXT_PUBLIC_RPC_OVERRIDES` - JSON map of chain RPC overrides

## Customization

See `CUSTOMIZE.md` for detailed customization instructions:
- **Warp Routes**: `src/consts/warpRoutes.yaml` + `warpRouteWhitelist.ts`
- **Chains**: `src/consts/chains.yaml` or `chains.ts`
- **Branding**: `src/consts/app.ts`, `tailwind.config.js`, logo files in `src/images/logos/`
- **Feature Flags**: `src/consts/config.ts` (showTipBox, showAddRouteButton, etc.)

## Testing

Tests use Vitest and are co-located with source files (`*.test.ts`). Run a single test file:
```bash
pnpm vitest src/features/transfer/fees.test.ts
```
