# Noxage — Implementation Plan

> **Product name:** Noxage  
> **Tagline:** *Public liquidity. Private strategy.*  
> **Status:** Planning complete — **do not start build until go-ahead**  
> **Network:** Ethereum Sepolia (hackathon requirement)  
> **Privacy layer:** iExec Nox (confidential smart contracts + TEE)  
> **UI north star:** `UI-DESIGN-SYSTEM.md` (Noviq playbook) + Noxage product extensions below  

---

## 0. Product definition (real product, not a demo)

### 0.1 What Noxage is

**Noxage** is a confidential intent + batch-netting settlement layer for open DeFi.

Users submit **encrypted trade (and later borrow) intents**. Nox TEE runners collect intents into **epochs**, **net opposing flow**, and settle **only the residual** on unmodified public protocols (Uniswap first; Aave as stretch). Individual sizes, directions, and strategies never appear in plaintext on-chain. Fills are credited as **confidential balances** (ERC-7984) with **selective disclosure** via Nox ACL.

This is infrastructure a fund, DAO, or desk could deploy — not a one-off hackathon skit.

### 0.2 What Noxage is not

| Not this | Why |
|---|---|
| A private Uniswap fork | We never modify Uniswap / Aave |
| A mock / simulated privacy demo | Every path must hit real Nox + Sepolia contracts |
| A ChatGPT / AI wrapper | No LLM core product |
| A reuse of Vibe winners | Not OTC desk, not RWA mint, not prediction market |
| A wallet replacement | Works with MetaMask / Rabby / Rainbow via standard connect |

### 0.3 Core user jobs (product, not feature list)

1. **Shield** — wrap public ERC-20 → confidential balance  
2. **Submit intent** — encrypt size/direction/limit; park in epoch  
3. **Settle** — TEE nets batch; residual hits Uniswap; fills re-encrypted  
4. **Decrypt fill** — user (or granted auditor) views own result via ACL  
5. **Unshield** — optional exit to public ERC-20  

### 0.4 Privacy claims (honest product copy)

**Private**

- Intent amount  
- Intent direction (within a multi-user batch with netting)  
- Per-user fill attribution (encrypted until authorized decrypt)  
- Strategy linkage from user EOA to individual size (batch executor settles residual)

**Visible by design (do not overclaim)**

- Residual public swap/borrow on Uniswap/Aave  
- That *a* batch settlement occurred  
- Token pair of residual flow (if residual ≠ 0)

### 0.5 Success criteria (hackathon + product bar)

| Bar | Requirement |
|---|---|
| End-to-end | No mock data; real Nox + Sepolia txs |
| Deployed | Contracts + frontend live on ETH Sepolia |
| UX | Non-crypto-native can complete Shield → Intent → Fill in &lt; 3 minutes |
| Docs | README (install/deploy/use), architecture, threat model, `feedback.md` |
| Video | ≤ 4 min product demo with live Etherscan contrast |
| Design | Full Noviq token system + `/styleguide`; product surfaces match playbook |
| Product feel | Empty states, errors, loading, copy, and edge cases treated as first-class |

---

## 1. Product brand & design system

### 1.1 Source of truth

Primary: **`UI-DESIGN-SYSTEM.md`** (Noviq playbook) — copy into repo as:

```
docs/UI-DESIGN-SYSTEM.md          # full playbook (reference)
apps/web/src/styles/tokens.css    # Tier 1–3 tokens (verbatim from playbook)
apps/web/src/styles/motion.css
apps/web/src/styles/globals.css
apps/web/src/styles/patterns.module.css
apps/web/src/lib/motion.ts
```

**Non-negotiable rules from the playbook**

1. Dark-first; light = Tier 2 semantic overrides only  
2. OKLCH only — never `#000` / `#fff`  
3. 3-tier tokens; components touch **only** Tier 2–3  
4. One accent hue (electric violet ~285°)  
5. Fluid type with `clamp()`; display / sans / mono  
6. 4px base / 8px rhythm — no magic spacing  
7. Glass + edge-light + film grain + mesh patterns  
8. Shared motion tokens across CSS / Framer / GSAP  
9. `prefers-reduced-motion` three ways (CSS kill-switch, MotionConfig, JS guards)  
10. **CSS Modules + CSS variables only — no Tailwind**  

### 1.2 Noxage brand extensions (additive, not a rewrite)

Keep Noviq tokens. Add **product-semantic** aliases in `tokens.css` so DeFi UI reads clearly without inventing new hues:

```css
:root {
  /* Product roles → map to existing semantic tokens */
  --noxage-private: var(--accent);           /* sealed / encrypted state */
  --noxage-settled: var(--success);          /* fill confirmed */
  --noxage-epoch: var(--violet-300);         /* epoch / batch pulse */
  --noxage-public-rail: var(--text-muted);   /* residual public settlement */
  --noxage-danger-mev: var(--danger);        /* sandwich / leakage warning */

  /* Domain component tokens */
  --stat-label-color: var(--text-muted);
  --stat-value-color: var(--text-primary);
  --badge-private-bg: var(--accent-muted);
  --badge-private-fg: var(--violet-200);
  --badge-public-bg: var(--surface-inset);
  --badge-public-fg: var(--text-secondary);
  --epoch-track: var(--surface-inset);
  --epoch-fill: var(--accent);
  --intent-sealed-glow: var(--shadow-accent-glow);
}
```

**Typography roles for product**

| Role | Font token | Use |
|---|---|---|
| Display | `--font-display` (Space Grotesk) | Landing hero, page titles |
| Sans | `--font-sans` (Geist) | UI body, forms, nav |
| Mono | `--font-mono` (Geist Mono) | Addresses, tx hashes, handles, epoch IDs |
| Tabular | `.tabular` | Amounts, prices, countdowns |

**Copy tone:** quiet luxury, precise, calm confidence. Short sentences. Prefer “sealed”, “settled”, “residual” over crypto slang when educating.

### 1.3 Signature product UI metaphors (design additions)

These are **Noxage-specific** surfaces built *on* Noviq patterns:

| Surface | Pattern composition | Purpose |
|---|---|---|
| **Sealed Intent Card** | `glassCard` + `edgeLight` + accent glow on submit | Shows intent as locked, not “pending tx” |
| **Epoch Timeline** | track + fill using `--epoch-*` + mono countdown | Makes batching legible |
| **Privacy Split View** | two-column: Private fill vs Public residual (Etherscan link) | Demo + product education in one glance |
| **Wake Meter** | subtle progress of “how much of your flow was netted away” | Emotional product moment |
| **ACL Auditor Panel** | glass inset + mono keys | Selective disclosure UX |
| **Landing storyboard** | mesh + grain + optional WebGL; GSAP pin only on marketing | Sell the product before connect |

### 1.4 App information architecture

```
/                     Marketing landing (product story)
/app                  App shell (connected product)
/app/shield           Shield / unshield
/app/intent           Create & manage intents
/app/epoch            Live epoch + settlement status
/app/fills            Decrypt fills / history
/app/auditor          Optional ACL grant + auditor view
/styleguide           Design system living reference (noindex / dev-friendly)
```

### 1.5 Component kit (build order)

**From Noviq (Phase 2)**  
`Button`, `Card`, `Badge`, `Field`/`Input`, `Skeleton`, `Stat`, `Toast`, `Container`, `Stack`, `Grid`, `PageHeader`, `ThemeToggle`, `CodeBlock`

**Noxage product (Phase 5–6)**  
`WalletConnectButton`, `TokenAmountField`, `ShieldPanel`, `IntentForm`, `SealedIntentCard`, `EpochClock`, `EpochProgress`, `PrivacySplitView`, `WakeMeter`, `FillCard`, `TxHashLink`, `NetworkBadge`, `EmptyState`, `ErrorState`, `ConfirmDialog`

**Radix primitives**  
Dialog, Tabs, Toast, Tooltip, Dropdown Menu — unstyled + token-styled only.

---

## 2. Technical architecture

### 2.1 Monorepo layout (recommended)

```
noxage/
├── README.md
├── implementation.md
├── feedback.md                      # required by hackathon
├── docs/
│   ├── UI-DESIGN-SYSTEM.md          # copied playbook
│   ├── ARCHITECTURE.md
│   ├── THREAT-MODEL.md
│   └── DEMO-SCRIPT.md
├── packages/
│   ├── contracts/                   # Hardhat + Nox plugin
│   │   ├── contracts/
│   │   ├── scripts/
│   │   ├── test/
│   │   └── hardhat.config.ts
│   └── sdk/                         # thin client helpers (optional if time)
├── apps/
│   └── web/                         # Next.js product frontend
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── styles/
│       │   ├── lib/
│       │   └── hooks/
│       └── public/
└── .env.example
```

