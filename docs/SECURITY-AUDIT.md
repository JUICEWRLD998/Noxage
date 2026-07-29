# Noxage Security Pass

Date: 2026-07-29

Scope:

- `packages/contracts/contracts/*.sol`
- `packages/contracts/contracts/interfaces/*.sol`
- `packages/contracts/scripts/finalize-settlement.ts`
- Frontend transaction, decryption, event-query, and error-display code in
  `apps/web/src/hooks` and `apps/web/src/lib`
- Existing Hardhat tests in `packages/contracts/test`

Focus: reentrancy, access control, epoch edge cases, and plaintext disclosure in
events or application/operator logs.

This is a focused source review, not a formal audit. No production contract
implementation was changed during this pass.

## Executive Summary

No direct reentrancy exploit or plaintext disclosure of individual encrypted
intent/fill values was found in the reviewed contract events or browser logging.
The current settlement engine includes an explicit reentrancy guard on its two
asset-moving entry points.

The most important integrity risks are:

1. The documented single-pair epoch invariant is not enforced.
2. Intent deadlines are not enforced during netting/finalization.
3. An epoch can accept intents before the settlement engine is wired, leaving
   those ciphertext handles inaccessible to the eventual engine.
4. Changing `epochDuration` changes the permissionless close time of an already
   open epoch despite the contract claiming it affects future epochs only.

The observed Sepolia "Residual settlement failed" state is expected with the
deployed contract when a non-zero residual is attempted. The current working
tree corrects the SwapRouter02 tuple, but the deployed contract must be replaced
before that correction takes effect. The configured mock pair also has no
Uniswap pool and the engine has no required input inventory. The engine catches
the router revert, marks the settlement and epoch `Failed`, and credits no fills.

## Findings

### SEC-01: Pair identity is accepted but never enforced

Severity: High

References:

- `packages/contracts/contracts/NoxageIntentBook.sol:107-160`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:144-160`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:238-240`
- `docs/THREAT-MODEL.md`, "Netting rules (MVP)"

`submitIntent` accepts an arbitrary public `pair` and stores it, but the
settlement engine neither validates it against the engine's immutable
`baseToken`/`quoteToken` pair nor requires all intents in an epoch to share the
same pair. Netting combines every active intent in the epoch and settles the
aggregate against the engine's one fixed token pair.

Impact:

- Intents labelled for different markets can be netted together.
- Fill accounting can represent a different market from the submitted intent.
- A malicious or faulty client can corrupt an epoch's accounting without
  breaking encryption or access control.

Recommended remediation:

- Define an immutable `supportedPair` in the intent book or settlement engine.
- Reject submissions whose pair does not match it, or bind a pair to the epoch
  on first submission and reject later mismatches.
- Re-check the invariant in `prepareSettlement` as defense in depth.

Proposed regression tests:

- Reject an intent whose pair differs from the configured pair.
- Reject a second intent with a different pair in the same epoch.
- Confirm a valid single-pair epoch still prepares and settles.

### SEC-02: Expired intents remain active and settle

Severity: Medium

References:

- `packages/contracts/contracts/NoxageIntentBook.sol:115`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:151-160`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:287-300`

The deadline is checked only when an intent is submitted. Settlement checks only
`IntentStatus.Active`, so an intent that expires before epoch close, prepare, or
finalize is still included in totals and receives a fill.

Impact:

- Users can receive fills after their stated validity window.
- Delayed operator activity changes execution semantics.
- Stale intents can influence the public residual and engine inventory use.

Recommended remediation:

- Skip or reject intents with `deadline < block.timestamp` during preparation.
- Freeze the eligibility timestamp at epoch close if settlement latency should
  not invalidate otherwise timely intents.
- Document whether equality at the deadline is valid.

Proposed regression tests:

- Submit an intent, advance beyond its deadline, close, and verify it is excluded
  or preparation reverts according to the selected policy.
- Test a deadline exactly equal to the close timestamp.
- Test mixed valid and expired intents.

### SEC-03: Pre-wiring intents can make a closed epoch un-settleable

Severity: Medium

References:

- `packages/contracts/contracts/NoxageEpochManager.sol:135-155`
- `packages/contracts/contracts/NoxageIntentBook.sol:136-142`
- `packages/contracts/contracts/NoxageIntentBook.sol:89-95`

`openEpoch` requires only the intent book to be configured. If users submit
before `NoxageIntentBook.setSettlementEngine` is called, the encrypted handles
are not ACL-granted to the later settlement engine. The engine address is
write-once and there is no migration/grant path for old intents.

Impact:

- Preparation can fail on FHE ACL checks.
- A closed epoch can become permanently stuck.
- Users cannot cancel after close.

Recommended remediation:

