# Runtime Entrypoints Beta Benchmark

Date: 2026-03-25

Branch: `pbio/beta-runtime-entrypoints-ui`

Monorepo dependency PR: `hyperlane-monorepo#8433`

UI beta packages:

- `@hyperlane-xyz/sdk@29.1.0-beta.d79a1d21d733e77a5fb10b8fc952e6a70838fa36`
- `@hyperlane-xyz/utils@29.1.0-beta.d79a1d21d733e77a5fb10b8fc952e6a70838fa36`
- `@hyperlane-xyz/widgets@29.1.0-beta.d79a1d21d733e77a5fb10b8fc952e6a70838fa36`

Build command:

```bash
/usr/bin/time -p pnpm build
```

Typecheck command:

```bash
pnpm typecheck
```

## Summary

- Beta monorepo packages reduced first-load JS from `19.3 MB` to `18.8 MB`.
- App-side `widgets` subpath imports removed all root `@hyperlane-xyz/widgets` imports (`60 -> 0`).
- App-side import rewrite materially improved build time on the beta packages.
- Bundle size barely moved after the app-side rewrite, so the remaining bottleneck is still eager VM/provider loading in the SDK/store path, not the widgets root barrel.

## Measurements

| State | Build time | Compile time | Shared first-load JS | `_app` chunk | `/` first load |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stable baseline (`3c0fb51d`) | `73.48s` | `57s` | `19.3 MB` | `19.2 MB` | `19.3 MB` |
| Beta packages only | `104.89s` | `86s` | `18.8 MB` | `18.7 MB` | `18.8 MB` |
| Beta + UI import rewrite | `64.03s` | `47s` | `18.8 MB` | `18.7 MB` | `18.8 MB` |

Notes:

- Times are from sequential local runs on the same machine and are noisy.
- The useful comparison is:
  - stable baseline vs final: build `73.48s -> 64.03s`
  - beta-only vs final: compile `86s -> 47s`
- Static bundle size win came from the monorepo beta packages, not from the UI import rewrite.

## UI Changes In This Branch

- Bumped `sdk` / `utils` / `widgets` to the beta versions above.
- Replaced all root `@hyperlane-xyz/widgets` imports with direct subpath imports.
- Replaced the one remaining `Skeleton` usage with a local static placeholder because `widgets` does not yet export `./animations/*`.
- Kept the new placeholder non-pulsing.

## Remaining Bottlenecks

The current critical path is still:

```text
src/features/store.ts
  -> @hyperlane-xyz/sdk MultiProtocolProvider / WarpCore
  -> sdk/dist/providers/providerBuilders.js
  -> aleo runtime + other VM/provider code
```

Observed import trace during the final build:

```text
@hyperlane-xyz/aleo-sdk/dist/runtime.js
  -> @hyperlane-xyz/sdk/dist/providers/providerBuilders.js
  -> @hyperlane-xyz/sdk/dist/providers/MultiProtocolProvider.js
  -> src/features/store.ts
```

Implication:

- The monorepo runtime-entrypoint split helped.
- But Warp UI still eagerly constructs provider-backed runtime state too early.
- Further wins likely require a follow-up that splits metadata-only work from provider/runtime work and/or defers provider construction out of the shared startup path.

## Validation

- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