### 2.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Contracts | Solidity 0.8.x + Nox Hardhat plugin + starter | Official Nox path |
| Confidential tokens | ERC-7984 / Nox confidential contracts | Native hidden balances |
| Settlement | Uniswap v3 SwapRouter (Sepolia) | Unmodified public rail |
| Frontend | Next.js (App Router) + TypeScript | Deployable product |
| Styling | CSS Modules + tokens (no Tailwind) | Matches design system |
| Wallet | wagmi + viem + WalletConnect / injected | Real wallets, real txs |
| Data | TanStack Query | Live epoch/fill polling |
| Motion | framer-motion + gsap (landing only) | Playbook-aligned |
| Optional hero | three + R3F + drei | Progressive enhancement |

### 2.3 On-chain / TEE flow

```
User wallet
  │ encrypt intent (Nox handle SDK)
  ▼
NoxageIntentBook (confidential inputs)
  │ epoch closes
  ▼
Nox Runner (TEE)
  │ decrypt · net · clear · produce settlement plan
  ▼
NoxageSettlementExecutor
  │ residual only
  ▼
Uniswap v3 Router (unmodified)
  │
  ▼
Credit encrypted fills → user confidential balances
  │ ACL
  ▼
User decrypts own fill (auditor optional)
```

### 2.4 Core contracts (MVP)

| Contract | Responsibility |
|---|---|
| `NoxageVault` / wrappers | Shield & unshield public ERC-20 ↔ confidential |
| `NoxageIntentBook` | Accept encrypted intents; epoch membership; cancel rules |
| `NoxageEpochManager` | Epoch id, open/close, status, settlement root/ref |
| `NoxageNettingEngine` (confidential compute path) | Net intents inside TEE; output residual + per-user fills |
| `NoxageSettlementExecutor` | Call Uniswap with residual; never sees plaintext user intents on-chain |
| `NoxageFillLedger` | Encrypted fill handles + ACL hooks |

**Design constraint:** public contracts store **handles**, not amounts. Plaintext only inside attested TEE compute.

### 2.5 Epoch model (product rules)

| Parameter | MVP default | Notes |
|---|---|---|
| Epoch duration | 45–60 seconds | Tunable; show countdown in UI |
| Min intents to settle | 1 (solo residual OK) | Netting quality improves with ≥2 |
| Cancel window | Until epoch close | No cancel after sealed for compute |
| Limit price | Encrypted optional in MVP | Enforce in TEE if present |
| Failed residual | Mark epoch failed; refund/credit handles | Never leave funds undefined |

### 2.6 Environments

| Env | Use |
|---|---|
| Local Hardhat + Nox local tooling | Unit + integration tests |
| ETH Sepolia | Official hackathon deployment |
| Frontend preview (Vercel or similar) | Public product URL |

---

## 3. Implementation phases

> Each phase ends with a **Definition of Done**. Do not start the next phase until DoD is met.  
> **Go-ahead gate:** Phase 0 only after explicit user approval.

---

### Phase 0 — Alignment & repo bootstrap  
**Goal:** Locked scope, empty runnable skeleton, design system imported.  
**Duration estimate:** 0.5–1 day  

**Tasks**

1. Confirm product name **Noxage**, MVP scope (Uniswap residual only; Aave = stretch).  
2. Scaffold monorepo (`apps/web`, `packages/contracts`).  
3. Copy `UI-DESIGN-SYSTEM.md` → `docs/UI-DESIGN-SYSTEM.md`.  
4. Install web stack (Next.js, wagmi, viem, framer-motion, Radix, gsap optional).  
5. Install contracts stack (Hardhat, Nox plugin, starter patterns).  
6. Create `.env.example` (RPC, private key deploy-only, WalletConnect project id, Nox endpoints).  
7. Write stub `README.md` + `docs/ARCHITECTURE.md` outline.  
8. Create empty `feedback.md` with sections to fill during build.  

**Definition of Done**

- [ ] `pnpm install` / install works  
- [ ] Next app boots with mesh + grain background and tokens loaded  
- [ ] Hardhat project compiles empty / hello contract  
- [ ] No product logic yet; no fake privacy  

---

### Phase 1 — Design system foundation (UI kernel)  
**Goal:** Noviq system is the product’s visual OS before any DeFi screens.  
**Duration estimate:** 1–1.5 days  

**Tasks**