- Require both the epoch manager and intent book to be fully wired before
  `openEpoch`.
- Alternatively reject submissions while `settlementEngine == address(0)`.
- Add a deployment invariant check to scripts before opening the first epoch.

Proposed regression tests:

- Verify opening or submission fails before engine wiring.
- Verify an intent submitted after wiring can be read homomorphically by the
  engine.

### SEC-04: Updating epoch duration changes an already-open epoch

Severity: Medium

References:

- `packages/contracts/contracts/NoxageEpochManager.sol:59`
- `packages/contracts/contracts/NoxageEpochManager.sol:119-123`
- `packages/contracts/contracts/NoxageEpochManager.sol:146-155`
- `packages/contracts/contracts/NoxageEpochManager.sol:168-169`

`EpochOpened` emits a fixed `closesAt`, and `setEpochDuration` says it affects
future epochs only. However, `closeEpoch` calculates expiry using the current
global `epochDuration`. The owner can shorten or extend an active epoch after
users submitted intents, while the emitted `closesAt` and frontend countdown
remain based on the old duration.

Impact:

- Permissionless close timing differs from the event and UI.
- The operator can unexpectedly shorten or prolong an active batch.
- Clients relying on `EpochOpened.closesAt` can submit near a boundary that no
  longer exists.

Recommended remediation:

- Store `closesAt` or the duration inside each `Epoch`.
- Use the stored value in `closeEpoch`.
- Apply `setEpochDuration` only when constructing future epochs.

Proposed regression tests:

- Open with duration A, change to B, and confirm the active epoch still closes at
  its originally committed timestamp.
- Confirm the next epoch uses duration B.

### SEC-05: Encrypted quote-leg arithmetic can overflow `euint64`

Severity: Medium

References:

