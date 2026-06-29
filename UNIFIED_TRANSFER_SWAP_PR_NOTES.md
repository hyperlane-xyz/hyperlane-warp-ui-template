# Unified Transfer + Swap PR Notes

## Summary

This branch moves the app from separate bridge/swap surfaces to a single unified token flow on `/`. The unified form combines Warp Route bridge tokens and router-engine swap tokens into one picker, chooses bridge when both bridge and swap are available for a pair, and keeps swap as the fallback route mode.

The old tabbed/legacy bridge form UI has been removed from the main and embed surfaces. The unified form now owns token selection, route detection, amount entry, recipient handling, bridge review, swap submission, URL params, and transaction history entry points.

## Main Changes

- Added a unified token catalog that merges bridge WarpCore tokens with engine swap tokens.
- Added route-aware unified token picker components and moved token picker UI under `src/features/unified`.
- Removed `/bridge` and `/swap` mode routing; the unified experience is served from `/`.
- Prioritized bridge routes over swap routes when the selected token pair supports both.
- Kept bridge and swap URL params address/denom-based, with bridge-first matching for collateral address, addressOrDenom, HypNative/zeroish refs, then engine token ids.
- Collapsed default token config to `defaultOriginToken` / `defaultDestinationToken`; those refs can now be address/denom based while legacy chain-symbol config values still resolve.
- Default all-chains token lists show only `featuredTokens` when configured, and cap to 50 tokens when no featured list is configured.
- Added exact-input bridge semantics: user input is the max token spend, and same-token bridge fees reduce the transferred amount instead of charging on top.
- Reused existing bridge validation, quotedCalls fee quoting, recipient warnings, recipient confirmation, approval checks, add-token CTA, and transaction submit path where possible.
- Added unified swap controls for slippage, route selection, approval, quote/fee summary, swap submission, and swap details/history support.
- Added deterministic swap recovery outcome coverage for destination-token delivery, fallback recovery, stranded funds, native output, and missing receipt handling.
- Added deterministic swap message-label coverage for CCS commit/reveal bodies, warp dispatches, and legacy fallback ordering.
- Hardened EVM CCS message labeling so explicit reveal body prefixes win before fallback ordering heuristics.
- Added Solana-origin swap message-label handling for engine-main SVM dispatch ordering (`warp`, `commit`, `reveal`).
- Hardened Solana-origin bridged swaps so a confirmed source tx without extractable message IDs fails locally instead of entering `Bridging` with an empty delivery target.
- Clarified native-output swap recovery behavior: frontend receipt-log checks can prove ERC20 destination delivery at or above the route minimum output or fallback recovery, but native output remains optimistic until the route exposes a native execution signal.
- Added EVM mailbox hash backfill polling so direct RPC delivery checks keep looking briefly for the destination `ProcessId` tx hash after `delivered=true`.
- Fixed direct mailbox delivery updates so a later RPC `ProcessId` tx hash can backfill a swap that was first marked delivered without a hash.
- Added swap origin-tx recovery: if the app reloads after a swap origin transaction hash is stored but before message IDs are persisted, the background watcher queries GraphQL by origin tx hash, recovers `warp`/`commit`/`reveal` message IDs, and resumes the normal delivery path.
- Guarded swap origin-tx recovery so a polling result only dispatches recovered message IDs once per target/origin hash before the watcher remounts with the recovered delivery message.
- Keyed swap origin-tx recovery by bridge-route routers so late-arriving route metadata refreshes recovered message labels instead of keeping fallback labels until the stale window expires.
- Preserved non-EVM bridge router casing during origin-tx recovery labeling so Solana/base58 router senders are not normalized like padded EVM hex addresses.
- Gated direct EVM mailbox polling to Ethereum/Tron destinations so Solana destination swaps use the Solana mailbox/PDA watchers without also running a redundant EVM mailbox query loop.
- Added focused coverage for the Solana mailbox polling enablement gate so it only starts for Sealevel destinations with a configured mailbox.
- Skipped background delivery watchers for Solana PDA-completed swaps that cannot receive a GraphQL destination tx hash backfill.
- Added unified bridge review details, including approval/transfer rows, remote token, received amount, and bridge fees with USD labels when prices are available.
- Kept known bridge fee display available when local gas is unavailable, omitting only the unknown local-gas row instead of hiding interchain/token fees.
- Added balance-aware unified token picker rows with progressive balance hydration, including USD value display and balance/USD sorting while preserving featured and bridge-first priority.
- Balance fallback sorting now normalizes atomic balances by token decimals when USD prices are unavailable or tied.
- Merged token rows now choose the strongest available balance candidate by USD value, or decimal-normalized balance when prices are missing, instead of whichever bridge/swap member appears first.
- Token picker search now includes engine swap token `address` / `addressOrDenom` refs for merged bridge+swap rows.
- Engine token metadata cached from prior token API calls now refreshes when later search/id responses return richer metadata for the same token.
- Router API readiness parsing is aligned with engine-main snapshot fields.
- Hardened shared amount formatting and no-wallet Max behavior based on PR review feedback.
- Swap submit now treats stale/loading current-intent quotes as a disabled `Loading quote...` state instead of surfacing `Route is not supported`.
- Added Raydium metadata/CSP support needed by current engine-main/SVM route metadata.
- Switched embed rendering to the unified form.
- Moved embed `postMessage` ready events ahead of WarpContext initialization so parent frames can detect the widget while the unified form is still booting.
- Deleted unused legacy bridge-only form/picker/max/fee code after the unified form became the live path.
- Added and updated unit/Playwright/e2e wallet coverage for unified routing, query params, token selection, exact-input Max, bridge review, and wallet-specific picker behavior.

