Review this pull request. Focus on:

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

## Testing

- Test coverage for new/modified code
- Edge cases that should be tested
- **New utility functions need unit tests**

## Performance

- Gas efficiency (for Solidity changes)
- Unnecessary allocations or computations

## Frontend-Specific

- **Use existing utilities** - Check `src/utils/` before adding (normalizeAddress, etc.)
- **Chain-aware addresses** - Only lowercase EVM hex; Solana/Cosmos are case-sensitive
- **CSP updates required** - New external scripts/styles need `next.config.js` CSP updates
- **Avoid floating promises** - In useEffect, use IIFE or separate async function
- **Use useQuery refetch** - Don't reinvent; use built-in refetch from TanStack Query
- **Flatten rendering logic** - Avoid nested if; use early returns instead
- **Zustand patterns** - Follow existing store patterns in `src/features/store.ts`
- **Constants outside functions** - Move config/constants outside component functions

Provide actionable feedback with specific line references.
Be concise. For minor style issues, group them together.
Security issues are handled by a separate dedicated review.
