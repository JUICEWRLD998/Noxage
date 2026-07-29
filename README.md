<div align="center">

# Noxage

### Confidential intent settlement for open DeFi

**Public liquidity. Private strategy.**

Noxage encrypts trade intents, nets opposing orders inside encrypted state, and sends only the aggregate residual to public liquidity.

[![Network](https://img.shields.io/badge/Network-Ethereum_Sepolia-627EEA)](https://sepolia.etherscan.io/)
[![Encryption](https://img.shields.io/badge/Encryption-Zama_FHEVM-111111)](https://www.zama.ai/)
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

Noxage is a privacy-preserving batch intent prototype for Ethereum Sepolia:

1. A user encrypts their trade direction, amount, and optional limit locally.
2. Encrypted intents are collected into a time-bounded epoch.
3. The settlement engine homomorphically totals buy and sell flow without revealing individual values.
4. Opposing flow is netted inside encrypted state.
5. Only the aggregate residual is decrypted and sent to an unmodified Uniswap SwapRouter02-compatible router.
6. Each user's fill is recorded as encrypted data and can be decrypted only through the FHE access-control layer.

The result is not a "fully invisible swap." The batch, pair, participants, timing, and final residual remain observable. The privacy benefit comes from preventing individual sizes and directions from appearing in plaintext when multiple opposing intents share an epoch.

---

## How It Works

### 1. Shield

Users wrap public test tokens into ERC-7984 confidential balances. The resulting balances are represented by encrypted handles rather than plaintext token amounts.

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

The settlement owner submits the KMS-signed public-decryption proof to `finalizeSettlement`.

- A zero residual settles without calling the router.
- A non-zero residual is sent to the configured SwapRouter02-compatible router.
- A failed residual swap marks the epoch as `Failed` and credits no fills.

### 6. Decrypt the Fill

Successful settlement writes encrypted fill legs to `NoxageFillLedger`. Users explicitly sign a decrypt request to view their own fills. Decrypted values are held in browser memory and are not persisted by the app.

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

See [docs/THREAT-MODEL.md](./docs/THREAT-MODEL.md) for the complete trust assumptions and leakage analysis.

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
  | owner-gated FHE ACL    |
  +-----------+------------+
              |
              | explicit signed decrypt request
              v
          Fill owner
```

### Component Responsibilities

| Component | Responsibility |
| --- | --- |
| `NoxageConfidentialToken` | ERC-7984 wrapper for shielding and unshielding public ERC-20 balances |
| `NoxageEpochManager` | Enforces the `None -> Open -> Closed -> Settled or Failed` epoch lifecycle |
| `NoxageIntentBook` | Validates the configured pair and stores encrypted intent handles |
| `NoxageSettlementEngine` | Nets encrypted flow, verifies the residual proof, executes the public residual, and credits fills |
| `NoxageFillLedger` | Stores one encrypted fill record per intent with owner ACL access |
| Web application | Handles wallet access, encryption, contract reads and writes, decryption, and transaction states |

### iExec Nox Integration Status

The current Sepolia MVP is designed for the iExec Nox use case, but the Nox
runner is **not yet connected to the live settlement path**.

- The browser encrypts and decrypts values through the Zama FHEVM relayer SDK.
- The contracts use FHEVM encrypted types and access control to store intents,
  net buy and sell flow, and protect balances and fills.
- `prepareSettlement` performs the encrypted netting on-chain.
- The Zama KMS reveals only the aggregate residual, which is verified by
  `finalizeSettlement` before any public swap.
- `NOX_GATEWAY_URL` and `NOX_RUNNER_URL` are reserved configuration values, but
  no application or contract code currently calls them.

The remaining Nox integration is to send each closed epoch to an attested Nox
runner, return a verifiable settlement result, and require that result during
finalization. Until that work is complete, the project should be described as a
Zama FHEVM implementation prepared for Nox integration, not as a completed Nox
runtime deployment.

---

## Key Features

### Confidential Intent Flow

- Local encryption of trade direction, amount, and optional limit
- FHE-compatible ciphertext storage and validation
- No plaintext intent amount or direction in contract events
- Explicit user signatures for confidential-value decryption

### Batch Settlement

- Time-bounded epochs
- Permissionless epoch close after expiry
- Permissionless settlement preparation
- Homomorphic buy and sell aggregation
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
| Confidential compute | Zama FHEVM and relayer SDK |
| Confidential token standard | OpenZeppelin ERC-7984 contracts |
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
|-- deployments/                   # Checked-in public network addresses
|-- docs/                          # Architecture, threat model, audit, and demo docs
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
- A Zama FHEVM-compatible relayer configuration

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

The template documents every available variable. At minimum, verify the Sepolia RPC, logs RPC, chain ID, FHEVM relayer, and deployed contract addresses.

```dotenv
SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
DEPLOYER_PRIVATE_KEY=0xYOUR_DISPOSABLE_SEPOLIA_KEY

NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL=https://your-archive-capable-sepolia-rpc.example
NEXT_PUBLIC_FHEVM_RELAYER_URL=https://relayer.testnet.zama.cloud
NEXT_PUBLIC_FHEVM_NETWORK=sepolia
```

Never commit `.env`, `.env.local`, private keys, RPC credentials, or relayer credentials. The deployment JSON files contain public addresses only.

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

Contract tests use the FHEVM mock environment and `MockSwapRouter`. Passing local tests does not prove that a live Sepolia pool exists or has sufficient liquidity.

---

## Deployed Contracts

The repository includes deployment metadata for Ethereum Sepolia (`chainId 11155111`).

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

Source of truth: [deployments/sepolia.json](./deployments/sepolia.json)

---

## Fresh Sepolia Deployment

The intent book and settlement engine are bound to `keccak256("mWETH/mUSDC")`. Their wiring functions are write-once, so contract changes require a coordinated fresh deployment.

```bash
pnpm --filter @noxage/contracts deploy:sepolia
pnpm --filter @noxage/contracts deploy:intents:sepolia
pnpm --filter @noxage/contracts deploy:settlement:sepolia
```

Before opening an epoch, confirm that:

- the deployment JSON references the new engine, book, ledger, and epoch manager;
- the settlement engine is wired into the intent book and epoch manager;
- the engine has enough public base and quote inventory;
- the configured router is a SwapRouter02 deployment;
- an `mWETH/mUSDC` pool exists at the selected fee tier and has liquidity;
- the web environment points to the same deployment.

### Operator Commands

```bash
EPOCH_ID=1 pnpm --filter @noxage/contracts ops:open-epoch:sepolia
EPOCH_ID=1 pnpm --filter @noxage/contracts ops:finalize:sepolia
```

`prepareSettlement` is permissionless and available from the epoch screen. Finalization requires the settlement engine owner. Set `AMOUNT_OUT_MINIMUM` for live residual execution; zero slippage protection is not appropriate for real funds.

---

## Project Status

Noxage is a **hackathon MVP**, not an audited production protocol. Use testnet assets and disposable operator keys only.

### Current Limitations

- The checked-in Sepolia settlement deployment predates the SwapRouter02 interface correction in the source.
- A fresh coordinated deployment is required before testing non-zero residual settlement with the current code.
- Non-zero residual execution also requires a funded settlement engine and a liquid `mWETH/mUSDC` Sepolia pool.
- Encrypted limit values are stored but are not yet enforced.
- The owner supplies the clearing price and controls finalization.
- Failed epochs do not currently have an on-chain retry or refund workflow.
- Single-intent epochs can reveal the full intent through the public residual.
- FHEVM, the relayer, KMS, RPC provider, wallet, and operator key remain trusted dependencies.
- The iExec Nox gateway, attested runner, and result-verification path are not
  yet wired into the deployed settlement flow.


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
