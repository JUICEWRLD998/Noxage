import { expect } from "chai";
import { ethers } from "hardhat";

describe("NoxageIntentBook + NoxageEpochManager", () => {
  const EPOCH_DURATION = 60;
  const PAIR = ethers.keccak256(ethers.toUtf8Bytes("mWETH/mUSDC"));

  it("wires the book and preserves the public epoch lifecycle", async () => {
    const [owner, other] = await ethers.getSigners();
    const Epochs = await ethers.getContractFactory("NoxageEpochManager");
    const epochs = await Epochs.deploy(owner.address, EPOCH_DURATION);
    const Book = await ethers.getContractFactory("NoxageIntentBook");
    const book = await Book.deploy(await epochs.getAddress(), PAIR);

    await epochs.setIntentBook(await book.getAddress());
    await book.setSettlementEngine(other.address);

    expect(await book.supportedPair()).to.equal(PAIR);
    expect(await book.settlementEngine()).to.equal(other.address);

    await epochs.openEpoch();
    expect(await epochs.activeEpochId()).to.equal(1n);
    await epochs.closeEpoch(1);
    expect(await epochs.activeEpochId()).to.equal(0n);
  });

  it("exposes one Nox input proof per encrypted intent field", async () => {
    const Book = await ethers.getContractFactory("NoxageIntentBook");
    const fragment = Book.interface.getFunction("submitIntent");
    expect(fragment).not.to.equal(null);
    expect(fragment!.inputs.map((input) => input.type)).to.deep.equal([
      "bytes32",
      "uint64",
      "bytes32",
      "bytes",
      "bytes32",
      "bytes",
      "bytes32",
      "bytes",
    ]);
  });

  it("keeps settlement wiring write-once and owner-controlled", async () => {
    const [owner, alice, engine] = await ethers.getSigners();
    const Epochs = await ethers.getContractFactory("NoxageEpochManager");
    const epochs = await Epochs.deploy(owner.address, EPOCH_DURATION);
    const Book = await ethers.getContractFactory("NoxageIntentBook");
    const book = await Book.deploy(await epochs.getAddress(), PAIR);
    const aliceBook = book.connect(alice) as typeof book;

    await expect(
      aliceBook.setSettlementEngine(engine.address),
    ).to.be.revertedWithCustomError(book, "NotOwner");

    await book.setSettlementEngine(engine.address);
    await expect(
      book.setSettlementEngine(alice.address),
    ).to.be.revertedWithCustomError(book, "SettlementEngineAlreadySet");
  });
});
