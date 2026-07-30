<div align="center">

# Noxage

### Confidential intent settlement for open DeFi

**Public liquidity. Private strategy.**

Noxage encrypts trade intents, nets opposing orders inside encrypted state, and sends only the aggregate residual to public liquidity.

[![Network](https://img.shields.io/badge/Network-Ethereum_Sepolia-627EEA)](https://sepolia.etherscan.io/)
[![Privacy](https://img.shields.io/badge/Privacy-iExec_Nox-5B44F2)](https://docs.iex.ec/nox-protocol/getting-started/welcome)
[![Status](https://img.shields.io/badge/Status-Hackathon_MVP-orange)](#project-status)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

[The Problem](#the-problem) | [How It Works](#how-it-works) | [Architecture](#architecture) | [Quickstart](#quickstart) | [Contracts](#deployed-contracts)

</div>

---

## The Problem

**Public blockchains expose the information traders most want to protect.**

Before and after a conventional on-chain swap, observers can see the wallet, direction, size, timing, and execution path. That transparency gives searchers and competitors a live view into user intent.

For traders, funds, DAOs, and automated strategies, this creates three recurring problems:

- **Front-running and sandwiching:** visible order flow can be targeted before execution.
- **Strategy leakage:** repeated public trades reveal allocation changes and trading patterns.
- **Size signaling:** large orders advertise demand and can move the market before execution completes.

Private liquidity pools can reduce exposure, but they fragment liquidity and weaken composability. Sending every order directly to a public AMM preserves liquidity while exposing the strategy.

Noxage explores a middle path: **keep individual intent data encrypted, net what can be matched privately, and use existing public liquidity only for the remainder.**

---

## The Thesis

**A trade does not need to be fully public to settle on public DeFi rails.**

Noxage is an Ethereum Sepolia-targeted batch intent MVP. The checked-in source
implements the following Nox-based flow, but the complete flow has not yet been
verified against a freshly deployed Noxage contract set:

1. A user encrypts their trade direction, amount, and optional limit locally.
2. Encrypted intents are collected into a time-bounded epoch.
3. The settlement engine requests confidential arithmetic over Nox encrypted handles without revealing individual values.
4. Opposing flow is netted inside encrypted state.
5. Only the aggregate residual is decrypted and sent to an unmodified Uniswap SwapRouter02-compatible router.
6. Each user's fill is recorded as an encrypted handle and can be decrypted only by an authorized Nox viewer.

The result is not a "fully invisible swap." The batch, pair, participants, timing, and final residual remain observable. The privacy benefit comes from preventing individual sizes and directions from appearing in plaintext when multiple opposing intents share an epoch.

---

## How It Works

### 1. Shield

Users wrap public test tokens into Nox ERC-7984 confidential balances. The resulting balances are represented by encrypted handles rather than plaintext token amounts.

### 2. Seal an Intent

The browser encrypts the intent before submission:

```text
side   = encrypted buy or sell direction
amount = encrypted base-token amount
limit  = encrypted optional limit value
```

The chain stores ciphertext handles and public metadata. Individual amount, direction, limit, and fill values are not emitted in plaintext events.

### 3. Batch by Epoch

Intents enter the currently open epoch. The epoch has a fixed close time, and anyone may close it after that time has elapsed.

### 4. Net While Encrypted

After the epoch closes, anyone may call `prepareSettlement`. The settlement engine computes:

```text
buy total  = encrypted sum of active buy intents
sell total = encrypted sum of active sell intents
residual   = |buy total - sell total|
```

The individual inputs remain encrypted during this calculation.

### 5. Settle the Residual

The settlement owner obtains the aggregate residual and decryption proof through the Nox Handle SDK, then submits that proof to `finalizeSettlement`.

- A zero residual settles without calling the router.
- A non-zero residual is sent to the configured SwapRouter02-compatible router.
- A failed residual swap marks the epoch as `Failed` and credits no fills.

### 6. Decrypt the Fill

Successful settlement writes encrypted fill legs to `NoxageFillLedger`. Users explicitly sign a Nox Handle SDK decrypt request to view their own fills. Decrypted values are held in browser memory and are not persisted by the app.

---

## Privacy Model

Noxage makes a deliberate distinction between encrypted values and public settlement metadata.

| Stays encrypted | Remains public |
| --- | --- |
| Individual buy or sell direction | Wallet address |
| Individual intent amount | Intent and epoch IDs |
| Optional intent limit | Trading pair and deadline |
| Confidential token balances | Epoch timing and intent count |
| Individual fill legs | Settlement ciphertext handles |
| Direction within a multi-user netted batch | Aggregate residual after decryption |
|  | Clearing price and router execution |

### Important Privacy Boundary

If an epoch contains only one active intent, the public residual can reveal that intent's full size and direction. Privacy improves when multiple opposing intents are netted together.

The MVP also stores encrypted limits but does **not** enforce them during settlement. The clearing price is supplied by the settlement owner and is not independently verified by an oracle.

The privacy boundary above is the current checked-in summary. A separate
`docs/THREAT-MODEL.md` has not yet been added to this repository.

---

## Architecture

```text
                           NOXAGE

  User wallet
      |
      | encrypt side, amount, and limit locally
      v
  +------------------------+
  | NoxageIntentBook       |
  | ciphertext handles     |
  +-----------+------------+
              |
              | epoch closes
              v
  +------------------------+
  | NoxageSettlementEngine |
  | homomorphic netting    |
  +-----------+------------+
              |
              | reveal aggregate residual only
              v
  +------------------------+
  | Public SwapRouter02    |
  | residual execution     |
  +-----------+------------+
              |
              | encrypted fill credit
              v
  +------------------------+
  | NoxageFillLedger       |
  | owner-gated Nox ACL    |
  +-----------+------------+
              |
              | explicit signed decrypt request
              v
          Fill owner
```

### Component Responsibilities

| Component | Responsibility |
| --- | --- |
| `NoxageConfidentialToken` | Nox ERC-7984 wrapper for shielding and unshielding public ERC-20 balances |
| `NoxageEpochManager` | Enforces the `None -> Open -> Closed -> Settled or Failed` epoch lifecycle |
| `NoxageIntentBook` | Validates the configured pair and stores encrypted intent handles |
| `NoxageSettlementEngine` | Nets encrypted flow, verifies the residual proof, executes the public residual, and credits fills |
| `NoxageFillLedger` | Stores one encrypted fill record per intent with owner ACL access |
| Web application | Handles wallet access, encryption, contract reads and writes, decryption, and transaction states |

### iExec Nox Integration Status

Noxage's source has been migrated from its original fhEVM implementation to the
iExec Nox protocol. The checked-in code uses:

- `@iexec-nox/nox-protocol-contracts` and its `Nox` Solidity SDK for encrypted
  handles, confidential arithmetic, ACLs, and public-decryption proof checks;
- `@iexec-nox/nox-confidential-contracts` for the ERC-7984 confidential token
  layer;
- `@iexec-nox/handle` in the web application for input encryption, authorized
  decryption, public decryption, and ACL inspection;
- the NoxCompute proxy configured for the active chain.

For Ethereum Sepolia (`chainId 11155111`), the installed Nox packages resolve
NoxCompute to `0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF`. The current web
client calls `createViemHandleClient(walletClient)` and relies on the Handle
SDK's built-in Ethereum Sepolia gateway, NoxCompute, and subgraph configuration.
It does not read environment variables for custom Nox endpoint overrides.

Source migration does not make the checked-in deployment current. A coordinated
fresh Ethereum Sepolia deployment and new deployment metadata are still
required.

**Local verification on July 30, 2026:** the migration work has been checked
with contract compilation, the local contract suite, TypeScript static checks,
frontend linting, and a production web build. Exact results from the latest run
are recorded below after the commands are rerun. These checks do not prove live
Nox confidential execution.

A small standalone Nox contract was previously compiled and deployed on
Ethereum Sepolia during integration exploration. That deployment does not prove
the migrated Noxage intent-to-settlement flow. Real Handle SDK encryption,
intent submission, confidential netting, public decryption, router execution,
fill decryption, authorization rejection, and a fresh complete Noxage Sepolia
deployment remain to be verified.

---

## Key Features

### Confidential Intent Flow

- Local encryption of trade direction, amount, and optional limit
- Nox handle storage and input-proof validation
- No plaintext intent amount or direction in contract events
- Explicit user signatures for confidential-value decryption

### Batch Settlement

- Time-bounded epochs
- Permissionless epoch close after expiry
- Permissionless settlement preparation
- Confidential buy and sell aggregation through NoxCompute
- Zero-residual settlement without a public router call
- Public execution limited to the aggregate residual

### Verifiable Product Surface

- Wallet connection and Sepolia network checks
- Shield and unshield workflows
- Encrypted intent submission and cancellation
- Epoch monitoring and operator controls
- Chain-derived intent and fill history
- Observer access for confidential token balances
- Honest failed-settlement states with no mock data fallback

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Network | Ethereum Sepolia |
| Confidential compute | iExec Nox protocol and NoxCompute |
| Confidential client | `@iexec-nox/handle` with viem |
| Confidential token standard | `@iexec-nox/nox-confidential-contracts` ERC-7984 |
| Smart contracts | Solidity, Hardhat, ethers |
| Public settlement | Uniswap SwapRouter02-compatible `exactInputSingle` |
| Frontend | Next.js 16, React 19, TypeScript |
| Web3 client | viem |
| Interface | CSS Modules, Radix UI, Framer Motion |
| Workspace | pnpm |

### Repository Structure

```text
noxage/
|-- apps/
|   `-- web/                       # Next.js product application
|-- packages/
|   `-- contracts/
|       |-- contracts/             # Solidity contracts
|       |-- scripts/               # Deployment and operator scripts
|       `-- test/                  # Contract and security regression tests
|-- deployments/                   # Legacy addresses plus standalone Nox probe metadata
|-- demo.md                        # Demo runbook; requires revalidation after migration
|-- implementation.md              # Phased implementation record
`-- feedback.md                    # iExec / Nox tooling feedback
```

---

## Product Routes

| Route | Purpose |
| --- | --- |
| `/` | Product overview and privacy model |
| `/app` | Current epoch, balances, and workflow entry points |
| `/app/shield` | Wrap public test tokens into confidential balances and unwrap them |
| `/app/intent` | Encrypt and submit an intent into the open epoch |
| `/app/epoch` | Monitor, close, prepare, and finalize an epoch |
| `/app/fills` | Review chain-derived intents and decrypt eligible fills |
| `/app/auditor` | Grant or revoke observer access for confidential token balances |
| `/styleguide` | Internal design-system reference |

---

## Quickstart

### Prerequisites

- Node.js 20 or newer
- pnpm 10
- A browser wallet such as MetaMask
- Sepolia ETH for testnet transactions
- Access to the Nox Ethereum Sepolia gateway, NoxCompute contract, and subgraph

### 1. Install

```bash
git clone https://github.com/JUICEWRLD998/Noxage.git
cd Noxage
pnpm install
```

### 2. Configure the Environment

PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps/web/.env.local
```

macOS or Linux:

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
```

The template documents the variables read by the current Hardhat configuration,
web client, and settlement finalization script. At minimum, set the Sepolia RPC
and all freshly deployed Noxage contract addresses. The web client is hard-gated
to Ethereum Sepolia and currently uses the Handle SDK's built-in Sepolia
configuration.

```dotenv
SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
DEPLOYER_PRIVATE_KEY=0xYOUR_DISPOSABLE_SEPOLIA_KEY

NEXT_PUBLIC_SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL=https://your-archive-capable-sepolia-rpc.example
NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS=0x...
NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS=0x...
NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS=0x...
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS=0x...
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS=0x...
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
NEXT_PUBLIC_MOCK_WETH_ADDRESS=0x...
```

Never commit `.env`, `.env.local`, private keys, or RPC credentials. The
deployment JSON files contain public addresses only.

### 3. Run the Application

```bash
pnpm dev
```

Open `http://localhost:3000`.

### 4. Verify the Workspace

```bash
pnpm contracts:compile
pnpm contracts:test
pnpm run lint
pnpm run build
```

The current local Nox-oriented suite contains 11 tests. It checks contract
metadata, observer and owner access controls, wiring, public epoch transitions,
proof-bearing ABI shapes, and selected failure guards. It does not execute a
complete Nox confidential operation lifecycle or a live router settlement.
Passing it does not prove that a Sepolia pool exists or has sufficient
liquidity.

---

## Deployed Contracts

The repository includes legacy deployment metadata for Ethereum Sepolia
(`chainId 11155111`). These addresses belong to the pre-Nox settlement
deployment and must not be used as proof of a migrated Nox integration.

| Contract | Address |
| --- | --- |
| `MockUSDC` | [`0x2745eaFb07Aee70e8c8122c58995AA38FC3bb71D`](https://sepolia.etherscan.io/address/0x2745eaFb07Aee70e8c8122c58995AA38FC3bb71D) |
| `NoxageConfidentialUSDC` | [`0x15caB567a82cfF81B21d8d5d00eEEb4088e9F0a7`](https://sepolia.etherscan.io/address/0x15caB567a82cfF81B21d8d5d00eEEb4088e9F0a7) |
| `MockWETH` | [`0xb9e937Ed67125D30d82b48aB9Ec234b1B39c9176`](https://sepolia.etherscan.io/address/0xb9e937Ed67125D30d82b48aB9Ec234b1B39c9176) |
| `NoxageConfidentialWETH` | [`0x5D228c8976178725a723C14A6BD6Fa5Bc35004Cb`](https://sepolia.etherscan.io/address/0x5D228c8976178725a723C14A6BD6Fa5Bc35004Cb) |
| `NoxageIntentBook` | [`0x3D979f0F9e2cCd1810494F3453BE7527270F3C00`](https://sepolia.etherscan.io/address/0x3D979f0F9e2cCd1810494F3453BE7527270F3C00) |
| `NoxageEpochManager` | [`0xECEc54293a5e13cB759b063583b6aA462AB762f5`](https://sepolia.etherscan.io/address/0xECEc54293a5e13cB759b063583b6aA462AB762f5) |
| `NoxageSettlementEngine` | [`0x014F91cbCe438bd91CEE9b65d55F1Db755F6CBA2`](https://sepolia.etherscan.io/address/0x014F91cbCe438bd91CEE9b65d55F1Db755F6CBA2) |
| `NoxageFillLedger` | [`0x2b2241C094c19D227418f1fA2a98C42Bd08A2113`](https://sepolia.etherscan.io/address/0x2b2241C094c19D227418f1fA2a98C42Bd08A2113) |
| `UniswapV3SwapRouter` | [`0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E) |

Legacy metadata: [deployments/sepolia.json](./deployments/sepolia.json). Replace
it only after the migrated contracts have been freshly deployed and verified.

---

## Fresh Sepolia Deployment

The intent book and settlement engine are bound to
`keccak256("mWETH/mUSDC")`. Their wiring functions are write-once, and the Nox
migration changes privacy-dependent bytecode and constructor wiring, so a
coordinated fresh deployment is mandatory.

```bash
pnpm contracts:deploy:sepolia
pnpm contracts:preflight:sepolia
```

The coordinated deploy command runs the confidential, intent, and settlement
phases in order. The first phase creates a new `deploymentId`; later phases
refuse metadata from a different backend or phase. Preflight requires a
`complete` iExec Nox deployment and checks bytecode, write-once wiring, owners,
token underlyings, and the supported pair. It still cannot prove gateway
encryption, confidential execution, proof delivery, or router liquidity.

Before opening an epoch, confirm that:

- the contracts resolve the expected Ethereum Sepolia NoxCompute proxy;
- the web Handle client resolves the same gateway, NoxCompute address, and
  subgraph;
- the deployment JSON references the new engine, book, ledger, and epoch manager;
- the settlement engine is wired into the intent book and epoch manager;
- the engine has enough public base and quote inventory;
- the configured router is a SwapRouter02 deployment;
- an `mWETH/mUSDC` pool exists at the selected fee tier and has liquidity;
- the web environment points to the same deployment.

### Operator Commands

```bash
pnpm contracts:open-epoch:sepolia
EPOCH_ID=1 pnpm contracts:finalize:sepolia
```

`prepareSettlement` is permissionless and available from the epoch screen.
Finalization requires the settlement engine owner. The finalize script decrypts
the aggregate residual and direction, validates the configured price ratio, and
requires a deliberate non-zero `AMOUNT_OUT_MINIMUM` when the residual is
non-zero. It refuses legacy or partially migrated deployment metadata.

---

## Project Status

Noxage is a **hackathon MVP**, not an audited production protocol. Use testnet assets and disposable operator keys only.

### Current Limitations

- The source migration to Nox primitives and the Handle SDK is implemented, but
  the complete production path has not passed live end-to-end verification.
- The web Handle client uses the SDK's built-in Ethereum Sepolia configuration;
  custom gateway, NoxCompute, and subgraph overrides are not wired.
- Intent direction is represented as encrypted `bool`; amounts, limits,
  confidential balances, and fill legs use encrypted `uint256`.
- The legacy Sepolia addresses above are not Noxage's migrated deployment.
- The checked-in Sepolia settlement deployment predates the SwapRouter02 interface correction in the source.
- A fresh coordinated deployment is required before testing non-zero residual settlement with the current code.
- Non-zero residual execution also requires a funded settlement engine and a liquid `mWETH/mUSDC` Sepolia pool.
- Encrypted limit values are stored but are not yet enforced.
- The owner supplies the clearing price and controls finalization.
- Failed epochs do not currently have an on-chain retry or refund workflow.
- Single-intent epochs can reveal the full intent through the public residual.
- Nox gateway, Nox off-chain services, RPC provider, wallet, and operator key
  remain trusted or operational dependencies within the documented threat
  model.
- Nox public-decryption proof verification and the residual router path still
  require live Ethereum Sepolia validation.
- `docs/THREAT-MODEL.md` and the other documentation files referenced by the
  original implementation plan are not checked in.


---

---

## License

MIT, unless a package or dependency states otherwise.

---

<div align="center">

**Built for the iExec Write The Future Hackathon**

Confidential intent settlement without abandoning public liquidity.

[Repository](https://github.com/JUICEWRLD998/Noxage)
</div>
