import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Phase 3 deployment — intent book + epoch manager.
 *
 * Deploys:
 *   1. NoxageEpochManager (owner = deployer, tunable epoch duration).
 *   2. NoxageIntentBook bound to that epoch manager.
 * Then wires the intent book into the epoch manager (one-time, immutable).
 *
 * Addresses are merged into `deployments/<network>.json`.
 */

const EPOCH_DURATION_SECONDS = 60;

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const deployerAddr = await deployer.getAddress();
  console.log(`\nDeploying Noxage intent layer to: ${net}`);
  console.log(`Deployer: ${deployerAddr}\n`);

  const Epochs = await ethers.getContractFactory("NoxageEpochManager");
  const epochs = await Epochs.deploy(deployerAddr, EPOCH_DURATION_SECONDS);
  await epochs.waitForDeployment();
  const epochsAddr = await epochs.getAddress();
  console.log(`  NoxageEpochManager: ${epochsAddr}`);

  const Book = await ethers.getContractFactory("NoxageIntentBook");
  const book = await Book.deploy(epochsAddr);
  await book.waitForDeployment();
  const bookAddr = await book.getAddress();
  console.log(`  NoxageIntentBook:   ${bookAddr}`);

  const wireTx = await epochs.setIntentBook(bookAddr);
  await wireTx.wait();
  console.log(`  Wired intent book into epoch manager (tx ${wireTx.hash})\n`);

  const deployed: Record<string, string> = {
    NoxageEpochManager: epochsAddr,
    NoxageIntentBook: bookAddr,
  };

  // Merge into deployments/<network>.json without clobbering existing keys.
  const outPath = path.resolve(__dirname, `../../../deployments/${net}.json`);
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(outPath, "utf8"));
  } catch {
    // First deploy for this network — start fresh.
  }

  const contracts = {
    ...(typeof existing.contracts === "object" && existing.contracts !== null
      ? (existing.contracts as Record<string, unknown>)
      : {}),
    ...deployed,
  };

  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const merged = {
    ...existing,
    chainId: Number(chainId),
    network: net,
    contracts,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`Wrote addresses to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