- `packages/contracts/contracts/NoxageIntentBook.sol:124`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:292-300`

Intent amounts and fill legs use `euint64`. The quote leg computes
`amount * priceNum / priceDen` in encrypted `euint64` arithmetic. For sufficiently
large valid `uint64` amounts or prices, multiplication can overflow the encrypted
type before division, producing incorrect fill accounting.

Impact:

- A valid encrypted input can generate a wrapped/truncated quote fill.
- Public residual execution and encrypted fill accounting can diverge.

Recommended remediation:

- Enforce conservative public bounds on amount and price before accepting or
  finalizing.
- Use a wider encrypted intermediate type if supported, then downcast only after
  a proven range check.

Proposed regression tests:

- Exercise the maximum supported amount at the maximum supported price.
- Verify values near the bound cannot wrap.

### SEC-06: Side values are not constrained to 0 or 1

Severity: Low

References:

- `packages/contracts/contracts/NoxageIntentBook.sol:123`
- `packages/contracts/contracts/NoxageSettlementEngine.sol:156-159`

Any encrypted `uint8` is accepted. Settlement treats exactly `1` as buy and every
other value as sell. A malformed or malicious client can therefore submit values
such as `2` that are silently interpreted as sell.

Recommended remediation:

- Homomorphically validate the side domain, or encode side as an encrypted
  boolean if the FHE stack supports it.
- Reject invalid values through a proof/range mechanism.

### SEC-07: Successful swaps can leave router allowance in place

Severity: Low

References:

- `packages/contracts/contracts/NoxageSettlementEngine.sol:242-264`

Allowance is cleared after a caught router failure but not after success. A
standard exact-input Uniswap router consumes the approved amount, so the expected
remaining allowance is zero. Clearing it explicitly after success would reduce
the impact of a non-standard or compromised immutable router that spends less
than approved.

Recommended remediation:

- Clear the allowance after both success and failure.
- Validate router bytecode/address during deployment and record it in deployment
  artifacts.

## Reentrancy Review

No exploitable reentrancy path was identified under the current source:

- `finalizeSettlement` and `withdraw` are both `nonReentrant`.
- `finalizeSettlement` also remains `onlyOwner`; a router callback cannot satisfy
  the owner check.
- `creditFill` is engine-only and writes the one-time fill marker in the same
  transaction; unauthorized callbacks cannot call it.
- Once wired, epoch terminal methods are restricted to the immutable engine.

Residual risks:

- The router and token addresses are immutable but deployment-controlled. A
  malicious deployment configuration invalidates the standard-token/router
  assumptions.
- `prepareSettlement` performs external contract reads but no asset movement and
  is protected by its one-way settlement status.

## Access-Control Review

Controls confirmed by source and existing tests:

- Only the epoch owner opens epochs.
- Only the owner or elapsed time permits close.
- Only the configured intent book records intents.
- Before engine wiring the owner can mark terminal status; after wiring only the
  configured engine can do so.
- Only the settlement owner finalizes and withdraws inventory.
- Only the configured engine credits fills.
- Only an intent owner can cancel while its epoch is open.
- Engine/book/ledger wiring is one-time.

Residual risk is concentrated in the settlement owner, which finalizes with a
chosen clearing price and can withdraw inventory. Production use should move
ownership to a multisig or timelock and use separate operational roles where
practical.

## Plaintext Event and Logging Review

Individual private values:

- `IntentSubmitted` emits id, epoch, owner, pair, and deadline, but no side,
  amount, or limit.
- `FillCredited` emits id/owner metadata, but no fill legs.
- Browser transaction hooks do not call `console.log` with encrypted inputs,
  decrypted balances, fill legs, proofs, or private keys.
- Decrypted fill and balance values remain in React/browser memory after an
  explicit wallet-authorized decrypt. They are not persisted by the reviewed
  code.

Public-by-design values:

- `SettlementPrepared` emits publicly decryptable aggregate handles.
- `ResidualSwapped` emits aggregate direction, input, and output amounts.
- `finalizeSettlement` calldata includes the aggregate residual, direction,
  clearing price, and KMS proof.

These aggregate values are already public on-chain and are not individual-intent
plaintext. However, the operator script previously printed the decrypted
residual and direction to stdout. This pass removed that value-level log from
`packages/contracts/scripts/finalize-settlement.ts`; it now logs only the epoch
and transaction result.

Operational guidance:

- Do not enable verbose wallet/RPC debugging in demos or production.
- Do not paste full RPC errors into public support channels; they may contain
  addresses, calldata, proofs, and provider metadata.
- Treat `.env` and deployment/operator terminals as sensitive. Never record a
  terminal containing private keys or environment dumps.

## Residual Settlement Failure Analysis

Observed UI state: `Residual settlement failed`.

Relevant references:

- `packages/contracts/contracts/NoxageSettlementEngine.sol:237-264`
- `apps/web/src/hooks/useFinalizeSettlement.ts:75-106`
- `apps/web/src/hooks/useSettlement.ts:83-149`
- `README.md:127-135`

For a non-zero residual, the engine:

1. Calculates the required public input amount.
2. Approves the configured router.
3. Calls `exactInputSingle`.
4. Catches a router revert, clears approval, marks the settlement and epoch
   `Failed`, emits `SettlementFailedEvent`, and returns without crediting fills.

The failure transaction can be explained by three deployment/environment
blockers:

- The deployed contract used the classic SwapRouter tuple while the target is
  SwapRouter02. The current source fixes this, but existing bytecode does not
  change until redeployment.
- No mWETH/mUSDC pool exists at the configured fee tier.
- The settlement engine lacks token inventory for a non-zero residual.

The transaction hash shown by the UI is the terminal failure transaction, not a
reverted transaction: the router revert was caught and converted into the
on-chain `Failed` state.

Before retrying in a new epoch:

1. Redeploy the corrected engine that matches SwapRouter02.
2. Use a real, liquid token pair/pool on the target network.
3. Fund the engine with enough base and quote inventory for both residual
   directions.
4. Simulate the exact finalize call before sending it.
5. Set a non-zero, defensible `amountOutMinimum`; the current frontend uses zero.

Failed epochs are terminal in the current state machine. There is no retry,
refund, or carry-forward implementation, so remediation requires a new epoch and
an explicit operational policy for affected intents.

## Test Status and Gaps

Executed:

```text
pnpm --filter @noxage/contracts test
33 passing
```

Existing coverage includes:

- owner-only finalize
- engine-only fill credit
- permissionless close after duration
- cancellation boundaries
- no plaintext amount in `IntentSubmitted`
- residual swap failure marks the epoch failed and credits no fills
- perfect-net, buy-heavy, and sell-heavy settlement

Focused regression tests for SEC-01 through SEC-06 were not added because the
current contracts intentionally accept those behaviors; tests asserting the
secure behavior would fail until remediation policy is chosen. Add them in a
new `packages/contracts/test/NoxageSecurityRegression.ts` alongside the fixes.

The current worktree also contains focused regressions for:

- owner terminal authority being removed after engine wiring
- SwapRouter02 selector compatibility
- all-cancelled epochs preparing as a zero residual

## Residual Risks

- FHEVM coprocessor, ACL, relayer, and KMS correctness are trusted dependencies.
- The settlement owner selects the clearing price and can withdraw all engine
  inventory.
- Limits are stored but not enforced in the MVP.
- A single-intent epoch reveals that intent's full size through the public
  residual.
- Public RPC and relayer services can correlate addresses, reads, writes, and
  timing.
- Failed epochs currently have no on-chain retry/refund path.
- This review did not include formal verification, fuzzing, dependency source
  review, deployed-bytecode verification, or live transaction tracing.
