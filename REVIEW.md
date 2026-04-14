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
- **Keep lazy boundaries lazy** - Don’t move runtime-only helpers/classes to module scope if it turns a dynamic import into a static import
- **Protocol opt-in over all-VM wrappers** - Hot paths should import only the protocols they need, but avoid replacing one generic wrapper with unnecessary local map/switch layers when direct protocol hooks/utilities are enough

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
- **Flatten rendering logic** - Avoid nested if; use early returns instead
- **Zustand patterns** - Follow existing store patterns in `src/features/store.ts`
- **Constants outside functions** - Move config/constants outside component functions
- **Use `assert` for invariants** - Unexpected impossible states/config mismatches should fail loudly instead of silently falling through
