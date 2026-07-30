import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_NOX_COMPUTE = "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF";
const SUPPORTED_PAIR = ethers.keccak256(ethers.toUtf8Bytes("mWETH/mUSDC"));

type Deployment = {
  chainId?: number;
  network?: string;
  privacyBackend?: string;
  migrationStage?: string;
  deploymentId?: string;
  deployedBy?: string;
  deployBlock?: number;
  updatedAt?: string;
  contracts?: Record<string, string>;
};

function requireAddress(contracts: Record<string, string>, key: string): string {
  const value = contracts[key];
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`Missing or invalid ${key} in deployment metadata`);
  }
  return ethers.getAddress(value);
}

async function requireCode(label: string, address: string): Promise<void> {
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error(`${label} has no deployed bytecode at ${address}`);
  }
  console.log(`  ok  ${label}: ${address}`);
}

async function main() {
  const actualNetwork = await ethers.provider.getNetwork();
  if (actualNetwork.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Expected Ethereum Sepolia (${SEPOLIA_CHAIN_ID}), got chain ${actualNetwork.chainId}`,
    );
  }

  const deploymentPath = path.resolve(
    __dirname,
    `../../../deployments/${network.name}.json`,
  );
  const deployment = JSON.parse(
    await fs.readFile(deploymentPath, "utf8"),
  ) as Deployment;

  if (deployment.chainId !== Number(SEPOLIA_CHAIN_ID)) {
    throw new Error(`Deployment metadata chainId is ${deployment.chainId}, expected 11155111`);
  }
  if (
    deployment.privacyBackend !== "iexec-nox" ||
    deployment.migrationStage !== "complete" ||
    typeof deployment.deploymentId !== "string" ||
    !Number.isSafeInteger(deployment.deployBlock) ||
    Number(deployment.deployBlock) <= 0
  ) {
    throw new Error(
      "Deployment metadata is not a complete iExec Nox deployment with a deployBlock. " +
        "Run the three coordinated Sepolia deployment commands first.",
    );
  }

  const contracts = deployment.contracts ?? {};
  const addresses = {
    mockUsdc: requireAddress(contracts, "MockUSDC"),
    confidentialUsdc: requireAddress(contracts, "NoxageConfidentialUSDC"),
    mockWeth: requireAddress(contracts, "MockWETH"),
    confidentialWeth: requireAddress(contracts, "NoxageConfidentialWETH"),
    book: requireAddress(contracts, "NoxageIntentBook"),
    epochs: requireAddress(contracts, "NoxageEpochManager"),
    engine: requireAddress(contracts, "NoxageSettlementEngine"),
    ledger: requireAddress(contracts, "NoxageFillLedger"),
    router: requireAddress(contracts, "UniswapV3SwapRouter"),
  };

  console.log(`Noxage Sepolia preflight (${deployment.updatedAt ?? "unknown deploy time"})`);
  await requireCode("NoxCompute", SEPOLIA_NOX_COMPUTE);
  for (const [label, address] of Object.entries(addresses)) {
    await requireCode(label, address);
  }

  const epochs = await ethers.getContractAt("NoxageEpochManager", addresses.epochs);
  const book = await ethers.getContractAt("NoxageIntentBook", addresses.book);
  const ledger = await ethers.getContractAt("NoxageFillLedger", addresses.ledger);
  const engine = await ethers.getContractAt("NoxageSettlementEngine", addresses.engine);
  const confidentialUsdc = await ethers.getContractAt(
    "NoxageConfidentialToken",
    addresses.confidentialUsdc,
  );
  const confidentialWeth = await ethers.getContractAt(
    "NoxageConfidentialToken",
    addresses.confidentialWeth,
  );

  const checks: Array<[string, string, string]> = [
    ["epoch.intentBook", await epochs.intentBook(), addresses.book],
    ["epoch.settlementEngine", await epochs.settlementEngine(), addresses.engine],
    ["book.epochManager", await book.epochManager(), addresses.epochs],
    ["book.settlementEngine", await book.settlementEngine(), addresses.engine],
    ["engine.epochManager", await engine.epochManager(), addresses.epochs],
    ["engine.intentBook", await engine.intentBook(), addresses.book],
    ["engine.fillLedger", await engine.fillLedger(), addresses.ledger],
    ["engine.swapRouter", await engine.swapRouter(), addresses.router],
    ["engine.baseToken", await engine.baseToken(), addresses.mockWeth],
    ["engine.quoteToken", await engine.quoteToken(), addresses.mockUsdc],
    ["ledger.engine", await ledger.engine(), addresses.engine],
    ["confidentialUSDC.underlying", await confidentialUsdc.underlying(), addresses.mockUsdc],
    ["confidentialWETH.underlying", await confidentialWeth.underlying(), addresses.mockWeth],
  ];

  const ownerChecks: Array<[string, string]> = [
    ["epoch.owner", await epochs.owner()],
    ["engine.owner", await engine.owner()],
  ];
  if (deployment.deployedBy && ethers.isAddress(deployment.deployedBy)) {
    for (const [label, actual] of ownerChecks) {
      if (ethers.getAddress(actual) !== ethers.getAddress(deployment.deployedBy)) {
        throw new Error(`${label} is ${actual}, expected deployer ${deployment.deployedBy}`);
      }
      console.log(`  ok  ${label}`);
    }
  }

  for (const [label, actual, expected] of checks) {
    if (ethers.getAddress(actual) !== ethers.getAddress(expected)) {
      throw new Error(`${label} is ${actual}, expected ${expected}`);
    }
    console.log(`  ok  ${label}`);
  }

  if ((await book.supportedPair()) !== SUPPORTED_PAIR) {
    throw new Error("Intent book pair does not match keccak256('mWETH/mUSDC')");
  }
  if ((await engine.supportedPair()) !== SUPPORTED_PAIR) {
    throw new Error("Settlement engine pair does not match keccak256('mWETH/mUSDC')");
  }

  console.log(
    `Preflight passed for deployment ${deployment.deploymentId} from block ${deployment.deployBlock}: bytecode, wiring, owners, token underlyings, and pair agree.`,
  );
  console.log(
    "This does not prove gateway encryption, confidential execution, public decryption, router liquidity, or fill decryption.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
