import { ethers } from "hardhat";

const ADDRESS = "0xd4fD45b4E76F7D4c14428F3e57c9dA729d1D8C8C";

async function main() {
  const code = await ethers.provider.getCode(ADDRESS);
  if (code === "0x") {
    throw new Error(`No contract bytecode found at ${ADDRESS}`);
  }

  const piggyBank = await ethers.getContractAt(
    "ConfidentialPiggyBank",
    ADDRESS,
  );
  const [owner, balanceHandle] = await Promise.all([
    piggyBank.owner(),
    piggyBank.balance(),
  ]);

  console.log(
    JSON.stringify(
      {
        address: ADDRESS,
        bytecodeBytes: (code.length - 2) / 2,
        owner,
        balanceHandle,
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
