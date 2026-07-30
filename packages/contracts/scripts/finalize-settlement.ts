import { createEthersHandleClient } from "@iexec-nox/handle";
import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

const SettlementStatus = { None: 0, Prepared: 1, Settled: 2, Failed: 3 } as const;
const MAX_UINT64 = (1n << 64n) - 1n;

type Deployment = {
  chainId?: number;
  privacyBackend?: string;
  migrationStage?: string;
  deploymentId?: string;
  contracts?: Record<string, string>;
};

/**
 * Operator script — Nox-decrypt the prepared residual and finalize settlement.
 * Requires the settlement engine owner key in root `.env`.
 *
 *   EPOCH_ID=1 pnpm --filter @noxage/contracts ops:finalize:sepolia
 *
 * Optional env:
 *   CLEARING_PRICE_NUM (default 2000), CLEARING_PRICE_DEN (default 1)
 *   AMOUNT_OUT_MINIMUM (required and non-zero for a non-zero residual)
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
  const deployment = JSON.parse(
    await fs.readFile(outPath, "utf8"),
  ) as Deployment;
  if (
    deployment.privacyBackend !== "iexec-nox" ||
    deployment.migrationStage !== "complete" ||
    typeof deployment.deploymentId !== "string"
  ) {
    throw new Error(
      `deployments/${net}.json is not a complete coordinated Nox deployment.`,
    );
  }
  const engineAddress = deployment.contracts?.NoxageSettlementEngine;
  if (!engineAddress || !ethers.isAddress(engineAddress)) {
    throw new Error(`Missing NoxageSettlementEngine in deployments/${net}.json`);
  }

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const engine = await ethers.getContractAt(
    "NoxageSettlementEngine",
    engineAddress,
    signer,
  );
  const owner = await engine.owner();
  if (ethers.getAddress(owner) !== ethers.getAddress(signerAddress)) {
    throw new Error(
      `Connected signer ${signerAddress} is not settlement owner ${owner}`,
    );
  }

  const status = await engine.settlementStatus(epochId);
  if (Number(status) !== SettlementStatus.Prepared) {
    throw new Error(
      `Epoch #${epochId} settlement status is ${status} — expected Prepared (${SettlementStatus.Prepared}). Run prepare in the app first.`,
    );
  }

  const settlement = await engine.getSettlement(epochId);
  const residualHandle = settlement.residualHandle as `0x${string}`;
  const dirHandle = settlement.dirHandle as `0x${string}`;

  console.log(`Public-decrypting residual handles for epoch #${epochId}...`);
  const handleClient = await createEthersHandleClient(signer);
  const [residual, direction] = await Promise.all([
    handleClient.publicDecrypt(residualHandle),
    handleClient.publicDecrypt(dirHandle),
  ]);
  if (
    residual.solidityType !== "uint256" ||
    typeof residual.value !== "bigint" ||
    direction.solidityType !== "bool" ||
    typeof direction.value !== "boolean"
  ) {
    throw new Error("Nox returned unexpected public-decryption value types");
  }

  const priceNum = BigInt(process.env.CLEARING_PRICE_NUM ?? "2000");
  const priceDen = BigInt(process.env.CLEARING_PRICE_DEN ?? "1");
  if (
    priceNum <= 0n ||
    priceDen <= 0n ||
    priceNum > MAX_UINT64 ||
    priceDen > MAX_UINT64
  ) {
    throw new Error("CLEARING_PRICE_NUM and CLEARING_PRICE_DEN must be non-zero uint64 values");
  }

  const amountOutMinimumRaw = process.env.AMOUNT_OUT_MINIMUM?.trim();
  const amountOutMinimum = BigInt(amountOutMinimumRaw || "0");
  if (amountOutMinimum < 0n) {
    throw new Error("AMOUNT_OUT_MINIMUM cannot be negative");
  }
  if (residual.value > 0n && amountOutMinimum === 0n) {
    throw new Error(
      "Set AMOUNT_OUT_MINIMUM to a deliberate non-zero value before finalizing a non-zero residual",
    );
  }

  console.log(
    `Finalizing epoch #${epochId}: residual=${residual.value}, ` +
      `direction=${direction.value ? "buy-heavy" : "sell-heavy"}, ` +
      `price=${priceNum}/${priceDen}, amountOutMinimum=${amountOutMinimum}.`,
  );

  const tx = await engine.finalizeSettlement(
    epochId,
    priceNum,
    priceDen,
    amountOutMinimum,
    residual.decryptionProof,
    direction.decryptionProof,
  );
  const receipt = await tx.wait();
  console.log(`Settlement finalized. Tx: ${receipt?.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
