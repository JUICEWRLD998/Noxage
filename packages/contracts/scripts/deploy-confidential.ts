import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Phase 2 deployment — confidential balance rail.
 *
 * Deploys, for each supported market token:
 *   1. A public ERC-20 faucet stand-in (MockERC20, ERC-1363 enabled).
 *   2. A NoxageConfidentialToken wrapper bound to that underlying.
 *
 * Addresses are written to `deployments/<network>.json` so the frontend and
 * later phases can consume them. On Sepolia these are real, verifiable txs
 * against the live Zama FHEVM coprocessor.
 */

type TokenSpec = {
  key: string; // deployments.json key for the underlying
  confidentialKey: string; // deployments.json key for the wrapper
  name: string;
  symbol: string;
  decimals: number;
};

const TOKENS: TokenSpec[] = [
  {
    key: "MockUSDC",
    confidentialKey: "NoxageConfidentialUSDC",
    name: "Mock USD Coin",
    symbol: "mUSDC",
    decimals: 6,
  },
  {
    key: "MockWETH",
    confidentialKey: "NoxageConfidentialWETH",
    name: "Mock Wrapped Ether",
    symbol: "mWETH",
    decimals: 18,
  },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  console.log(`\nDeploying Noxage confidential rail to: ${net}`);
  console.log(`Deployer: ${await deployer.getAddress()}\n`);

  const deployed: Record<string, string> = {};

  const Mock = await ethers.getContractFactory("MockERC20");
  const Token = await ethers.getContractFactory("NoxageConfidentialToken");

  for (const spec of TOKENS) {
    const underlying = await Mock.deploy(spec.name, spec.symbol, spec.decimals);
    await underlying.waitForDeployment();
    const underlyingAddr = await underlying.getAddress();
    deployed[spec.key] = underlyingAddr;
    console.log(`  ${spec.key} (${spec.symbol}): ${underlyingAddr}`);

    const confidential = await Token.deploy(
      underlyingAddr,
      `Confidential ${spec.symbol}`,
      `c${spec.symbol}`,
      `https://noxage.xyz/tokens/${spec.symbol.toLowerCase()}`,
    );
    await confidential.waitForDeployment();
    const confidentialAddr = await confidential.getAddress();
    deployed[spec.confidentialKey] = confidentialAddr;
    console.log(`  ${spec.confidentialKey}: ${confidentialAddr}\n`);
  }

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
