# AGENTS.md

**Be extremely concise. Sacrifice grammar for concision. Terse responses preferred. No fluff.**

This file provides guidance to AI coding assistants when working with code in this repository.

## Project Overview

Hyperlane Warp UI Template is a Next.js web application for cross-chain token transfers using [Hyperlane Warp Routes](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes). It enables permissionless bridging of tokens between any supported blockchain.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

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
- **Wallets**: Each blockchain uses distinct, composable wallet providers (EVM/RainbowKit, Solana, Cosmos, Starknet, Radix)
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
- `NEXT_PUBLIC_WALLET_CONNECT_ID` - **Required** for wallet connections
- `NEXT_PUBLIC_REGISTRY_URL` - **Optional** custom Hyperlane registry URL
- `NEXT_PUBLIC_RPC_OVERRIDES` - **Optional** JSON map of chain RPC overrides

## Customization

See `CUSTOMIZE.md` for detailed customization instructions:
- **Warp Routes**: `src/consts/warpRoutes.yaml` + `warpRouteWhitelist.ts`
- **Chains**: `src/consts/chains.yaml` or `chains.ts`
- **Branding**: `src/consts/app.ts`, `tailwind.config.js`, logo files in `src/images/logos/`
- **Feature Flags**: `src/consts/config.ts` (showTipBox, showAddRouteButton, etc.)

## Testing

Tests use Vitest and are co-located with source files using the `*.test.ts` naming convention. Vitest automatically discovers and runs all matching test files.

```bash
# Run all tests
pnpm test

# Run a single test file
pnpm vitest src/features/transfer/fees.test.ts

# Run tests in watch mode
pnpm vitest --watch
```

## Engineering Philosophy

### Keep It Simple
We handle ONLY the most important cases. Don't add functionality unless it's small or absolutely necessary.

### Error Handling
- **Expected issues** (external systems, user input): Use explicit error handling, try/catch at boundaries
- **Unexpected issues** (invalid state, broken invariants): Fail loudly with `throw` or `console.error`
- **NEVER** add silent fallbacks for unexpected issues - they mask bugs

### Backwards-Compatibility
| Change Location | Backwards-Compat? | Rationale |
|-----------------|-------------------|-----------|
| Local/uncommitted | No | Iteration speed; no external impact |
| In main unreleased | Preferred | Minimize friction for other developers |
| Released | Required | Prevent breaking downstream integrations |

## Code Review

For code review guidelines, see `.github/prompts/code-review.md`.

## Tips for AI Coding Sessions

1. **Run tests incrementally** - `pnpm vitest <file>` for specific test files
2. **Check existing patterns** - Search codebase for similar implementations
3. **Use SDK types** - Import from `@hyperlane-xyz/sdk`, don't redefine
4. **Zustand for state** - Global state in `src/features/store.ts`
5. **Keep changes minimal** - Only modify what's necessary; avoid scope creep
6. **Feature folders** - Domain logic in `src/features/`, not scattered
7. **Chain-aware addresses** - Only lowercase EVM addresses; Solana/Cosmos are case-sensitive
8. **Check src/utils/** - Functions like `normalizeAddress`, `isNullish` already exist
9. **CSP updates** - New external scripts need `next.config.js` CSP header updates
10. **useQuery patterns** - Use built-in `refetch`, don't create custom refresh state
11. **Flatten conditionals** - Use early returns instead of nested if/else in JSX

## Verify Before Acting

**Always search the codebase before assuming.** Don't hallucinate file paths, function names, or patterns.

- `grep` or search before claiming "X doesn't exist"
- Read the actual file before suggesting changes to it
- Check `git log` or blame before assuming why code exists
- Verify imports exist in `package.json` before using them

## When the AI Gets It Wrong

If output seems wrong, check:

1. **Did I read the actual file?** Or did I assume its contents?
2. **Did I search for existing patterns?** The codebase likely has examples
3. **Am I using stale context?** Re-read files that may have changed
4. **Did I verify the error message?** Run the command and read actual output
