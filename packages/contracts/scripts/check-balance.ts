import { ethers, network } from "hardhat";

/** Prints the deployer address + Sepolia balance without echoing the key. */
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.log("No signer configured. Is DEPLOYER_PRIVATE_KEY set in .env?");
    return;
  }
  const [deployer] = signers;
  const addr = await deployer.getAddress();
  const net = await ethers.provider.getNetwork();
  const bal = await ethers.provider.getBalance(addr);

  console.log(`Network:   ${network.name} (chainId ${net.chainId})`);
  console.log(`Deployer:  ${addr}`);
  console.log(`Balance:   ${ethers.formatEther(bal)} ETH`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
