import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signer } from "ethers";
import type { NoxageEpochManager, NoxageIntentBook } from "../typechain-types";

/**
 * Phase 3 — intent book + epoch manager.
 *
 * Users seal encrypted trade intents (side / amount / limit) into the currently
 * open epoch. These tests run against the FHEVM mock coprocessor, exercising the
 * same encrypt → fromExternal → ACL paths that run on Sepolia. No plaintext
 * trade data is ever stored on-chain or emitted in events.
 */
describe("NoxageIntentBook + NoxageEpochManager", () => {
  const EPOCH_DURATION = 60; // seconds
  const PAIR = ethers.keccak256(ethers.toUtf8Bytes("mWETH/mUSDC"));

  // EpochStatus enum mirror.
  const Status = { None: 0, Open: 1, Closed: 2, Settled: 3, Failed: 4 } as const;
  // IntentStatus enum mirror.
  const IntentStatus = { None: 0, Active: 1, Cancelled: 2 } as const;

  let owner: Signer;
  let alice: Signer;
  let bob: Signer;

  let epochs: NoxageEpochManager;
  let book: NoxageIntentBook;
  let bookAddr: string;

  beforeEach(async () => {
    if (!fhevm.isMock) {
      throw new Error("These tests require the FHEVM mock (hardhat network).");
    }
    [owner, alice, bob] = await ethers.getSigners();

    const Epochs = await ethers.getContractFactory("NoxageEpochManager");
    epochs = await Epochs.deploy(await owner.getAddress(), EPOCH_DURATION);
    await epochs.waitForDeployment();

    const Book = await ethers.getContractFactory("NoxageIntentBook");
    book = await Book.deploy(await epochs.getAddress());
    await book.waitForDeployment();
    bookAddr = await book.getAddress();

    await (await epochs.setIntentBook(bookAddr)).wait();
  });

  // Helper: build a deadline safely in the future.
  async function futureDeadline(extra = 3600): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp + extra;
  }

  // Helper: encrypt (side, amount, limit) bound to (book, submitter) and submit.
  async function submit(
    submitter: Signer,
    side: number,
    amount: bigint,
    limit: bigint,
  ) {
    const enc = await fhevm
      .createEncryptedInput(bookAddr, await submitter.getAddress())
      .add8(BigInt(side))
      .add64(amount)
      .add64(limit)
      .encrypt();

    return book
      .connect(submitter)
      .submitIntent(
        PAIR,
        await futureDeadline(),
        enc.handles[0],
        enc.handles[1],
        enc.handles[2],
        enc.inputProof,
      );
  }

  describe("epoch lifecycle", () => {
    it("opens, accepts intents, and closes", async () => {
      await (await epochs.openEpoch()).wait();
      expect(await epochs.activeEpochId()).to.equal(1n);
      expect(await epochs.statusOf(1)).to.equal(Status.Open);

      await (await submit(alice, 1, 5n, 0n)).wait();

      const epoch = await epochs.getEpoch(1);
      expect(epoch.intentCount).to.equal(1);

      await (await epochs.closeEpoch(1)).wait();
      expect(await epochs.statusOf(1)).to.equal(Status.Closed);
      expect(await epochs.activeEpochId()).to.equal(0n);
    });

    it("refuses a second open epoch while one is active", async () => {
      await (await epochs.openEpoch()).wait();
      await expect(epochs.openEpoch())
        .to.be.revertedWithCustomError(epochs, "EpochAlreadyOpen")
        .withArgs(1);
    });

    it("only the owner can open an epoch", async () => {
      await expect(epochs.connect(alice).openEpoch()).to.be.revertedWithCustomError(
        epochs,
        "OwnableUnauthorizedAccount",
      );
    });

    it("rejects settle/fail from a non-closed epoch", async () => {
      await (await epochs.openEpoch()).wait();
      const ref = ethers.id("tx");
      await expect(epochs.markSettled(1, ref)).to.be.revertedWithCustomError(
        epochs,
        "EpochNotClosed",
      );
      await expect(epochs.markFailed(1, ref)).to.be.revertedWithCustomError(
        epochs,
        "EpochNotClosed",
      );
    });

    it("settles a closed epoch and records the settlement ref", async () => {
      await (await epochs.openEpoch()).wait();
      await (await epochs.closeEpoch(1)).wait();
      const ref = ethers.id("uniswap-residual-tx");
      await expect(epochs.markSettled(1, ref))
        .to.emit(epochs, "EpochSettled")
        .withArgs(1, ref);
      expect(await epochs.statusOf(1)).to.equal(Status.Settled);
    });

    it("lets anyone close after the duration elapses", async () => {
      await (await epochs.openEpoch()).wait();
      // Not yet expired: a non-owner cannot close.
      await expect(epochs.connect(alice).closeEpoch(1)).to.be.revertedWithCustomError(
        epochs,
        "EpochNotOpen",
      );
      // Advance past the epoch duration.
      await ethers.provider.send("evm_increaseTime", [EPOCH_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);
      await (await epochs.connect(alice).closeEpoch(1)).wait();
      expect(await epochs.statusOf(1)).to.equal(Status.Closed);
    });
  });

  describe("intent submission", () => {
    beforeEach(async () => {
      await (await epochs.openEpoch()).wait();
    });

    it("stores multiple users' intents as ciphertext handles, decryptable by owner", async () => {
      await (await submit(alice, 1, 42n, 100n)).wait();
      await (await submit(bob, 0, 7n, 0n)).wait();

      expect(await book.intentCount()).to.equal(2n);
      const ids = await book.epochIntentIds(1);
      expect(ids.map((x) => x.toString())).to.deep.equal(["1", "2"]);

      // Alice can decrypt her own encrypted amount via ACL.
      const [side, amount, limit] = await book.intentHandles(1);
      expect(await fhevm.userDecryptEuint(FhevmType.euint64, amount, bookAddr, alice)).to.equal(42n);
      expect(await fhevm.userDecryptEuint(FhevmType.euint8, side, bookAddr, alice)).to.equal(1n);
      expect(await fhevm.userDecryptEuint(FhevmType.euint64, limit, bookAddr, alice)).to.equal(100n);
    });

    it("emits IntentSubmitted with no plaintext amount", async () => {
      const deadline = await futureDeadline();
      const enc = await fhevm
        .createEncryptedInput(bookAddr, await alice.getAddress())
        .add8(1n)
        .add64(99n)
        .add64(0n)
        .encrypt();

      await expect(
        book
          .connect(alice)
          .submitIntent(PAIR, deadline, enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof),
      )
        .to.emit(book, "IntentSubmitted")
        .withArgs(1, 1, await alice.getAddress(), PAIR, deadline);
    });

    it("reverts when no epoch is open", async () => {
      await (await epochs.closeEpoch(1)).wait();
      await expect(submit(alice, 1, 5n, 0n)).to.be.revertedWithCustomError(
        book,
        "NoOpenEpoch",
      );
    });

    it("reverts on a past deadline", async () => {
      const enc = await fhevm
        .createEncryptedInput(bookAddr, await alice.getAddress())
        .add8(1n)
        .add64(5n)
        .add64(0n)
        .encrypt();
      const block = await ethers.provider.getBlock("latest");
      await expect(
        book
          .connect(alice)
          .submitIntent(PAIR, block!.timestamp, enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof),
      ).to.be.revertedWithCustomError(book, "DeadlineInPast");
    });
  });

  describe("intent cancellation", () => {
    beforeEach(async () => {
      await (await epochs.openEpoch()).wait();
      await (await submit(alice, 1, 42n, 0n)).wait();
    });

    it("lets the owner cancel while the epoch is open", async () => {
      await expect(book.connect(alice).cancelIntent(1))
        .to.emit(book, "IntentCancelled")
        .withArgs(1, 1, await alice.getAddress());
      const intent = await book.getIntent(1);
      expect(intent.status).to.equal(IntentStatus.Cancelled);
    });

    it("rejects cancellation by a non-owner", async () => {
      await expect(book.connect(bob).cancelIntent(1)).to.be.revertedWithCustomError(
        book,
        "NotIntentOwner",
      );
    });

    it("rejects double cancellation", async () => {
      await (await book.connect(alice).cancelIntent(1)).wait();
      await expect(book.connect(alice).cancelIntent(1)).to.be.revertedWithCustomError(
        book,
        "IntentNotActive",
      );
    });

    it("rejects cancellation once the epoch is closed", async () => {
      await (await epochs.closeEpoch(1)).wait();
      await expect(book.connect(alice).cancelIntent(1)).to.be.revertedWithCustomError(
        book,
        "EpochNotOpenForCancel",
      );
    });
  });
});