## Current Behavior Notes

- Token picker rows intentionally do not show Bridge/Swap tags. Route labels are still allowed in transaction history and form-level route status.
- Origin token selection is broad so users can switch route families without being trapped by the current destination.
- Destination token selection is route-filtered once an origin token exists.
- If a new origin is not routable to the old destination, the destination is cleared rather than silently replaced.
- Same-collateral bridge route members are preserved behind deduped unified rows so route filtering and URL hydration can still resolve router-specific destinations.
- Deduped bridge rows resolve the actual connected route token pair before bridge quote, Max, validation, and submit.
- Deduped bridge route candidate lookup uses the existing bridge token identity helper, so same-chain tokens with the same address but different symbols remain distinct when resolving the actual connected route pair.
- Bridge routes do not fetch swap quotes, swap prices, swap approval, or engine chain metadata.
- Swap routes do not mount bridge-only balance/import/recipient-warning reads.
- Engine API absence degrades to bridge-only behavior.
- The swap details modal no longer auto-marks slow origin confirmations as failed from a frontend timer; it only shows a delayed hint and lets receipt/status paths decide final state.
- Swap token lookup keys lowercase valid EVM addresses only and preserve non-EVM casing for history, fee metadata, balance query keys, and validation.
- Sidebar history hides GraphQL bridge-message rows for any local swap message IDs as soon as they are recorded, including in-flight swaps, so bridge API history does not duplicate local swap rows.
- New CCS destination-swap history records keep the route `outputMin`, and destination receipt recovery requires ERC20 output-token transfer logs to the recipient to meet that minimum when available.
- Swap validation now includes native IGP fees in the native-balance requirement for ERC20-source routes, using `max(tx.value, quoted native debit) + gas` so users are not allowed through with enough token balance but insufficient native balance for fees/gas.
- Router API quote request schema mirrors the engine's protocol-normalized address inputs so native non-EVM token, sender, and recipient strings are accepted by shared quote request typing.
- Router API quote request numeric bounds mirror engine main for positive integer chain IDs, positive uint256 amount, and 0-10,000 integer slippage bps.
- Swap quote requests now explicitly send `usePermit2: false` so the UI stays on the classic ERC20 approval path instead of relying on the engine default.
- Unified submit validation reports missing origin/destination selections before falling through to unsupported-route errors.
- Unified swap submit disables while a fresh current-intent quote is still pending, but existing current quotes remain usable during background refresh.
- GraphQL bytea destination tx hashes are formatted per protocol before explorer links or history backfill use them, including no-`0x` hashes for Cosmos/Tron and bech32m-style tx ids for Aleo/Radix.
- `DestSwapFailed` is currently kept as display/history compatibility, but new receipt recovery paths emit `FailedRecovered` when fallback succeeds and `DestFailed` when neither destination-token nor fallback delivery can be proven.

## Remaining Work

- No remaining Codex checklist items before pushing this branch.
- Native-output swap confirmation is still heuristic-only on the frontend; a stronger fix needs an engine/contract-provided destination execution signal.
- Real router-engine swap submit/recovery manual QA is user-owned and not blocking this Codex pass.

## Verification Already Run

