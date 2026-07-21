# Noxage Architecture (outline)

> Living document. Expanded as Phases 2–4 land real contracts.

## 1. Purpose

Noxage is a **privacy membrane** over public DeFi:

- Users encrypt **intents** (size, direction, optional limit)
- Nox **TEE** netting collapses opposing flow inside an **epoch**
- Only the **residual** hits unmodified public rails (Uniswap v3 MVP)
- Fills return as **confidential balances** with **selective disclosure** (ACL)

Public protocols are never forked. Composability is preserved at settlement.

## 2. High-level flow

```
Wallet
  │ encrypt intent (FHEVM input proof)
  ▼
NoxageIntentBook          ← confidential inputs (handles)
  │ epoch close
  ▼
NoxageSettlementEngine    ← homomorphic net (FHE) · residual reveal
  │ publicDecrypt residual only
  ▼
Uniswap v3 Router         ← unmodified public protocol (residual only)
  │
  ▼
NoxageFillLedger          ← encrypted fills + ACL
  │
  ▼
User / auditor decrypt
```

## 3. Package map

| Package | Role |
|---|---|
| `apps/web` | Product UI (Next.js, wagmi/viem, Noviq design system) |
| `packages/contracts` | Solidity + Hardhat; Nox plugin from Phase 2 |

## 4. Contract map (target)

| Contract | Phase | Responsibility |
|---|---|---|
| ~~`NoxageHello`~~ | 0 | Compile sanity — **removed in Phase 2** |
| `MockERC20` | 2 | Public ERC-20 faucet stand-in (ERC-1363) for Sepolia |
| `NoxageConfidentialToken` | 2 | Shield / unshield + ACL (ERC-7984 wrapper) ✅ |
| `NoxageEpochManager` | 3 | Epoch lifecycle + status machine ✅ |
| `NoxageIntentBook` | 3 | Encrypted intent handles + cancel ✅ |
| `NoxageSettlementEngine` | 4 | Homomorphic net + residual Uniswap + fills ✅ |
| `NoxageFillLedger` | 4 | Encrypted fills + ACL ✅ |
| `ISwapRouter` / `MockSwapRouter` | 4 | Unmodified Uniswap v3 interface + local mock ✅ |

### Confidential-balance stack (Phase 2)

`NoxageConfidentialToken` composes three audited OpenZeppelin confidential-contract
layers on Zama's FHEVM coprocessor (live on Sepolia):

- **`ERC7984ERC20Wrapper`** — `wrap()` shields a public ERC-20 into an encrypted
  `euint64` balance; `unwrap()` → `finalizeUnwrap()` unshields via a two-step
  oracle-decrypt flow. On-chain state is ciphertext handles only.
- **`ERC7984ObserverAccess`** — `setObserver()` grants one auditor permanent FHE
  ACL read access to an account's balance/transfers (selective disclosure).
- **`ZamaEthereumConfig`** — wires ACL / Coprocessor / KMSVerifier addresses by
  `block.chainid`.

One wrapper is deployed per underlying (confidential mUSDC, confidential mWETH).
The `euint64` datatype caps confidential supply at `type(uint64).max`.

### Intent + epoch layer (Phase 3)

Users seal encrypted trade intents into batching epochs before the TEE nets them:

- **`NoxageEpochManager`** — owns the epoch state machine
  (`None → Open → Closed → Settled | Failed`). At most one epoch is `Open` at a
  time. The owner (later the TEE coordinator) opens/closes/settles; anyone may
  close an epoch once its duration elapses, so the cadence survives an idle
  operator. Stores only a per-epoch intent counter and an opaque `settlementRef`
  — never trade data.
- **`NoxageIntentBook`** — accepts intents whose sensitive fields are FHE
  ciphertext handles verified via `FHE.fromExternal`: `side` (euint8 direction),
  `amount` (euint64 size), `limit` (euint64 price, 0 = none). The `pair` and
  `deadline` are public by design. Each handle is ACL-granted to the submitter
  and the book (`allow`/`allowThis`); the settlement engine is granted ACL when
  wired so it can net without learning plaintext sizes.
  Intents bind to the currently open epoch and can be cancelled only while it
  stays open. Events (`IntentSubmitted`, `Epoch*`) carry no plaintext amounts.

### Settlement + fills (Phase 4)

- **`NoxageSettlementEngine`** — two-step settle for a closed epoch:
  1. `prepareSettlement` — homomorphic buy/sell totals, residual
     `|buy − sell|` + direction made publicly decryptable (only those aggregates).
  2. `finalizeSettlement` — KMS-verify residual, swap **residual only** on
     unmodified Uniswap v3 `exactInputSingle`, credit encrypted fills, mark
     epoch `Settled`. Residual swap revert → epoch `Failed`, no fills.
- **`NoxageFillLedger`** — four encrypted legs per intent (`recvBase`,
  `recvQuote`, `payBase`, `payQuote`); owner ACL for selective disclosure.
- **Netting rule (MVP):** full-size fills at a public clearing price; engine
  inventory covers netted notional; Uniswap sees residual only. See
  `docs/THREAT-MODEL.md`.

## 5. Privacy model (honest)

**Private:** intent amounts, per-user fills until authorized decrypt, direction within multi-user netting.

**Public:** residual Uniswap (or Aave stretch) settlement, that a batch occurred, residual pair when residual ≠ 0, clearing price, engine inventory balances.

Full threat model: `docs/THREAT-MODEL.md`.

## 6. Frontend IA

```
/           marketing shell (Phase 0 placeholder → Phase 7 full)
/app/*      product routes (Phase 5–6)
/styleguide design system (Phase 1)
```

## 7. Networks

- Local Hardhat for unit tests
- **ETH Sepolia** for hackathon product path

## 8. Phase 0 deliverables (complete)

✅ Monorepo structure with pnpm workspaces  
✅ Next.js app with Noviq design system (tokens, motion, patterns)  
✅ Three fonts configured: Space Grotesk (display), Geist (sans), Geist Mono (mono)  
✅ MotionProvider with `reducedMotion="user"` accessibility  
✅ Hardhat + TypeScript contract setup (compiles NoxageHello.sol)  
✅ .env.example with Sepolia, WalletConnect, Nox endpoint vars  
✅ Mesh + grain background rendering on landing page  
✅ No-FOUC theme script in layout  
✅ All dependencies installed and builds verified  

## 9. Open questions (resolve in Phase 2–4)

- Exact Nox handle SDK / runner API surface on Sepolia
- Preferred ERC-7984 wrapper pattern from Nox wizard
- Uniswap v3 pool addresses / liquidity seeding on Sepolia
- Pro-rata vs FIFO fill attribution (default plan: pro-rata)
