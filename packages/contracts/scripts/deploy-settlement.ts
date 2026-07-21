import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Phase 4 deployment — fill ledger + settlement engine + wiring.
 *
 * Prerequisites: Phase 2 (confidential tokens / mock underlyings) and Phase 3
 * (epoch manager + intent book) already deployed; addresses in
 * `deployments/<network>.json`.
 *
 * Deploys:
 *   1. NoxageFillLedger
 *   2. NoxageSettlementEngine (bound to epoch manager, intent book, ledger,
 *      Uniswap v3 SwapRouter, base/quote underlyings)
 * Then wires:
 *   - fillLedger.setEngine(engine)
 *   - intentBook.setSettlementEngine(engine)
 *   - epochManager.setSettlementEngine(engine)
 *
 * Addresses are merged into `deployments/<network>.json`.
 */

/** Canonical Uniswap v3 SwapRouter on Ethereum Sepolia (unmodified). */
const UNISWAP_V3_SWAP_ROUTER_SEPOLIA = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

/** Default pool fee tier: 0.3%. */
const DEFAULT_POOL_FEE = 3000;

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const deployerAddr = await deployer.getAddress();
  console.log(`\nDeploying Noxage settlement layer to: ${net}`);
  console.log(`Deployer: ${deployerAddr}\n`);

  const outPath = path.resolve(__dirname, `../../../deployments/${net}.json`);
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(outPath, "utf8"));
  } catch {
    throw new Error(
      `No deployments/${net}.json found. Run Phase 2 + Phase 3 deploys first.`,
    );
  }

  const contracts =
    typeof existing.contracts === "object" && existing.contracts !== null
      ? (existing.contracts as Record<string, unknown>)
      : {};

  const requireAddr = (key: string): string => {
    const v = contracts[key];
    if (typeof v !== "string" || !v || v === "null") {
      throw new Error(`Missing ${key} in deployments/${net}.json`);
    }
    return v;
  };

  const epochManagerAddr = requireAddr("NoxageEpochManager");
  const intentBookAddr = requireAddr("NoxageIntentBook");
  // Prefer mock underlyings (Phase 2) as the public residual pair.
  const baseTokenAddr = requireAddr("MockWETH");
  const quoteTokenAddr = requireAddr("MockUSDC");

  const swapRouterAddr =
    (typeof contracts.UniswapV3SwapRouter === "string" &&
    contracts.UniswapV3SwapRouter
      ? (contracts.UniswapV3SwapRouter as string)
      : null) ||
    (net === "sepolia" ? UNISWAP_V3_SWAP_ROUTER_SEPOLIA : null);

  if (!swapRouterAddr) {
    throw new Error(
      "No UniswapV3SwapRouter address. Set contracts.UniswapV3SwapRouter or deploy on sepolia.",
    );
  }

  console.log(`  Epoch manager:  ${epochManagerAddr}`);
  console.log(`  Intent book:    ${intentBookAddr}`);
  console.log(`  Base (mWETH):   ${baseTokenAddr}`);
  console.log(`  Quote (mUSDC):  ${quoteTokenAddr}`);
  console.log(`  Swap router:    ${swapRouterAddr}`);
  console.log(`  Pool fee:       ${DEFAULT_POOL_FEE}\n`);

  // 1. Fill ledger (engine wired after engine deploys).
  const Ledger = await ethers.getContractFactory("NoxageFillLedger");
  const ledger = await Ledger.deploy();
  await ledger.waitForDeployment();
  const ledgerAddr = await ledger.getAddress();
  console.log(`  NoxageFillLedger:        ${ledgerAddr}`);

  // 2. Settlement engine.
  const Engine = await ethers.getContractFactory("NoxageSettlementEngine");
  const engine = await Engine.deploy(
    deployerAddr,
    epochManagerAddr,
    intentBookAddr,
    ledgerAddr,
    swapRouterAddr,
    baseTokenAddr,
    quoteTokenAddr,
    DEFAULT_POOL_FEE,
  );
  await engine.waitForDeployment();
  const engineAddr = await engine.getAddress();
  console.log(`  NoxageSettlementEngine:  ${engineAddr}`);

  // 3. Wire the triangle.
  const wireLedger = await ledger.setEngine(engineAddr);
  await wireLedger.wait();
  console.log(`  Wired fill ledger → engine (tx ${wireLedger.hash})`);

  const book = await ethers.getContractAt("NoxageIntentBook", intentBookAddr);
  const wireBook = await book.setSettlementEngine(engineAddr);
  await wireBook.wait();
  console.log(`  Wired intent book → engine (tx ${wireBook.hash})`);

  const epochs = await ethers.getContractAt("NoxageEpochManager", epochManagerAddr);
  const wireEpochs = await epochs.setSettlementEngine(engineAddr);
  await wireEpochs.wait();
  console.log(`  Wired epoch manager → engine (tx ${wireEpochs.hash})\n`);

  const deployed: Record<string, string> = {
    NoxageFillLedger: ledgerAddr,
    NoxageSettlementEngine: engineAddr,
    UniswapV3SwapRouter: swapRouterAddr,
  };

  const mergedContracts = {
    ...contracts,
    ...deployed,
    // Keep the older name as an alias so UI/docs that still say "Executor" resolve.
    NoxageSettlementExecutor: engineAddr,
  };

  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const merged = {
    ...existing,
    chainId: Number(chainId),
    network: net,
    note:
      "Phase 2: confidential balances. Phase 3: intent book + epoch manager. " +
      "Phase 4: fill ledger + settlement engine (homomorphic netting + residual Uniswap). " +
      "Deploy: pnpm --filter @noxage/contracts deploy:settlement:sepolia",
    contracts: mergedContracts,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`Wrote addresses to ${outPath}`);
  console.log(
    "\nNext: fund the settlement engine with base+quote inventory for residual swaps,",
  );
  console.log("then open an epoch and submit intents.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
