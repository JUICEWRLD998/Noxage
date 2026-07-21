# iExec Nox — Builder Feedback

> Required hackathon deliverable. Fill sections as we integrate Nox for real (Phases 2–4+).  
> Be specific: package versions, error messages, docs gaps, what worked well.

**Project:** Noxage  
**Track:** WTF Hackathon Summer Edition  
**Network:** Ethereum Sepolia  

---

## 1. Setup & onboarding

_What was smooth / painful getting from zero to first confidential contract?_

- [ ] Nox docs clarity
- [ ] Hardhat plugin install
- [ ] Starter repo usefulness
- [ ] Contracts wizard (`cdefi-wizard.iex.ec`)

**Notes:**

_Phase 0: not yet integrated. Placeholder for Phase 2 feedback._

---

## 2. Confidential contracts (ERC-7984 / handles)

_Shield, unshield, transfers, ACL, events, gas, DX._

**Stack (Phase 2):** OpenZeppelin `@openzeppelin/confidential-contracts@0.5.1` (ERC-7984)
on top of Zama FHEVM (`@fhevm/solidity@0.11.1`, `@fhevm/hardhat-plugin@0.4.2`),
against the live FHEVM coprocessor on Ethereum Sepolia. iExec Nox TEE is the
Phase 4 confidential-*compute* layer (netting runner); ERC-7984 is the on-chain
confidential-*balance* layer — the two are complementary, not alternatives.

**What worked well:**

- `ERC7984ERC20Wrapper` is a drop-in shield/unshield primitive — wrap is
  synchronous, unwrap is an honest two-step (request → oracle decrypt →
  `finalizeUnwrap`) that mirrors the real KMS flow.
- `ERC7984ObserverAccess` gives selective disclosure (auditor read access) for
  free — exactly the ACL grant/revoke we needed.
- `ZamaEthereumConfig` auto-selects coprocessor addresses by `block.chainid`
  (mainnet / Sepolia / local 31337), so no hardcoded addresses in our contracts.
- The `@fhevm/hardhat-plugin` mock reproduces encryption, ACL, and KMS-signed
  public decryption in-process — all 7 shield/unshield/transfer/ACL tests run
  locally with the same code paths that hit Sepolia.

**Friction / gotchas:**

- FHEVM requires `evmVersion: "cancun"`; the plugin's config extender is a no-op,
  so this must be set manually in `hardhat.config.ts` or compilation fails.
- Wrapper `rate()` depends on underlying decimals vs `_maxDecimals()` (default 6):
  a 6-decimal token has rate 1, so confidential balances are in raw underlying
  units, not whole tokens. Worth documenting for UI amount formatting.
- Package is `@fhevm/hardhat-plugin`, not `@fhevm/hardhat` (which 404s on npm).

**Deployment:** `pnpm deploy:sepolia` → addresses in `deployments/sepolia.json`.

**Encrypted external inputs (Phase 3 — intent book):**

- User-supplied ciphertext arrives as `externalEuint8` / `externalEuint64`
  (from `encrypted-types`, re-exported by `@fhevm/solidity/lib/FHE.sol`) plus a
  single `bytes inputProof`; `FHE.fromExternal(handle, proof)` verifies and
  converts each into an in-contract handle. One proof can cover several handles
  packed in the same client-side `createEncryptedInput(...).encrypt()`.
- ACL is not automatic on `fromExternal`: you must `FHE.allowThis(handle)` for the
  contract and `FHE.allow(handle, user)` for the submitter, or nobody can decrypt
  later. Easy to forget — the mock's `userDecryptEuint` surfaces it immediately.
- The mock's `createEncryptedInput` binds ciphertext to `(contractAddress, userAddress)`,
  so the encrypting signer must match `msg.sender` on submit — a good forcing
  function that mirrors Sepolia.
- Keeping `pair` and `deadline` public (only size/side/limit encrypted) kept the
  contract simple and matches the honest privacy claim (residual pair is visible
  anyway). No gas surprises — intent submit is dominated by the FHE verify.

