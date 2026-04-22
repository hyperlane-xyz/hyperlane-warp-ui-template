# Code Review Guidelines

## Code Quality

- Logic errors and potential bugs
- Error handling and edge cases
- Code clarity and maintainability
- Adherence to existing patterns in the codebase
- **Use existing utilities** - Search codebase before adding new helpers
- **Prefer `??` over `||`** - Preserves zero/empty string as valid values

## Architecture

- Consistency with existing architecture patterns
- Breaking changes or backward compatibility issues
- API contract changes
- **Deduplicate** - Move repeated code/types to shared files
- **Extract utilities** - Shared functions belong in utils packages
- **Keep lazy boundaries lazy** - Don't hoist runtime-only helpers/classes to module scope if it turns a dynamic import into a static import
- **Metadata-first before runtime-first** - If a read path only needs metadata, don't force `warpCore`/runtime just to keep an older API shape
- **Render-safe vs imperative runtime access** - Render paths should observe readiness (`useReadyWarpCore`, `useReadyMultiProvider`); async action paths should explicitly call `ensureWarpRuntime()`
- **Protocol opt-in over all-VM wrappers** - Hot paths should import only the protocols they need; avoid both fat all-VM wrappers and unnecessary local map/switch indirection
- **Prefer narrow public subpaths** - On hot/render-critical paths, prefer specific `@hyperlane-xyz/sdk/*` and `@hyperlane-xyz/widgets/*` subpaths over root barrels when equivalent exports exist

## Testing

- Test coverage for new/modified code
- Edge cases that should be tested
- **New utility functions need unit tests**

## Performance

- Unnecessary re-renders or computations
- Bundle size impact of new dependencies

## Frontend-Specific

- **Use existing utilities** - Check `src/utils/` before adding (normalizeAddress, etc.)
- **Chain-aware addresses** - Only lowercase EVM hex; Solana/Cosmos are case-sensitive
- **CSP updates required** - New external scripts/styles need `next.config.js` CSP updates
- **Avoid floating promises** - In useEffect, use IIFE or separate async function
- **Lazy import caches must retry** - Promise caches around dynamic imports/loaders must clear themselves on rejection
- **Use useQuery refetch** - Don't reinvent; use built-in refetch from TanStack Query
- **Version async rebuilds** - If runtime/provider state can rebuild, include readiness/version in query keys and `enabled` guards instead of caching against a truthy object reference
- **Use route tokens for route identity** - Address/router/connection-sensitive lookups should use raw `routeTokens`; use deduplicated `tokens` only for picker/read surfaces where route identity is not required
- **Flatten rendering logic** - Avoid nested if; use early returns instead
- **Zustand patterns** - Follow existing store patterns in `src/features/store.ts`
- **Constants outside functions** - Move config/constants outside component functions
- **Use `assert` for invariants** - Unexpected impossible states/config mismatches should fail loudly instead of silently falling through
