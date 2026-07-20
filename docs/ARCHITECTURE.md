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
  │ encrypt intent (Nox handle SDK)
  ▼
NoxageIntentBook          ← confidential inputs (handles)
  │ epoch close
  ▼
Nox Runner (TEE)          ← decrypt · net · plan residual + fills
  │
  ▼
NoxageSettlementExecutor  ← residual only
  │
  ▼
Uniswap v3 Router         ← unmodified public protocol
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
| Netting compute path | 4 | TEE netting (iExec Nox) |
| `NoxageSettlementExecutor` | 4 | Uniswap residual call |
| `NoxageFillLedger` | 4 | Encrypted fills + ACL |

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
  and the book (`allow`/`allowThis`); the Phase 4 TEE path is added when wired.
  Intents bind to the currently open epoch and can be cancelled only while it
  stays open. Events (`IntentSubmitted`, `Epoch*`) carry no plaintext amounts.

## 5. Privacy model (honest)

**Private:** intent amounts, per-user fills until authorized decrypt, direction within multi-user netting.

**Public:** residual Uniswap (or Aave stretch) settlement, that a batch occurred, residual pair when residual ≠ 0.

Full threat model: `docs/THREAT-MODEL.md` (Phase 8).

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
