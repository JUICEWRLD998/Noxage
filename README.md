# Noxage

**Public liquidity. Private strategy.**

Noxage is a confidential intent + batch-netting settlement layer for open DeFi. Users submit encrypted trade intents; iExec Nox TEE runners net opposing flow and settle **only the residual** on unmodified public protocols (Uniswap first). Individual sizes never appear in plaintext on-chain.

> Built for the [iExec WTF Hackathon](https://dorahacks.io/hackathon/wtf-hackathon/detail) · ETH Sepolia · iExec Nox

---

## Status

| Phase | Description | State |
|---|---|---|
| 0 | Repo bootstrap + design system | ✅ **Complete** |
| 1 | Design system component kit + `/styleguide` | ✅ **Complete** |
| 2 | Confidential shield / unshield | ✅ **Complete** |
| 3 | Intent book + epoch manager | ✅ **Complete** |
| 4 | Netting + Uniswap residual settlement | ✅ **Complete** |
| 5 | Product frontend: wallet + shield + intent | ✅ **Complete** |
| 6 | Product frontend: epoch, settlement, fills, privacy split | ✅ **Complete** |
| 7–8 | Marketing landing, docs, demo | Pending |

See [`implementation.md`](./implementation.md) for the full build bible.

---

## Monorepo layout

```
noxage/
├── apps/web                 # Next.js product frontend
├── packages/contracts       # Hardhat + Solidity (Nox integration from Phase 2)
├── docs/                    # Architecture, design system, threat model
├── deployments/             # Network deployment addresses
├── implementation.md        # Phased implementation plan
└── feedback.md              # iExec / Nox tooling feedback (hackathon required)
```

---

## Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io) ≥ 9
- Git

---

## Setup

```bash
# From repo root
pnpm install

# Copy env template
cp .env.example .env
# For the web app (optional until wallet wiring):
# cp .env.example apps/web/.env.local
```

Fill RPC / keys only when deploying. Never commit secrets.

---

## Develop

```bash
# Frontend (http://localhost:3000)
pnpm dev

# Compile contracts
pnpm contracts:compile

# Run contract tests
pnpm contracts:test
```

---

## Design system

UI follows the **Noviq** playbook (dark-first, OKLCH, CSS Modules, glass + mesh + grain).

- Reference: [`docs/UI-DESIGN-SYSTEM.md`](./docs/UI-DESIGN-SYSTEM.md)
- Tokens live in `apps/web/src/styles/tokens.css`
- Patterns: `apps/web/src/styles/patterns.module.css`

No Tailwind. Components consume semantic / component tokens only.

---

## Product scope (MVP)

1. Shield public ERC-20 → confidential balance (Nox / ERC-7984)
2. Submit encrypted swap intent into an epoch
3. TEE nets batch; residual settles on **unmodified Uniswap**
4. User decrypts fill via ACL; optional unshield

**Non-goals (for now):** Aave (stretch), mainnet, AI agents, forking Uniswap.

---

## App surfaces

| Route | Purpose |
|---|---|
| `/` | Product landing |
| `/app` | Overview: open epoch, sealed intent count, entry points |
| `/app/shield` | Wrap public ERC-20 → confidential balance; unwrap back out |
| `/app/intent` | Encrypt side/amount/limit locally; seal into the open epoch |
| `/app/epoch` | Epoch clock + lifecycle; on settle, private fill vs public residual |
| `/app/fills` | Fill history and per-fill decrypt; intent history with cancel |
| `/app/auditor` | Grant/revoke observer access; decrypt as an authorized observer |
| `/styleguide` | Living design-system reference (noindex) |

Every number shown comes from chain state or a tx receipt — there is no mock data path in the app.

---

## Network

- **Target:** Ethereum Sepolia (`chainId` 11155111)
- Contract addresses live in [`deployments/sepolia.json`](./deployments/sepolia.json)

### Known Sepolia limitation (honest status)

Residual settlement is fully implemented and green in the contract test suite, but **on Sepolia only balanced epochs (residual = 0) currently reach `Settled`**. Three independent reasons, all environmental rather than logic bugs:

1. The deployed router at `0x3bFA…e48E` is **SwapRouter02**, whose `exactInputSingle` struct omits `deadline`; `contracts/interfaces/ISwapRouter.sol` encodes the classic selector.
2. No mWETH/mUSDC Uniswap v3 pool exists on Sepolia at any fee tier.
3. The settlement engine holds no token inventory yet.

A non-zero residual therefore reverts into the engine's `try/catch` and marks the epoch `Failed` — which the UI reports honestly rather than hiding. Fixing it means switching the interface to SwapRouter02, seeding a pool, and funding the engine.

---

## License

MIT (unless otherwise noted per package).

---

## Disclaimer

Phase 0 includes a compile-only `NoxageHello` contract for toolchain validation. It is **not** production product logic and will be superseded by vault / intent / settlement contracts.
