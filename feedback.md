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

---

## 3. TEE / confidential compute (netting)

_Runner, gateway, encryption SDK, latency, failure modes._

**Notes:**

_(fill in Phase 4)_

---

## 4. Composability with public DeFi

_Calling Uniswap (or other) from a Nox-adjacent settlement path without breaking privacy guarantees._

**Notes:**

_(fill in Phase 4)_

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