**Phase 3 deployment:** `pnpm deploy:intents:sepolia` (epoch manager + intent
book, auto-wired) → merged into `deployments/sepolia.json`.

---

## 3. TEE / confidential compute (netting)

_Runner, gateway, encryption SDK, latency, failure modes._

**Phase 4 approach:** on-chain **FHEVM homomorphic netting** inside
`NoxageSettlementEngine.prepareSettlement` — not a separate iExec Nox TEE
runner for the residual figure. Intent handles stay encrypted; only
`|buy − sell|` + a direction bit are made publicly decryptable via
`FHE.makePubliclyDecryptable` + KMS-signed `publicDecrypt` (same pattern as
ERC-7984 unwrap finalize).

**What worked well:**

- Homomorphic `FHE.select` / `FHE.add` / `FHE.sub` / `FHE.gt` let us net a
  whole epoch without ever decrypting individual sizes. The engine learns only
  the residual the KMS reveals — strong fit for the “privacy membrane” claim.
- Reusing the shield/unshield public-decrypt path (`publicDecrypt` →
  `FHE.checkSignatures`) kept the residual reveal honest and testable under
  `@fhevm/hardhat-plugin` mock with the same APIs as Sepolia.
- Granting the settlement engine FHE ACL on submit (`FHE.allow(handle, engine)`)
  from the intent book was the right wiring point; without it, prepare reverts
  deep in the coprocessor with opaque ACL errors.

**Friction / gotchas:**

- We originally planned an iExec Nox TEE runner for netting. FHEVM on-chain
  netting covered the MVP residual + fill path without introducing a second
  compute stack mid-hackathon. TEE remains attractive for **limit enforcement**,
  multi-pair planning, and richer fill math — not required for residual size.
- `NoxageEpochManager.markSettled` / `markFailed` were `onlyOwner`; the engine
  is a separate contract, so finalize always failed until we added a
  `settlementEngine` authority. Easy to miss when composing Ownable modules.
- Gas: prepare loops every intent with several FHE ops. Fine for demo-sized
  batches (≤ tens of intents); not production-scale without batching limits.
- `FHE.div` is ciphertext ÷ plaintext only — clearing price stays public
  (`priceNum/priceDen`), which matches the honest threat model.

**Deploy:** `pnpm --filter @noxage/contracts deploy:settlement:sepolia`
→ fill ledger + settlement engine, wired into book + epoch manager.

---

## 4. Composability with public DeFi

_Calling Uniswap (or other) from a Nox-adjacent settlement path without breaking privacy guarantees._

**Notes:**

- Residual path calls the **unmodified** Uniswap v3 `SwapRouter.exactInputSingle`
  via a minimal `ISwapRouter` interface. No fork, no callback customisation.
- Local tests use `MockSwapRouter` (fixed price, pre-funded). Sepolia uses the
  canonical SwapRouter (`0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`).
- Engine holds public ERC-20 **inventory** (working capital). Residual swaps
  pull from inventory; netted notional never touches Uniswap. Inventory balances
  are public — documented in `docs/THREAT-MODEL.md`.
- Failure path: residual swap `try/catch` → epoch `Failed`, no fills credited,
  approval zeroed. Safe fund handling for the residual leg; user confidential
  balances are not auto-refunded in MVP (operator recovery).
- Privacy boundary is clean: Uniswap sees only residual `amountIn` / tokens /
  fee. Individual intent sizes never appear in the residual calldata when the
  batch has opposing flow.
---

## 5. Frontend / SDK DX

_Handle SDK, encrypt/decrypt UX, wallet flows, TypeScript types._

**Notes:**

_(fill in Phases 5–6)_

---

## 6. What we loved

-

---

## 7. What blocked us

-

---

## 8. Feature requests

-

---

## 9. Would we ship this in production?

_Yes / with changes / not yet — and why._

-

---

## 10. Misc

_Links to issues, Discord threads, screenshots of errors (if any)._

-
