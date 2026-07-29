import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const providerNetwork = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployerAddress);

  const PiggyBank = await ethers.getContractFactory(
    "ConfidentialPiggyBank",
    deployer,
  );
  const deployment = await PiggyBank.getDeployTransaction();
  const gasEstimate = await ethers.provider.estimateGas({
    ...deployment,
    from: deployerAddress,
  });
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
  const estimatedMaxCost = gasPrice === null ? null : gasEstimate * gasPrice;

  console.log(
    JSON.stringify(
      {
        chainId: providerNetwork.chainId.toString(),
        deployer: deployerAddress,
        balanceEth: ethers.formatEther(balance),
        gasEstimate: gasEstimate.toString(),
        maxFeeGwei:
          gasPrice === null ? null : ethers.formatUnits(gasPrice, "gwei"),
        estimatedMaxCostEth:
          estimatedMaxCost === null
            ? null
            : ethers.formatEther(estimatedMaxCost),
        funded:
          estimatedMaxCost === null
            ? balance > 0n
            : balance > estimatedMaxCost,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