1. Port `tokens.css` verbatim (primitives → semantic → component).  
2. Add Noxage product aliases (§1.2).  
3. Port `motion.css`, `globals.css`, `patterns.module.css`, `lib/motion.ts`.  
4. Wire `next/font`: Space Grotesk, Geist, Geist Mono → `--font-*-src`.  
5. No-FOUC theme script + `ThemeToggle` (localStorage `app-theme`).  
6. Wrap app in `<MotionConfig reducedMotion="user">`.  
7. Build base kit: `Button`, `Card`, `Badge`, `Field`, `Skeleton`, `Stat`, `Toast`, layout primitives.  
8. Ship `/styleguide` (all tokens, patterns, components, theme toggle).  
9. Landing shell: full-bleed `mesh filmGrain`, quiet hero placeholder.  

**Definition of Done**

- [ ] `/styleguide` proves token system  
- [ ] No Tailwind; no raw hex blacks/whites  
- [ ] Reduced-motion verified  
- [ ] Components only use Tier 2–3 tokens  

---

### Phase 2 — Contracts: confidential balances (shield / unshield)  
**Goal:** Real confidential value path on Sepolia.  
**Duration estimate:** 1.5–2 days  

**Tasks**

1. Integrate Nox confidential contracts / ERC-7984 patterns via wizard + hardhat starter.  
2. Deploy mock or faucet ERC-20s on Sepolia if needed (USDC/WETH stand-ins).  
3. Implement shield: public ERC-20 → confidential balance.  
4. Implement unshield: confidential → public ERC-20.  
5. ACL: owner can decrypt own balance; grant/revoke viewer.  
6. Unit tests: shield, transfer confidential, unshield, ACL.  
7. Deploy to Sepolia; record addresses in `deployments/sepolia.json`.  

**Definition of Done**

- [ ] Real Sepolia txs for shield/unshield  
- [ ] Balances not plaintext on-chain  
- [ ] Tests green locally  
- [ ] Addresses documented  

---

### Phase 3 — Contracts: intent book + epoch manager  
**Goal:** Users can seal intents into epochs without leaking amounts.  
**Duration estimate:** 1.5–2 days  

**Tasks**

1. `NoxageIntentBook`: submit encrypted intent handles (pair, side, amount handle, limit handle, deadline).  
2. `NoxageEpochManager`: open epoch, accept intents, close epoch, status enum.  
3. Cancel intent only while epoch open.  
4. Events for UI indexing: `IntentSubmitted`, `EpochOpened`, `EpochClosed`, `EpochSettled`, `EpochFailed` (no plaintext amounts in events).  
5. Tests: multi-user submit, cancel, close, invalid state transitions.  

**Definition of Done**

- [ ] Intents stored as handles only  
- [ ] Epoch lifecycle works on Sepolia  
- [ ] Frontend can later poll status from events/RPC  

---

### Phase 4 — Confidential netting + Uniswap residual settlement  
**Goal:** The product heart — privacy membrane over public Uniswap.  
**Duration estimate:** 2–3 days  

**Tasks**

1. Define TEE compute payload: list of intents → netting result + residual plan + per-user fills.  
2. Implement netting rules (MVP):  
   - Same pair only per epoch (start with one pair, e.g. USDC/WETH)  
   - Sum buy vs sell; residual = |buy − sell| in the heavy direction  
   - Pro-rata or FIFO fill attribution (document choice; prefer **pro-rata** for fairness story)  
3. Wire Nox confidential compute / runner path per official docs.  
4. `NoxageSettlementExecutor` calls **unmodified** Uniswap v3 router with residual only.  
5. Credit encrypted fills to users; update epoch to `Settled`.  
6. Failure path: residual swap reverts → epoch `Failed` + safe fund handling.  
7. Integration test: 2 opposing intents net partially; residual swap executes; both users get fills.  
8. Integration test: solo intent → full residual public swap still works (honest product behavior).  

**Definition of Done**

- [x] Multi-intent epoch settles end-to-end (local FHEVM mock; Sepolia via `deploy:settlement:sepolia`)  
- [x] Residual public swap only (`ISwapRouter.exactInputSingle` / Etherscan on Sepolia)  
- [x] User fill decryptable via ACL (`NoxageFillLedger` + tests)  
- [x] Uniswap contracts not forked/modified  
- [x] Threat model notes what remains public (`docs/THREAT-MODEL.md`)  

---

### Phase 5 — Product frontend: wallet + shield + intent  
**Goal:** Real users complete core jobs with production UX.  
**Duration estimate:** 2 days  

**Tasks**

