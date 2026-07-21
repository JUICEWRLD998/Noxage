# Noxage Threat Model (Phase 4)

> Honest privacy claims for the confidential intent + residual settlement path.
> Updated when Phase 4 settlement lands; expanded in Phase 8 hardening.

## 1. System summary

Users submit **encrypted trade intents** into a batching **epoch**. When the epoch
closes, `NoxageSettlementEngine` **homomorphically nets** all active intents
on-chain (FHEVM) and reveals **only** the aggregate residual size and direction.
That residual is swapped on the **unmodified** Uniswap v3 router. Per-user fills
are credited as encrypted handles in `NoxageFillLedger` with FHE ACL so only the
owner (or a later-authorized auditor) can decrypt them.

```
Encrypted intents  →  Homomorphic net (on-chain FHE)
                   →  Public residual only  →  Uniswap v3
                   →  Encrypted fills + ACL
```

## 2. What is private

| Data | Mechanism |
|---|---|
| Individual intent **amount** | `euint64` handle; never in events or storage plaintext |
| Individual intent **side** (buy/sell) | `euint8` handle |
| Optional **limit** price | `euint64` handle (0 = none) |
| Per-user **fill legs** (recv/pay base & quote) | Four `euint64` handles; ACL-gated decrypt |
| Direction of any single user within a multi-user batch | Hidden by encrypted side + netting |

A passive chain observer **cannot** recover individual sizes or directions from
contract storage or events. They see handles and public metadata only.

## 3. What is public (by design)

| Data | Why |
|---|---|
| That a batch/epoch occurred | Epoch lifecycle events (`EpochOpened` / `Closed` / `Settled`) |
| Intent **count** per epoch | Counter on epoch manager (no amounts) |
| Trading **pair** id | Residual venue is public; pair is not secret |
| Intent **deadline** | Staleness / UX; not a size leak |
| **Residual** size + direction (after prepare) | Must be clear to call Uniswap; KMS-signed public decrypt |
| Residual **Uniswap** swap calldata | Unmodified public router — amountIn, tokens, fee, recipient |
| Public **clearing price** used for fill attribution | Passed into `finalizeSettlement` as `priceNum/priceDen` |
| Settlement engine **inventory** balances | Standard ERC-20 balances of the engine address |

**Product honesty:** if an epoch has a single intent, the residual equals that
intent’s size — so the residual swap reveals that size. Netting privacy improves
with ≥2 opposing intents. We never claim single-intent batches hide size.

## 4. Trust assumptions

| Party | Trust | Notes |
|---|---|---|
| **Zama FHEVM coprocessor + KMS** | Trusted for ciphertext integrity and public-decrypt signatures | `FHE.checkSignatures` gates residual cleartext |
| **Settlement engine owner** | Trusted to call finalize with a fair clearing price and fund inventory | Owner-only `finalizeSettlement`; can withdraw inventory |
| **Epoch operator (owner)** | Trusted to open/close epochs on cadence | Permissionless close after duration mitigates stall |
| **Uniswap v3** | Untrusted beyond public AMM semantics | Not forked; residual is fully public |
| **Users** | Control their own keys + ACL grants | Only they (or granted observers) decrypt fills |

### Why not a separate TEE runner for netting (MVP)?

Phase 4 nets **on-chain with FHE** (`FHE.select` / `FHE.add` / `FHE.sub`) so the
engine never learns individual amounts — only the KMS-revealed residual. This
removes a TEE operator from the critical netting path for the residual figure.
A future iExec Nox TEE path can still compute richer plans (limit enforcement,
multi-pair, pro-rata under partial liquidity) off-chain; the on-chain residual
+ fill credit interface stays the same.

## 5. Netting rules (MVP)

1. **Single pair per epoch** (e.g. mWETH/mUSDC) — pair id is public on each intent.
2. **Homomorphic totals:** `buyTotal` / `sellTotal` accumulated via encrypted side.
3. **Residual:** `|buyTotal − sellTotal|` in base units; direction = buy-heavy if buy > sell.
4. **Fill attribution:** each active intent is filled at **100% of submitted size**
   at the public clearing price. The engine’s inventory absorbs the internally
   netted notional; Uniswap only sees the residual. (Prefer this over partial
   pro-rata for MVP demo honesty — every sealed intent settles fully or the
   epoch fails.)
5. **Cancelled intents** (while epoch open) are skipped.
6. **Failed residual swap** → epoch `Failed`, **no fills credited**, inventory
   approval cleared. Operator must recover / reopen path off-band.

## 6. Attack surface (Phase 4 scope)

| Threat | Mitigation / residual risk |
|---|---|
| Forge residual cleartext | `FHE.checkSignatures` against prepare-time handles |
| Double-credit fills | `FillAlreadyCredited` + one fill per intent id |
| Non-engine credits fills | `onlyEngine` on ledger |
| Prepare before close | `EpochNotClosed` |
| Re-prepare | `AlreadyPrepared` |
| Owner sets unfair price | Trusted operator assumption; Phase 8 may bind price to residual swap output |
| Inventory drain | Owner `withdraw`; operational key security |
| Metadata leakage (pair, count, residual) | Accepted; documented above |
| Solo-intent size leak via residual | Accepted; documented product behavior |

## 7. Out of scope (later phases)

- End-to-end confidential balance debit/credit on fill (shielded inventory)
- Limit-price enforcement inside netting
- Multi-pair epochs / multi-hop residual
- Full TEE attestation verification on-chain
- MEV protection beyond residual being public anyway

## 8. Demo checklist (privacy honesty)

- [ ] UI never claims “fully private swap” — residual is public
- [ ] Events show no plaintext amounts
- [ ] Etherscan residual tx matches only `|buy − sell|`
- [ ] User decrypts own fill via ACL; third party cannot without grant
