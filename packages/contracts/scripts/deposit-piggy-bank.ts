import { ethers } from "hardhat";

async function main() {
  const address = process.env.PIGGY_BANK_ADDRESS;
  const inputHandle = process.env.INPUT_HANDLE;
  const inputProof = process.env.INPUT_PROOF;

  if (!address || !inputHandle || !inputProof) {
    throw new Error(
      "PIGGY_BANK_ADDRESS, INPUT_HANDLE, and INPUT_PROOF are required",
    );
  }

  const [depositor] = await ethers.getSigners();
  const piggyBank = await ethers.getContractAt(
    "ConfidentialPiggyBank",
    address,
    depositor,
  );

  const transaction = await piggyBank.deposit(inputHandle, inputProof);
  console.log(`Transaction: ${transaction.hash}`);

  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Deposit transaction failed");
  }

  const balanceHandle = await piggyBank.balance();
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Balance handle: ${balanceHandle}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