- `pnpm format`
- `pnpm lint` (passes with existing console warnings only)
- `pnpm typecheck`
- `pnpm vitest --watch false --reporter=dot --exclude='.next/**'`
- `pnpm build` (with generated `next-env.d.ts` churn reverted)
- Focused unified token/route/query-param/unit test runs across `src/features/unified`
- Focused unified token config/list/query-param tests after default-token cleanup and featured-list semantics.
- Playwright page-load and embed smoke tests
- Targeted e2e wallet smoke/specs for EVM, Solana, Cosmos, Radix, Starknet, token selection, Max, and bridge review
- Swap address deep-link smoke now uses a live swap-only AAVE BSC -> Base pair and waits for async engine lookup before asserting route mode.
- Unified picker smoke now checks every visible token row for absence of Bridge/Swap tags, not only the first row.
- Unified picker balance reads now start with the first visible slice and hydrate additional slices as the user scrolls.
- Added mocked same-chain EVM swap submit coverage that intercepts the router engine API, enters an amount, submits through the unified form, and asserts the quoted Universal Router transaction is sent.
- Added swap recovery outcome unit coverage for destination receipt classification.
- Added swap message label unit coverage for commit/reveal/warp classification.
- Added focused coverage for explicit CCS reveal body labels.
- Added embed `postMessage` ready-event browser coverage.
- Added shared amount formatter hardening and no-wallet Max disabled-state coverage from PR review feedback.
- Added focused coverage for case-sensitive engine token keys and query-token refs.
- Added focused coverage for unified persisted history migration from legacy split bridge/swap local storage.
- Stabilized mocked EVM swap submit coverage so it intercepts the configured router-engine base URL instead of assuming a single deployment URL.
- Added focused message utility coverage for swap delivery ID priority and in-flight swap message filtering from sidebar bridge history.
- Added focused swap recovery coverage for amount-aware ERC20 destination receipt classification.
- Added focused swap validation coverage for ERC20-source routes that require native IGP plus gas.
- Added focused router API schema coverage for native non-EVM quote token, sender, and recipient refs.
- Added focused router API schema coverage for engine-main quote request numeric bounds.
- Added focused router API/e2e coverage that swap quote requests opt out of Permit2 and use the classic approval mode.
- Added focused router API schema coverage for engine-main readiness snapshot fields.
- Added focused route-pair coverage for same-address/different-symbol bridge candidates.
- Added focused unified validation coverage for missing-token errors versus unsupported-route errors.
- Added focused coverage for Solana-origin swap message dispatch labels.
- Added focused coverage for Solana-origin bridged swap message extraction guards.
- Added focused coverage for decimal-normalized unified picker balance sorting.
- Added focused coverage for merged-row balance candidate selection across bridge/swap members.
- Added focused coverage for pending swap quote submit validation.
- Added focused coverage for unified token search by engine swap token address.
- Added focused coverage for refreshing cached engine-token metadata without changing cache state on identical responses.
- Added focused coverage for EVM mailbox delivery hash backfill polling.
- Added focused coverage for delivery update hash backfill decisions.
- Added focused coverage for EVM mailbox polling protocol gating.
- Added focused coverage for Solana mailbox polling protocol gating.
- Added focused coverage for swap delivery watcher final-status filtering.
- Added focused coverage for selected transaction priority before delivery watcher target capping.
- Added focused watcher verification after guarding repeated origin-tx recovery writes.
- Latest local hardening verification after engine-main and PR #1153 re-anchor: PR #1149 review threads remain fully resolved; `pnpm typecheck`, `pnpm lint`, focused unified/swap/messages/store/amount Vitest, and browser smoke for unified page load, picker, and EVM swap submit all passed.
- Live router-engine sanity on 2026-06-26: `/readyz`, `/v1/chains`, and `/v1/tokens` matched the current UI schema expectations; Base VVV -> Arbitrum USDC returned source-swap+bridge executable routes, and Arbitrum USDC -> Base VVV returned bridge+destination-swap executable routes with CCS metadata. No CCS post or transaction broadcast was performed.
- `pnpm build` passed after the latest local hardening commits; generated `next-env.d.ts` route-type churn was reverted.
- Follow-up audit against universal-router-engine `main` at `40b08b89b0a3a208a08ce3f0e216333eb1da1db3` confirmed the UI schema still accepts current readiness, token, quote, CCS, and Solana route tx fields.
- Added focused GraphQL bytea encoding coverage for protocol-specific destination tx hash formatting and zero-byte address handling.
- Added focused swap origin-tx recovery coverage for GraphQL origin hash encoding and recovered message labeling.
- Added focused coverage for route-keyed swap origin-tx recovery labels.
- Added focused coverage for Solana/base58 bridge-router labeling during recovered origin-tx parsing.

## Before Merge

- Latest Codex gates completed:
  - `pnpm format`
  - `pnpm lint` (passes with existing warnings only)
  - `pnpm typecheck`
  - `pnpm vitest --watch false --reporter=dot --exclude='.next/**'` (44 files / 431 tests)
  - `pnpm build`
  - `pnpm playwright test tests/page-load/unified-form.spec.ts tests/page-load/unified-form-visible.spec.ts tests/token-selection/open-close-modal.spec.ts tests/token-selection/search-tokens.spec.ts --project=chromium --workers=1` (5 passed, 1 skipped)
