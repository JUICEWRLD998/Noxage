import { ethers } from "hardhat";

async function main() {
  const Hello = await ethers.getContractFactory("NoxageHello");
  const hello = await Hello.deploy();
  await hello.waitForDeployment();
  const address = await hello.getAddress();
  console.log("NoxageHello deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