1. wagmi config: Sepolia only (hard-gate wrong network with clear UI).  
2. Connect wallet flow (injected + WalletConnect).  
3. `/app/shield` — TokenAmountField, balances (public + confidential decrypt), Shield / Unshield CTAs.  
4. `/app/intent` — pair, side, amount, optional limit; encrypt + submit; SealedIntentCard success state.  
5. Loading / error / empty states for every async step (no silent failures).  
6. Toast system for tx submitted / confirmed / failed.  
7. Tabular nums + mono for money and hashes throughout.  

**Definition of Done**

- [ ] User can connect, shield, and submit a sealed intent on Sepolia  
- [ ] UI never claims privacy it doesn’t deliver  
- [ ] Fully keyboard accessible; focus rings present  

---

### Phase 6 — Product frontend: epoch, settlement, fills, privacy split  
**Goal:** The “wow” product surface — private vs public contrast.  
**Duration estimate:** 1.5–2 days  

**Tasks**

1. `/app/epoch` — EpochClock, progress bar, intent count (not amounts), status badges.  
2. Live poll epoch state (TanStack Query).  
3. On settle: show PrivacySplitView  
   - Left: encrypted fill → Decrypt  
   - Right: public residual tx hash → Etherscan  
4. WakeMeter: % of notional netted vs residual (educates product value).  
5. `/app/fills` — history list, decrypt per fill, export hash refs.  
6. Optional `/app/auditor` — grant ACL to second address; auditor decrypt view.  
7. Micro-interactions: seal glow, settle success, springTap on primary actions (respect reduced-motion).  

**Definition of Done**

- [ ] Full path Shield → Intent → Epoch settle → Decrypt fill works without mocks  
- [ ] PrivacySplitView usable in demo video  
- [ ] Fills history persists across refresh (chain is source of truth)  

---

### Phase 7 — Marketing landing + product polish  
**Goal:** Feels like a company shipping infrastructure, not a weekend project.  
**Duration estimate:** 1–1.5 days  

**Tasks**

1. Landing: hero (“Public liquidity. Private strategy.”), problem, how it works (3 beats), privacy honesty section, CTA → `/app`.  
2. Optional GSAP pinned storyboard (only if time; reduced-motion fallback static).  
3. Optional WebGL mesh enhancement over CSS mesh (progressive; fail silent).  
4. Empty/error copy pass; network guard; faucet / get-test-tokens help.  
5. Performance: no layout thrash; skeleton loaders; font display swap.  
6. SEO basics + `robots` noindex on `/styleguide` if public.  
7. Favicon, OG image (simple, on-brand violet glass).  

**Definition of Done**

- [ ] Landing + app feel continuous under one design system  
- [ ] First-time user can understand product before connecting  
- [ ] No broken states on cold load  

---

### Phase 8 — Hardening, docs, feedback, deploy  
**Goal:** Submission-ready product artifact.  
**Duration estimate:** 1–1.5 days  

**Tasks**

1. Security pass: reentrancy, access control, epoch edge cases, no plaintext leaks in events/logs.  
2. Expand tests for failure paths.  
3. `README.md`: install, env, deploy, run, Sepolia addresses, architecture diagram, privacy model.  
4. `docs/THREAT-MODEL.md` — what is private / public / trusted (TEE assumptions).  
5. `docs/DEMO-SCRIPT.md` — 4-minute video beat sheet.  
6. Fill `feedback.md` with real Nox tooling friction + praise (required).  
7. Deploy frontend; verify production env vars.  
8. Smoke test full path on clean browser + fresh wallet.  
9. Record demo video (≤ 4 min).  
10. Prepare X post + public GitHub.  

**Definition of Done**

- [ ] All hackathon deliverables satisfied  
- [ ] No mock paths in production build  
- [ ] Third person can run from README alone  

---

### Phase 9 — Stretch (only if Phases 0–8 are solid)  
**Do not start early.**  

| Stretch | Value |
|---|---|
| Aave residual supply/borrow path | Second public rail; deeper composability story |
| Multi-pair epochs | More product-complete |
| Limit-price hard enforcement in TEE | Trader-grade |
| DCA multi-epoch strategy intent | Sticky product use |
| Simple “Noxage Adapter” SDK package | Infrastructure narrative for judges |

---

## 4. Day-by-day schedule (to Aug 1, 2026)

> Adjust if team size &gt; 1. Assumes ~1 focused builder; parallelize contracts/UI if 2+.

