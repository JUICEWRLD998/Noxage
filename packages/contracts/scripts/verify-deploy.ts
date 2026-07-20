import { ethers } from "hardhat";
import addrs from "../../../deployments/sepolia.json";

async function main() {
  const c = (addrs as any).contracts;
  const targets = ["MockUSDC","NoxageConfidentialUSDC","MockWETH","NoxageConfidentialWETH"];
  for (const k of targets) {
    const a = c[k];
    const code = await ethers.provider.getCode(a);
    console.log(`${k.padEnd(24)} ${a}  code=${code === "0x" ? "MISSING" : (code.length-2)/2 + " bytes"}`);
  }
  const cusdc = await ethers.getContractAt("NoxageConfidentialToken", c.NoxageConfidentialUSDC);
  console.log("\ncUSDC.underlying():", await cusdc.underlying());
  console.log("cUSDC.name()/symbol():", await cusdc.name(), "/", await cusdc.symbol());
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
