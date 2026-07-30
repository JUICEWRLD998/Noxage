import { expect } from "chai";
import { ethers } from "hardhat";

describe("NoxageConfidentialToken", () => {
  async function deployFixture() {
    const [owner, alice, auditor] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const underlying = await Mock.deploy("Mock USD Coin", "mUSDC", 6);
    const Token = await ethers.getContractFactory("NoxageConfidentialToken");
    const token = await Token.deploy(
      await underlying.getAddress(),
      "Confidential mUSDC",
      "cmUSDC",
      "https://noxage.xyz/tokens/musdc",
    );
    return { owner, alice, auditor, underlying, token };
  }

  it("uses the Nox ERC-7984 wrapper metadata and underlying", async () => {
    const { underlying, token } = await deployFixture();
    expect(await token.name()).to.equal("Confidential mUSDC");
    expect(await token.symbol()).to.equal("cmUSDC");
    expect(await token.decimals()).to.equal(6);
    expect(await token.underlying()).to.equal(await underlying.getAddress());
  });

  it("records an observer for future Nox balance handles", async () => {
    const { alice, auditor, token } = await deployFixture();
    const aliceToken = token.connect(alice) as typeof token;
    await expect(aliceToken.setObserver(alice.address, auditor.address))
      .to.emit(token, "ObserverSet")
      .withArgs(alice.address, auditor.address);
    expect(await token.observer(alice.address)).to.equal(auditor.address);
  });

  it("lets the account stop future observer grants", async () => {
    const { alice, auditor, token } = await deployFixture();
    const aliceToken = token.connect(alice) as typeof token;
    await aliceToken.setObserver(alice.address, auditor.address);
    await aliceToken.setObserver(alice.address, ethers.ZeroAddress);
    expect(await token.observer(alice.address)).to.equal(ethers.ZeroAddress);
  });

  it("rejects observer updates from another account", async () => {
    const { owner, alice, auditor, token } = await deployFixture();
    const ownerToken = token.connect(owner) as typeof token;
    await expect(
      ownerToken.setObserver(alice.address, auditor.address),
    )
      .to.be.revertedWithCustomError(token, "ObserverUnauthorizedAccount")
      .withArgs(alice.address, owner.address);
  });
});
