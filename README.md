# Noxage

**Public liquidity. Private strategy.**

Noxage is a confidential intent + batch-netting settlement layer for open DeFi. Users submit encrypted trade intents; iExec Nox TEE runners net opposing flow and settle **only the residual** on unmodified public protocols (Uniswap first). Individual sizes never appear in plaintext on-chain.

> Built for the [iExec WTF Hackathon](https://dorahacks.io/hackathon/wtf-hackathon/detail) · ETH Sepolia · iExec Nox

---

## Status

| Phase | Description | State |
|---|---|---|
| 0 | Repo bootstrap + design system | **In progress / complete on go** |
| 1 | Design system component kit + `/styleguide` | Pending |
| 2 | Confidential shield / unshield | Pending |
| 3 | Intent book + epoch manager | Pending |
| 4 | Netting + Uniswap residual settlement | Pending |
| 5–8 | Product UI, landing, docs, demo | Pending |

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

## Network

- **Target:** Ethereum Sepolia (`chainId` 11155111)
- Contract addresses will land in `deployments/sepolia.json` after Phase 2+

---

## License

MIT (unless otherwise noted per package).

---

## Disclaimer

Phase 0 includes a compile-only `NoxageHello` contract for toolchain validation. It is **not** production product logic and will be superseded by vault / intent / settlement contracts.
