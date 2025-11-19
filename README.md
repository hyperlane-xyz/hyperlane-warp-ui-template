# Pruv Bridge

Pruv Bridge is a Hyperlane-powered web application for moving fungible tokens and NFTs across the Pruv ecosystem and any other chains that expose Warp Routes. It layers UX niceties (wallet-aware guardrails, transfer history, compliance checks) on top of the canonical Hyperlane registry while still letting you inject custom routes, chains, branding, and fees.

## Contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Development workflow](#development-workflow)
- [Environment configuration](#environment-configuration)
- [Architecture & key folders](#architecture--key-folders)
- [Customization & feature flags](#customization--feature-flags)
- [Deployment](#deployment)
- [Troubleshooting & resources](#troubleshooting--resources)

## Highlights

- **Multi-protocol bridging** – Uses Hyperlane Warp Core to move assets between EVM, Cosmos, Solana, and Starknet chains with automatic routing, native chain swapping, and NFT token ID support (`src/features/transfer`).
- **Wallet-first UX** – RainbowKit/Wagmi, CosmosKit, Solana wallet adapters, and StarknetKit power chain-specific sessions. The floating sidebar shows connected wallets plus persisted transfer history with drill-down modals (`src/features/wallet`).
- **Compliance & risk controls** – Built-in address blacklist, OFAC JSON + Chainalysis Oracle checks, router-address guardrails, per-route disablement, and optional multi-collateral limits help stop bad transfers (`src/features/sanctions`, `src/features/limits`, `src/features/store`).
- **Registry + overrides** – Merge the published Hyperlane registry with local YAML/TS configs and even ad-hoc routes added from the UI, so you can ship fast without forking upstream data (`src/features/warpCore/warpCoreConfig.ts`).
- **Pruv-specific levers** – Configurable gasless destination chains, per-destination origin fees paid in USDC, and curated wallet allowlists ensure the bridge behaves the way Pruv needs (`src/consts/config.ts`).
- **Observability out of the box** – Opt-in Sentry instrumentation, structured logging, toast-based surfacing of failures, and durable local storage for unfinished transfers keep operators informed.

## Tech stack

- Next.js 15 + React 18, Tailwind, Chakra UI primitives, and custom design tokens.
- Wagmi / RainbowKit, CosmosKit, Solana wallet adapters, Starknet Kit, and WalletConnect v2 for accounts.
- Hyperlane SDK, utils, widgets, and registry packages (v16/v20).
- Formik, React Query, BigNumber.js, Zustand, and React Toastify for app state and UX.
- Vitest + Testing Library for unit/integration tests, ESLint 9 + Prettier for code quality.

## Requirements

- Node.js 20+ (the Docker image pins 22.14.0) with [Corepack](https://nodejs.org/api/corepack.html) enabled.
- Yarn 4.5 (auto-installed via Corepack).
- A WalletConnect Cloud project ID for `NEXT_PUBLIC_WALLET_CONNECT_ID`.
- (Optional) Access to a custom Hyperlane registry endpoint if you do not want to use the published package.

## Quick start

1. Duplicate the sample env file:
   ```sh
   cp .env.example .env.local
   ```
2. Edit `.env.local` and set `NEXT_PUBLIC_WALLET_CONNECT_ID` (and any other overrides you need).
3. Install dependencies and patch packages:
   ```sh
   yarn && yarn postinstall
   ```
4. Start the dev server:
   ```sh
   yarn dev
   ```
5. Visit `http://localhost:3000` and connect a wallet to try a bridge transfer.

### Running with Docker

```sh
docker compose up --build
```

The container exposes the Next.js server on port 3000. Provide env vars via `docker-compose.yaml` or `docker run -e` flags before building.

## Development workflow

| Command                       | Purpose                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `yarn dev`                    | Run Next.js with hot reload and debugging helpers.               |
| `yarn build`                  | Create an optimized production build (`.next`).                  |
| `yarn start`                  | Serve the production build locally.                              |
| `yarn lint` / `yarn lint:fix` | Check (or auto-fix) lint issues via ESLint.                      |
| `yarn typecheck`              | Run `tsc` in no-emit mode to verify types.                       |
| `yarn test`                   | Execute Vitest suites once (no watch).                           |
| `yarn test:coverage`          | Generate coverage reports (`coverage/`).                         |
| `yarn prettier`               | Format the `src` tree with Prettier + Tailwind plugin.           |
| `yarn clean`                  | Remove `.next`, `dist`, and `cache` artifacts for a clean slate. |

## Environment configuration

All env vars can be added to `.env.local` (for dev) or the hosting platform. The defaults live in `src/consts/config.ts`.

| Variable                                                   | Description                                                        | Default                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `NEXT_PUBLIC_WALLET_CONNECT_ID`                            | WalletConnect v2 project ID used by RainbowKit.                    | Required                      |
| `NEXT_PUBLIC_VERSION`                                      | Version label surfaced in the UI/logs.                             | `0.0.0`                       |
| `NEXT_PUBLIC_REGISTRY_URL` / `NEXT_PUBLIC_REGISTRY_BRANCH` | Point to a custom Hyperlane registry (and branch).                 | unset                         |
| `NEXT_PUBLIC_GITHUB_PROXY`                                 | Proxy used by `GithubRegistry` when fetching remote configs.       | `https://proxy.hyperlane.xyz` |
| `NEXT_PUBLIC_TRANSFER_BLACKLIST`                           | Comma-separated list of `origin-destination` CAIP IDs to block.    | unset                         |
| `NEXT_PUBLIC_CHAIN_WALLET_WHITELISTS`                      | JSON map of chain → allowed wallet names, used to warn users.      | `{}`                          |
| `NEXT_PUBLIC_RPC_OVERRIDES`                                | JSON object of RPC URLs per chain when you need bespoke endpoints. | unset                         |
| `NEXT_PUBLIC_SENTRY_DSN`                                   | Enables Sentry client + server instrumentation when provided.      | unset                         |

## Architecture & key folders

- `src/pages/index.tsx` – Entry point that renders the `TransferTokenCard`, helper tip, and floating action buttons.
- `src/features/transfer` – All transfer UX (Formik form, validation, fee quotes, NFT handling, recipient confirmations, modals, hooks, and tests).
- `src/features/wallet` – Wallet connect button, sidebar menu, connection warnings, and Zustand-backed transfer history UI.
- `src/features/chains` – Chain metadata assembly, selectors, wallet compatibility warnings, and multi-protocol provider hooks.
- `src/features/tokens` – Token selectors, ID inputs, approvals, balance hooks, and helpers for multi-collateral flows.
- `src/features/warpCore` – Assembles Warp Core configs by blending registry data, `warpRoutes.ts`, `warpRoutes.yaml`, and user-supplied overrides.
- `src/features/sanctions` & `src/features/limits` – Reusable guards for sanctioned addresses and per-route amount caps.
- `src/consts` – App-wide configuration (`config.ts`), registry/chain definitions, tip/branding toggles, and global lists (blacklist, warp route whitelist).
- `CUSTOMIZE.md` – Step-by-step guide for branding, token lists, chain metadata, and asset replacement.

## Customization & feature flags

- **Tokens & routes** – Update `src/consts/warpRoutes.ts` / `.yaml`, then gate visibility via `src/consts/warpRouteWhitelist.ts`. Users can also add configs at runtime if `config.showAddRouteButton` is true.
- **Chains** – Extend or override metadata in `src/consts/chains.ts|.yaml`, or let users add ad-hoc RPC info via the chain picker modal.
- **Branding** – Swap logos in `src/images/logos`, tweak Tailwind colors, and edit the hero tip copy inside `src/components/tip/TipCard.tsx`.
- **Feature toggles** – `src/consts/config.ts` centralizes flags for tip visibility, add-route button, disabled-chain behavior, wallet protocol allowlists, gasless destinations, Pruv origin fees (`pruvOriginFeeUSDC`), and the per-chain wallet allowlist surface.
- **Compliance knobs** – Adjust `ADDRESS_BLACKLIST`, `NEXT_PUBLIC_TRANSFER_BLACKLIST`, or `multiCollateralTokenLimits` to harden routes without redeploying.

## Deployment

1. Ensure production secrets (WalletConnect ID, registry URLs, RPC overrides, Sentry DSN, etc.) are available to your platform.
2. Build the app: `yarn build`.
3. Serve it with `yarn start` (Node server) or push to Vercel for a fully-managed deployment.
4. Container users can rely on the provided `Dockerfile`/`docker-compose.yaml` to build a standalone image that runs `node server.js` with the standalone Next output.

## Troubleshooting & resources

- If the UI loads without tokens, double-check your registry URL/branch and the `warpRouteWhitelist` (no routes ⇒ empty UI).
- Stuck transfers can be cleared via the “Reset transaction history” button in the sidebar; the store also auto-fails unfinished transfers on reload (`src/features/store.ts`).
- When testing new RPCs or registries, tail the browser console for `logger.debug` output to confirm data sources.
- Reference [CUSTOMIZE.md](./CUSTOMIZE.md) for detailed branding/token instructions and the official [Hyperlane Warp Route docs](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes) for protocol-level guidance.
