# Code Review Guidelines

## Always flag
- XSS vulnerabilities: unsanitized user input rendered in the DOM
- Secrets, private keys, or API keys committed in code or logs
- Introduction of `as` type assertions, `as any`, `as unknown as X`, or `!` non-null assertions
- Silent error swallowing (empty catch blocks or catch-and-ignore)
- Token amount or balance calculations without proper decimal handling
- Missing input validation on transfer parameters (addresses, amounts)
- New external script/resource URLs without CSP header updates in `next.config.js`
- State mutations outside of Zustand store actions
- Direct wallet interactions bypassing WarpCore abstraction
- Address handling that doesn't account for multi-protocol differences (EVM lowercase vs Solana/Cosmos case-sensitive)
- Changes to transfer flow (`useTokenTransfer`) without corresponding test updates
- New dependencies added without justification

## Never flag
- Formatting or style issues (handled by prettier and eslint)
- Missing documentation or comments on self-evident code
- Existing patterns that are intentional (check git history if unsure)
- Minor naming preferences when existing convention is followed
- Tailwind class ordering (handled by prettier plugin)
- Import ordering

## Skip these paths
- `node_modules/`
- `.next/`
- `dist/`
- `*.lock` files
- `public/` static assets
- `examples/` directory
