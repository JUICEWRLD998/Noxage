import { expect } from "chai";
import { ethers } from "hardhat";

describe("NoxageSettlementEngine", () => {
  const PAIR = ethers.keccak256(ethers.toUtf8Bytes("mWETH/mUSDC"));

  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const base = await Mock.deploy("Mock WETH", "mWETH", 18);
    const quote = await Mock.deploy("Mock USDC", "mUSDC", 6);
    const Router = await ethers.getContractFactory("MockSwapRouter");
    const router = await Router.deploy();
    const Epochs = await ethers.getContractFactory("NoxageEpochManager");
    const epochs = await Epochs.deploy(owner.address, 60);
    const Book = await ethers.getContractFactory("NoxageIntentBook");
    const book = await Book.deploy(await epochs.getAddress(), PAIR);
    const Ledger = await ethers.getContractFactory("NoxageFillLedger");
    const ledger = await Ledger.deploy();
    const Engine = await ethers.getContractFactory("NoxageSettlementEngine");
    const engine = await Engine.deploy(
      owner.address,
      await epochs.getAddress(),
      await book.getAddress(),
      await ledger.getAddress(),
      await router.getAddress(),
      await base.getAddress(),
      await quote.getAddress(),
      PAIR,
      3000,
    );

    return { owner, other, base, quote, router, epochs, book, ledger, engine };
  }

  it("exposes the Nox public-proof finalization ABI", async () => {
    const Engine = await ethers.getContractFactory("NoxageSettlementEngine");
    const fragment = Engine.interface.getFunction("finalizeSettlement");
    expect(fragment).not.to.equal(null);
    expect(fragment!.inputs.map((input) => input.type)).to.deep.equal([
      "uint256",
      "uint64",
      "uint64",
      "uint256",
      "bytes",
      "bytes",
    ]);
  });

  it("rejects preparation until the epoch is closed", async () => {
    const { engine } = await deployFixture();
    await expect(engine.prepareSettlement(1))
      .to.be.revertedWithCustomError(engine, "EpochNotClosed")
      .withArgs(1);
  });

  it("keeps owner operations protected", async () => {
    const { engine, other } = await deployFixture();
    const otherEngine = engine.connect(other) as typeof engine;
    await expect(
      otherEngine.setPoolFee(500),
    ).to.be.revertedWithCustomError(engine, "OwnableUnauthorizedAccount");
    await engine.setPoolFee(500);
    expect(await engine.poolFee()).to.equal(500);
  });

  it("keeps fill writes restricted to the wired engine", async () => {
    const { ledger, other } = await deployFixture();
    await expect(
      ledger.creditFill(
        1,
        1,
        other.address,
        ethers.ZeroHash,
        ethers.ZeroHash,
        ethers.ZeroHash,
        ethers.ZeroHash,
      ),
    ).to.be.revertedWithCustomError(ledger, "NotEngine");
  });
});