| Days | Focus |
|---|---|
| Day 1 | Phase 0 + Phase 1 (bootstrap + design system + styleguide) |
| Day 2–3 | Phase 2 (shield/unshield on Sepolia) |
| Day 4–5 | Phase 3 (intent + epoch) |
| Day 6–8 | Phase 4 (netting + Uniswap settlement) — **critical path** |
| Day 9–10 | Phase 5 (app: wallet, shield, intent) |
| Day 11 | Phase 6 (epoch, fills, privacy split) |
| Day 12 | Phase 7 (landing + polish) |
| Day 13 | Phase 8 (docs, feedback, video, submit) |
| Buffer | Phase 9 only if ahead |

**Critical path:** Phase 4. If delayed, cut landing WebGL, auditor page, and Aave — **never** cut real settlement or real Nox.

---

## 5. Testing strategy

| Layer | What |
|---|---|
| Unit | Netting math pure functions; access control; epoch state machine |
| Contract integration | Shield → intent → settle → unshield on local + Sepolia |
| UI e2e (manual MVP) | Scripted checklist from DEMO-SCRIPT |
| Privacy regression | Grep/events review: no amount plaintext in logs/events/UI network tab from chain |
| Design regression | `/styleguide` visual check dark + light |

**Manual smoke checklist (ship gate)**

1. Connect wallet on Sepolia  
2. Get test tokens  
3. Shield  
4. Submit intent A + intent B (second wallet)  
5. Wait epoch close  
6. Confirm residual Uniswap tx  
7. Decrypt fills both wallets  
8. Unshield  
9. Wrong network shows blocking UI  
10. Reduced-motion: no broken layout  

---

## 6. Deliverables map (hackathon compliance)

| Deliverable | Where |
|---|---|
| Public GitHub | Entire `noxage` monorepo |
| README install/use | Root `README.md` |
| Deployed dApp | Frontend URL + Sepolia addresses |
| Functional frontend | `apps/web` |
| Demo video ≤ 4 min | Link in README + X post |
| `feedback.md` | Root |
| Originality | Architecture docs; no Vibe project reuse |
| ETH Sepolia | All product txs |
| No mock data | Enforced in Phase 4–6 DoD |

---

## 7. Risk register & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Nox docs/tooling incomplete | Blocks Phase 4 | Start Nox hello-world Day 1; Discord support early; validate idea with iExec |
| Uniswap Sepolia liquidity thin | Residual swap fails | Seed pool or use well-known Sepolia deployment; document faucet path |
| Epoch UX confusion | Users bounce | EpochClock + plain-language status; landing education |
| Over-scoping | Incomplete product | Phase 9 frozen until 0–8 done |
| Privacy overclaim | Trust / judge penalty | Honest PrivacySplitView + threat model |
| Design drift | Unprofessional UI | Styleguide + token-only components |
| Single-intent batches | Weaker “netting” story | Demo script always uses ≥2 wallets; product still supports solo |

---

## 8. Demo video outline (product, not toy)

1. **0:00** Problem: public Uniswap leak on Etherscan  
2. **0:25** Noxage one-liner + brand  
3. **0:40** Shield (confidential balance)  
4. **1:10** Two wallets seal intents  
5. **1:50** Epoch countdown / netting visualization  
6. **2:30** Residual public settlement on Etherscan  
7. **3:00** Decrypt private fills + WakeMeter  
8. **3:30** Architecture one-slide: Nox membrane over Uniswap  
9. **3:50** CTA: GitHub + live app  

---

## 9. Explicit non-goals (until post-hackathon)

- Mainnet production custody guarantees  
- Mobile native apps  
- Cross-chain intents  
- Full CoW solver network / professional market making  
- Forking or modifying Uniswap/Aave source  
- AI agents / LLM routing  
- Reusing any Vibe Coding submission code  

---

## 10. Go-ahead checklist

When you say **go**, implementation starts at **Phase 0** and proceeds in order.

Before go-ahead, confirm:

- [ ] Product name **Noxage** is final  
- [ ] MVP = Uniswap residual settlement only (Aave stretch)  
- [ ] Design system path = Noviq playbook + Noxage aliases  
- [ ] Real product bar = no mocks, Sepolia, full path  
- [ ] This `implementation.md` is the build bible  

---

## 11. First commands after go-ahead (preview only)

```bash
# Phase 0 (do not run until go-ahead)
# scaffold monorepo, copy design system, init Next + Hardhat + Nox starter
```

No code generation or scaffolding has been started. This document is the plan only.

---

**Noxage** — public liquidity, private strategy.  
Built on iExec Nox. Designed with the Noviq UI system. Shipped as a product.
