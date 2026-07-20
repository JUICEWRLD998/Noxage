import { expect } from "chai";
import { ethers } from "hardhat";

describe("NoxageHello", () => {
  it("deploys with product identity", async () => {
    const Hello = await ethers.getContractFactory("NoxageHello");
    const hello = await Hello.deploy();
    await hello.waitForDeployment();

    expect(await hello.NAME()).to.equal("Noxage");
    expect(await hello.TAGLINE()).to.equal(
      "Public liquidity. Private strategy."
    );
    expect(await hello.version()).to.equal("0.0.0-phase0");
  });
});
