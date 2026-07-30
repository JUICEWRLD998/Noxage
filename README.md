<div align="center">

# Noxage

### Confidential intent settlement for open DeFi

**Public liquidity. Private strategy.**

Noxage encrypts trade intents, nets opposing orders inside encrypted state, and sends only the aggregate residual to public liquidity.

[![Network](https://img.shields.io/badge/Network-Ethereum_Sepolia-627EEA)](https://sepolia.etherscan.io/)
[![Privacy](https://img.shields.io/badge/Privacy-iExec_Nox-5B44F2)](https://docs.iex.ec/nox-protocol/getting-started/welcome)
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

Noxage is an Ethereum Sepolia batch intent application powered by iExec Nox:

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

The current release stores encrypted limits but does **not** enforce them during
settlement. The clearing price is supplied by the settlement owner and is not
independently verified by an oracle.

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

### iExec Nox Integration

Noxage uses iExec Nox throughout its confidential workflow:

- `@iexec-nox/nox-protocol-contracts` and its `Nox` Solidity SDK for encrypted
  handles, confidential arithmetic, ACLs, and public-decryption proof checks;
- `@iexec-nox/nox-confidential-contracts` for the ERC-7984 confidential token
  layer;
- `@iexec-nox/handle` in the web application for input encryption, authorized
  decryption, public decryption, and ACL inspection;
- the NoxCompute proxy configured for the active chain.

For Ethereum Sepolia (`chainId 11155111`), the installed Nox packages resolve
NoxCompute to `0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF`. The web client uses
the Handle SDK's built-in Sepolia gateway, NoxCompute, and subgraph
configuration. Custom endpoints are supported when all three
`NEXT_PUBLIC_NOX_*` values are supplied together.

The active deployment integrates Nox input encryption, encrypted-handle ACLs,
confidential aggregation, public decryption, proof verification, and private
fill decryption. Public residual execution is a separate Uniswap operation and
requires a funded settlement engine and a liquid pool for the configured token
pair.

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
- Clear failed-settlement states based on on-chain data

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
`-- deployments/                   # Network deployment metadata
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

The template documents the variables used by Hardhat, the web client, and the
settlement operator scripts. The web application is restricted to Ethereum
Sepolia and uses the Handle SDK's built-in Sepolia configuration by default.

```dotenv
SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
DEPLOYER_PRIVATE_KEY=0xYOUR_DISPOSABLE_SEPOLIA_KEY

NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL=https://your-archive-capable-sepolia-rpc.example
NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS=
NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS=
NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS=
NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS=
NEXT_PUBLIC_NOXAGE_DEPLOY_BLOCK=11381544
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS=
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS=
NEXT_PUBLIC_MOCK_USDC_ADDRESS=
NEXT_PUBLIC_MOCK_WETH_ADDRESS=
```

Optional Handle SDK overrides must be configured as one set:

```bash
NEXT_PUBLIC_NOX_GATEWAY_URL=https://...
NEXT_PUBLIC_NOX_COMPUTE_ADDRESS=0x...
NEXT_PUBLIC_NOX_SUBGRAPH_URL=https://...
```

Never commit `.env`, `.env.local`, private keys, or RPC credentials. The
deployment JSON files contain public addresses only.

### 3. Run the Application

```bash
pnpm dev
```

Open `http://localhost:3000`.

### 4. Deploy to Vercel

Create a Vercel project for the repository and set its Root Directory to
`apps/web`. Add these variables to the Production and Preview environments:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL=https://your-archive-capable-sepolia-rpc.example
NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS=
NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS=
NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS=
NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS=
NEXT_PUBLIC_NOXAGE_DEPLOY_BLOCK=11381544
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS=
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS=
NEXT_PUBLIC_MOCK_USDC_ADDRESS=
NEXT_PUBLIC_MOCK_WETH_ADDRESS=
```

The three `NEXT_PUBLIC_NOX_*` variables are optional because the Handle SDK
provides Sepolia defaults. Configure all three together only when using custom
Nox infrastructure.

Do not add `DEPLOYER_PRIVATE_KEY`, `EPOCH_ID`, `CLEARING_PRICE_NUM`,
`CLEARING_PRICE_DEN`, or `AMOUNT_OUT_MINIMUM` to Vercel. They belong to local
deployment and operator scripts, not the browser application.

After changing a `NEXT_PUBLIC_*` value, redeploy the Vercel project so the new
value is included in the browser build.

### 5. Verify the Workspace

```bash
pnpm contracts:compile
pnpm contracts:test
pnpm run lint
pnpm run build
```

The contract suite contains 11 tests covering metadata, access controls,
deployment wiring, epoch transitions, proof-bearing ABI shapes, and settlement
guards.

---

## Deployed Contracts

The repository includes a coordinated iExec Nox deployment for Ethereum
Sepolia (`chainId 11155111`).

| Contract | Address |
| --- | --- |
| Public test mUSDC | [`0xba20779f314f23e31BBd88F81bDb9eeB28C45C5b`](https://sepolia.etherscan.io/address/0xba20779f314f23e31BBd88F81bDb9eeB28C45C5b) |
| Confidential mUSDC | [`0x248D3936dB5D977B41344A92FAFA8149654DAE0A`](https://sepolia.etherscan.io/address/0x248D3936dB5D977B41344A92FAFA8149654DAE0A) |
| Public test mWETH | [`0xD372130cEEC7a30ffBfd5eB20046729236Ba788e`](https://sepolia.etherscan.io/address/0xD372130cEEC7a30ffBfd5eB20046729236Ba788e) |
| Confidential mWETH | [`0xa760829c354D342f4019a46D75f7727505c87a4E`](https://sepolia.etherscan.io/address/0xa760829c354D342f4019a46D75f7727505c87a4E) |
| `NoxageIntentBook` | [`0x64Ca42EA8e40abEA78eF0cd834c377410b5ceB40`](https://sepolia.etherscan.io/address/0x64Ca42EA8e40abEA78eF0cd834c377410b5ceB40) |
| `NoxageEpochManager` | [`0xBDB4eF07B44F72ebF6bBe8C73c9CACd093e86Dbd`](https://sepolia.etherscan.io/address/0xBDB4eF07B44F72ebF6bBe8C73c9CACd093e86Dbd) |
| `NoxageSettlementEngine` | [`0xD2A7DC2aC42411f7179d121b324043AA7aA48f0f`](https://sepolia.etherscan.io/address/0xD2A7DC2aC42411f7179d121b324043AA7aA48f0f) |
| `NoxageFillLedger` | [`0x9eC01D58F63486094df88B876e2F2a64613ADD82`](https://sepolia.etherscan.io/address/0x9eC01D58F63486094df88B876e2F2a64613ADD82) |
| `UniswapV3SwapRouter` | [`0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E) |

Deployment metadata: [deployments/sepolia.json](./deployments/sepolia.json).

---

## Sepolia Deployment

The intent book and settlement engine are bound to
`keccak256("mWETH/mUSDC")`. Their wiring functions are write-once, so the
contracts must be deployed and configured as one coordinated set.

```bash
pnpm contracts:deploy:sepolia
pnpm contracts:preflight:sepolia
```

The coordinated deploy command runs the confidential, intent, and settlement
phases in order. The first phase creates a new `deploymentId`; later phases
refuse metadata from a different backend or phase. Preflight checks bytecode,
write-once wiring, owners, token underlyings, the supported pair, deployment
metadata, and the expected NoxCompute proxy.

Before opening an epoch, confirm that:

- the contracts resolve the expected Ethereum Sepolia NoxCompute proxy;
- the web Handle client resolves the same gateway, NoxCompute address, and
  subgraph;
- the deployment JSON references the new engine, book, ledger, and epoch manager;
- the settlement engine is wired into the intent book and epoch manager;
- the engine holds enough public input-token inventory for the expected
  residual direction;
- the configured router is a SwapRouter02 deployment and its factory contains
  the intended pool;
- the exact deployed `mWETH/mUSDC` pair has an initialized pool at fee tier
  `3000` with usable liquidity;
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
non-zero. It also validates the active deployment metadata.

For repeatable testing before public liquidity is provisioned, submit equal
opposing base amounts in the same epoch. A perfect net produces a zero residual,
skips the router entirely, and exercises the remaining fill-credit path. A
failed epoch is terminal in the current contract version; retry with a new
epoch.

---

## Project Status

Noxage is a hackathon project and has not been audited. Use testnet assets and
disposable operator keys only.

### Current Limitations

- The web Handle client uses the SDK's built-in Ethereum Sepolia configuration
  by default; custom gateway, NoxCompute, and subgraph overrides are supported
  only as a complete three-value set.
- Intent direction is represented as encrypted `bool`; amounts, limits,
  confidential balances, and fill legs use encrypted `uint256`.
- Non-zero residual execution also requires a funded settlement engine and a liquid `mWETH/mUSDC` Sepolia pool.
- Encrypted limit values are stored but are not yet enforced.
- The owner supplies the clearing price and controls finalization.
- Failed epochs do not currently have an on-chain retry or refund workflow.
- Intent submission does not reserve or debit confidential balances, and fill
  crediting records encrypted accounting legs rather than transferring user
  assets. Asset-backed settlement is outside the current release.
- Single-intent epochs can reveal the full intent through the public residual.
- Nox services, the RPC provider, the connected wallet, and the settlement
  operator remain operational dependencies.

---

## License

MIT, unless a package or dependency states otherwise.

---

<div align="center">

**Built for the iExec Write The Future Hackathon**

Confidential intent settlement without abandoning public liquidity.

[Repository](https://github.com/JUICEWRLD998/Noxage)
</div>
