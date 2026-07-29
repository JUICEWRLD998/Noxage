import { ethers, network } from "hardhat";
import { promises as fs } from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const providerNetwork = await ethers.provider.getNetwork();

  if (providerNetwork.chainId !== 11155111n) {
    throw new Error(
      `Expected Ethereum Sepolia (11155111), got ${providerNetwork.chainId}`,
    );
  }

  const startingBalance = await ethers.provider.getBalance(deployerAddress);
  console.log(`Network: ${network.name} (${providerNetwork.chainId})`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Balance: ${ethers.formatEther(startingBalance)} ETH`);

  const PiggyBank = await ethers.getContractFactory(
    "ConfidentialPiggyBank",
    deployer,
  );
  const piggyBank = await PiggyBank.deploy();
  const deploymentTx = piggyBank.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("Deployment transaction was not created");
  }

  console.log(`Transaction: ${deploymentTx.hash}`);
  await piggyBank.waitForDeployment();

  const address = await piggyBank.getAddress();
  const owner = await piggyBank.owner();
  const balanceHandle = await piggyBank.balance();
  const receipt = await deploymentTx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Deployment transaction failed");
  }

  if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(`Unexpected owner ${owner}`);
  }

  if (balanceHandle === ethers.ZeroHash) {
    throw new Error("Encrypted balance handle was not initialized");
  }

  const result = {
    network: "ethereum-sepolia",
    chainId: Number(providerNetwork.chainId),
    contract: "ConfidentialPiggyBank",
    address,
    owner,
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    balanceHandle,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    __dirname,
    "../../../deployments/confidential-piggy-bank-sepolia.json",
  );
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Contract: ${address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Initial balance handle: ${balanceHandle}`);
  console.log(`Saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
