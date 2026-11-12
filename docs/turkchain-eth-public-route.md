# Public Ethereum–Turkchain ETH route: execution preflight

This supports the public, bidirectional `ETH/ethereum-turkchain` route proposed in [Registry #1786](https://github.com/hyperlane-xyz/hyperlane-registry/pull/1786). It does not introduce a wallet allowlist, claim contract or source-gas subsidy. Users pay source ETH/TURK gas; the project funds destination relayer gas.

The custom Turkchain synthetic isolates 500 ETH of legacy genesis supply from authenticated bridge redemption credits. The standard token balance alone cannot establish how much a wallet may redeem. The new send-time preflight checks both router enrollments and mailboxes, isolation, the exact legacy supply, synthetic liabilities, native collateral and the sender's redemption credit. It always simulates the populated source transaction, even when the quote already includes a source transaction fee. It runs before wallet approvals or transfer submission. Missing `warpRouteId` cannot bypass checks for the canonical router transactions.

A public Ed25519 observation key verifies short-lived operational evidence served by the project. The private observation key remains on the project server and is distinct from all EVM/KMS signing keys. Evidence binds the one relayer container, exact config hash, two destination signers, checkpoints, indexers and the persistent broadcast-layer budget. Invalid signatures, stale evidence, wrong routes, degraded infrastructure or insufficient budget fail closed. A policy/config/key rotation requires a reviewed update, rather than silently trusting a new key supplied by the evidence endpoint.

Current enforced destination budgets:

| Destination | Daily maximum | Per-message maximum | Max fee per gas | Finality  |
| ----------- | ------------- | ------------------- | --------------- | --------- |
| Ethereum    | 0.0005 ETH    | 0.00025 ETH         | 1 gwei          | 64 blocks |
| Turkchain   | 0.03 TURK     | 0.003 TURK          | 5 gwei          | 24 blocks |

The broadcast gate durably reserves worst-case signed costs before forwarding, reconciles canonical finalized receipts and counts reverted transactions. This UI does not replace that enforcement. The preflight fails when the remaining daily budget cannot reserve another maximum-cost message.

Historical successful messages, never replayed by this work:

- Ethereum → Turkchain: `0x34d9c9d2824de7f1ced7b90720a9d1df9f4d923e94296a7277b0af9141eebcee`; destination `0x363ffd72a933807eb373f1ad7fb5a575ee083835444f1b3cef798a26d09029a7`.
- Turkchain → Ethereum: `0xed594db7af439aa2d31965b5e116bf11933a14ac227d8d2246b7a645e6dc7990`; destination `0xba6ab9245a1a2d55fb0783c66e9c9330b842836010a228c9c4ac6937958109f3`.

Tests use mocked RPC calls and RAM-only observation signing keys; no new mainnet transfer, mint, claim or message is generated. The Registry execution block must remain until maintainers approve and deploy the compatible execution path and all project operational checks pass. A Registry PR or this UI PR alone does not establish Nexus production availability. The private/public route-engine service may need separate maintainer changes; this repository does not grant access to it. Please confirm the engine's direct `transferRemote` population and route-ID propagation during review.

## Review hardening

Canonical identification includes the connection ID, bridge-step ID and populated canonical-router target. The quoted bridge step must match source/destination chains, optional canonical route ID and transaction amount. Required signed operational flags use literal-`true` schema validation, rejecting strings, numbers and missing fields. The early preflight remains; after network prompts, approvals, CCS and transaction population, fresh evidence is fetched again immediately before canonical wallet submission. Negative hook tests establish that expired final readiness prevents the send handler from being called.

The runtime binding now includes the agent's supported `maxMessageRetries=66` window. The earlier32-attempt setting could prevent rehydration of a budget-denied message before the next UTC budget reset. The pinned agent source defines66 as its default and supplies a roughly two-week normal retry window. This does not relax daily/message/fee caps or reset persistent retries. Canonical source, `delivered(messageId)` and nonce checks remain enforced; historical delivered messages are not resubmitted. This is pinned-source inspection plus mocked budget-reset testing, not a claim of running a new live transfer or the Rust test suite.
