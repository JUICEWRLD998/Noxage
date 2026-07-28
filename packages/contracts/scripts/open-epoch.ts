import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Operator script — open a new intent epoch on Sepolia.
 * Requires the deployer (epoch manager owner) key in root `.env`.
 *
 *   pnpm --filter @noxage/contracts ops:open-epoch:sepolia
 */
async function main() {
  const net = network.name;
  const outPath = path.resolve(__dirname, `../../../deployments/${net}.json`);
  const deployment = JSON.parse(await fs.readFile(outPath, "utf8")) as {
    contracts: { NoxageEpochManager: string };
  };

  const [signer] = await ethers.getSigners();
  const epochs = await ethers.getContractAt(
    "NoxageEpochManager",
    deployment.contracts.NoxageEpochManager,
    signer,
  );

  const active = await epochs.activeEpochId();
  if (active > 0n) {
    console.log(`Epoch #${active} is already open — submit intents, then close when ready.`);
    return;
  }

  const tx = await epochs.openEpoch();
  const receipt = await tx.wait();
  const newId = await epochs.activeEpochId();
  console.log(`Opened epoch #${newId}. Tx: ${receipt?.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
