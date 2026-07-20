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
| `NoxageHello` | 0 | Compile sanity only — remove/supersede later |
| Vault / ERC-7984 wrappers | 2 | Shield / unshield |
| `NoxageIntentBook` | 3 | Encrypted intents |
| `NoxageEpochManager` | 3 | Epoch lifecycle |
| Netting compute path | 4 | TEE netting |
| `NoxageSettlementExecutor` | 4 | Uniswap residual call |
| `NoxageFillLedger` | 4 | Encrypted fills + ACL |

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

## 8. Open questions (resolve in Phase 2–4)

- Exact Nox handle SDK / runner API surface on Sepolia
- Preferred ERC-7984 wrapper pattern from Nox wizard
- Uniswap v3 pool addresses / liquidity seeding on Sepolia
- Pro-rata vs FIFO fill attribution (default plan: pro-rata)
