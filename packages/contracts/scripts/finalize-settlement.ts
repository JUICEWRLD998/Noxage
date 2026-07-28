import { ethers, fhevm, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

const SettlementStatus = { None: 0, Prepared: 1, Settled: 2, Failed: 3 } as const;

/**
 * Operator script — KMS-decrypt the prepared residual and finalize settlement.
 * Requires the settlement engine owner key in root `.env`.
 *
 *   EPOCH_ID=1 pnpm --filter @noxage/contracts ops:finalize:sepolia
 *
 * Optional env:
 *   CLEARING_PRICE_NUM (default 2000), CLEARING_PRICE_DEN (default 1)
 *   AMOUNT_OUT_MINIMUM (default 0)
 */
async function main() {
  const epochId = BigInt(process.env.EPOCH_ID ?? process.argv[2] ?? "0");
  if (epochId <= 0n) {
    throw new Error(
      "Set EPOCH_ID (e.g. EPOCH_ID=1 pnpm --filter @noxage/contracts ops:finalize:sepolia)",
    );
  }

  const net = network.name;
  const outPath = path.resolve(__dirname, `../../../deployments/${net}.json`);
  const deployment = JSON.parse(await fs.readFile(outPath, "utf8")) as {
    contracts: { NoxageSettlementEngine: string };
  };

  const [signer] = await ethers.getSigners();
  const engine = await ethers.getContractAt(
    "NoxageSettlementEngine",
    deployment.contracts.NoxageSettlementEngine,
    signer,
  );

  const status = await engine.settlementStatus(epochId);
  if (Number(status) !== SettlementStatus.Prepared) {
    throw new Error(
      `Epoch #${epochId} settlement status is ${status} — expected Prepared (${SettlementStatus.Prepared}). Run prepare in the app first.`,
    );
  }

  const settlement = await engine.getSettlement(epochId);
  const residualHandle = settlement.residualHandle as string;
  const dirHandle = settlement.dirHandle as string;

  console.log(`Public-decrypting residual handles for epoch #${epochId}…`);
  const { clearValues, decryptionProof } = await fhevm.publicDecrypt([
    residualHandle,
    dirHandle,
  ]);

  const residualBase = BigInt(clearValues[residualHandle] as bigint);
  const dir = BigInt(clearValues[dirHandle] as bigint);
  const buyHeavy = dir === 1n;

  const priceNum = BigInt(process.env.CLEARING_PRICE_NUM ?? "2000");
  const priceDen = BigInt(process.env.CLEARING_PRICE_DEN ?? "1");
  const amountOutMinimum = BigInt(process.env.AMOUNT_OUT_MINIMUM ?? "0");

  console.log(
    `Finalizing: residualBase=${residualBase}, buyHeavy=${buyHeavy}, price=${priceNum}/${priceDen}`,
  );

  const tx = await engine.finalizeSettlement(
    epochId,
    residualBase,
    buyHeavy,
    priceNum,
    priceDen,
    amountOutMinimum,
    decryptionProof,
  );
  const receipt = await tx.wait();
  console.log(`Settlement finalized. Tx: ${receipt?.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
