import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signer } from "ethers";
import type {
  MockERC20,
  MockSwapRouter,
  NoxageEpochManager,
  NoxageFillLedger,
  NoxageIntentBook,
  NoxageSettlementEngine,
} from "../typechain-types";

/**
 * Phase 4 — confidential netting + residual Uniswap settlement.
 *
 * Flow under test (same paths as Sepolia, against the FHEVM mock):
 *   open epoch → encrypt+submit intents → close → prepareSettlement
 *   (homomorphic net + public residual reveal) → publicDecrypt residual
 *   → finalizeSettlement (KMS check + residual swap + encrypted fills).
 *
 * Netting rule (MVP): full-size fills at a public clearing price; opposing
 * flow cancels inside the batch so only |buy − sell| hits the public router.
 * Documented in docs/THREAT-MODEL.md and the engine NatSpec.
 */
describe("NoxageSettlementEngine", () => {
  const EPOCH_DURATION = 60;
  const DECIMALS = 6;
  const ONE = 10n ** BigInt(DECIMALS);
  const PAIR = ethers.keccak256(ethers.toUtf8Bytes("mWETH/mUSDC"));
  // Clearing price: 2000 quote per 1 base (equal decimals → num=2000, den=1).
  const PRICE_NUM = 2000n;
  const PRICE_DEN = 1n;
  const POOL_FEE = 3000;

  const EpochStatus = { None: 0, Open: 1, Closed: 2, Settled: 3, Failed: 4 } as const;
  const SettlementStatus = { None: 0, Prepared: 1, Settled: 2, Failed: 3 } as const;
  // side: 1 = buy base, 0 = sell base
  const Side = { Sell: 0, Buy: 1 } as const;

  let owner: Signer;
  let alice: Signer;
  let bob: Signer;

  let base: MockERC20; // mWETH
  let quote: MockERC20; // mUSDC
  let router: MockSwapRouter;
  let epochs: NoxageEpochManager;
  let book: NoxageIntentBook;
  let ledger: NoxageFillLedger;
  let engine: NoxageSettlementEngine;

  let bookAddr: string;
  let engineAddr: string;
  let ledgerAddr: string;

  beforeEach(async () => {
    if (!fhevm.isMock) {
      throw new Error("These tests require the FHEVM mock (hardhat network).");
    }
    [owner, alice, bob] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    base = await Mock.deploy("Mock WETH", "mWETH", DECIMALS);
    await base.waitForDeployment();
    quote = await Mock.deploy("Mock USDC", "mUSDC", DECIMALS);
    await quote.waitForDeployment();

    const Router = await ethers.getContractFactory("MockSwapRouter");
    router = await Router.deploy();
    await router.waitForDeployment();
    // Directed prices for residual swaps (quote per base == 2000).
    await (
      await router.setPrice(
        await base.getAddress(),
        await quote.getAddress(),
        PRICE_NUM,
        PRICE_DEN,
      )
    ).wait();
    await (
      await router.setPrice(
        await quote.getAddress(),
        await base.getAddress(),
        PRICE_DEN,
        PRICE_NUM,
      )
    ).wait();

    const Epochs = await ethers.getContractFactory("NoxageEpochManager");
    epochs = await Epochs.deploy(await owner.getAddress(), EPOCH_DURATION);
    await epochs.waitForDeployment();

    const Book = await ethers.getContractFactory("NoxageIntentBook");
    book = await Book.deploy(await epochs.getAddress());
    await book.waitForDeployment();
    bookAddr = await book.getAddress();
    await (await epochs.setIntentBook(bookAddr)).wait();

    const Ledger = await ethers.getContractFactory("NoxageFillLedger");
    ledger = await Ledger.deploy();
    await ledger.waitForDeployment();
    ledgerAddr = await ledger.getAddress();

    const Engine = await ethers.getContractFactory("NoxageSettlementEngine");
    engine = await Engine.deploy(
      await owner.getAddress(),
      await epochs.getAddress(),
      bookAddr,
      ledgerAddr,
      await router.getAddress(),
      await base.getAddress(),
      await quote.getAddress(),
      POOL_FEE,
    );
    await engine.waitForDeployment();
    engineAddr = await engine.getAddress();

    // Wire the settlement triangle: ledger → engine, book → engine, epochs → engine.
    await (await ledger.setEngine(engineAddr)).wait();
    await (await book.setSettlementEngine(engineAddr)).wait();
    await (await epochs.setSettlementEngine(engineAddr)).wait();

    // Engine inventory (batch-executor working capital) + router output liquidity.
    const inv = 1_000_000n * ONE;
    await (await base.mint(engineAddr, inv)).wait();
    await (await quote.mint(engineAddr, inv)).wait();
    await (await base.mint(await router.getAddress(), inv)).wait();
    await (await quote.mint(await router.getAddress(), inv)).wait();
  });

  async function futureDeadline(extra = 3600): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp + extra;
  }

  async function submit(submitter: Signer, side: number, amount: bigint, limit = 0n) {
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

  /** Open → submit list of intents → close. Returns epochId. */
  async function sealEpoch(
    intents: Array<{ who: Signer; side: number; amount: bigint }>,
  ): Promise<bigint> {
    await (await epochs.openEpoch()).wait();
    const epochId = await epochs.currentEpochId();
    for (const it of intents) {
      await (await submit(it.who, it.side, it.amount)).wait();
    }
    await (await epochs.closeEpoch(epochId)).wait();
    return epochId;
  }

  /**
   * Prepare → publicDecrypt residual+dir → finalize.
   * Returns residualBase (in base units) and buyHeavy.
   */
  async function settleEpoch(
    epochId: bigint,
    opts: { amountOutMinimum?: bigint; expectFail?: boolean } = {},
  ) {
    const prepTx = await engine.prepareSettlement(epochId);
    const prepReceipt = await prepTx.wait();

    const prepared = prepReceipt!.logs
      .map((l) => {
        try {
          return engine.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "SettlementPrepared");
    expect(prepared, "SettlementPrepared").to.not.equal(undefined);

    const residualHandle: string = prepared!.args.residualHandle;
    const dirHandle: string = prepared!.args.dirHandle;

    const { clearValues, decryptionProof } = await fhevm.publicDecrypt([
      residualHandle,
      dirHandle,
    ]);
    const residualBase = BigInt(clearValues[residualHandle] as bigint);
    const dir = BigInt(clearValues[dirHandle] as bigint);
    const buyHeavy = dir === 1n;

    const finTx = engine.finalizeSettlement(
      epochId,
      residualBase,
      buyHeavy,
      PRICE_NUM,
      PRICE_DEN,
      opts.amountOutMinimum ?? 0n,
      decryptionProof,
    );

    if (opts.expectFail) {
      await (await finTx).wait();
      return { residualBase, buyHeavy, failed: true as const };
    }

    await expect(finTx).to.emit(engine, "SettlementFinalized");
    return { residualBase, buyHeavy, failed: false as const };
  }

  async function decryptFillLegs(intentId: number, ownerSigner: Signer) {
    const [recvBase, recvQuote, payBase, payQuote] = await ledger.fillHandles(intentId);
    return {
      recvBase: await fhevm.userDecryptEuint(
        FhevmType.euint64,
        recvBase,
        ledgerAddr,
        ownerSigner,
      ),
      recvQuote: await fhevm.userDecryptEuint(
        FhevmType.euint64,
        recvQuote,
        ledgerAddr,
        ownerSigner,
      ),
      payBase: await fhevm.userDecryptEuint(
        FhevmType.euint64,
        payBase,
        ledgerAddr,
        ownerSigner,
      ),
      payQuote: await fhevm.userDecryptEuint(
        FhevmType.euint64,
        payQuote,
        ledgerAddr,
        ownerSigner,
      ),
    };
  }

  describe("prepareSettlement", () => {
    it("reverts if the epoch is not closed", async () => {
      await (await epochs.openEpoch()).wait();
      await expect(engine.prepareSettlement(1)).to.be.revertedWithCustomError(
        engine,
        "EpochNotClosed",
      );
    });

    it("reverts when there are no active intents", async () => {
      await (await epochs.openEpoch()).wait();
      await (await submit(alice, Side.Buy, 5n * ONE)).wait();
      await (await book.connect(alice).cancelIntent(1)).wait();
      await (await epochs.closeEpoch(1)).wait();
      await expect(engine.prepareSettlement(1)).to.be.revertedWithCustomError(
        engine,
        "NoActiveIntents",
      );
    });

    it("reveals only residual + direction handles (no plaintext amounts)", async () => {
      const epochId = await sealEpoch([
        { who: alice, side: Side.Buy, amount: 10n * ONE },
        { who: bob, side: Side.Sell, amount: 4n * ONE },
      ]);

      await expect(engine.prepareSettlement(epochId))
        .to.emit(engine, "SettlementPrepared")
        .withArgs(
          epochId,
          (h: string) => h !== ethers.ZeroHash,
          (h: string) => h !== ethers.ZeroHash,
        );

      expect(await engine.settlementStatus(epochId)).to.equal(SettlementStatus.Prepared);
      await expect(engine.prepareSettlement(epochId)).to.be.revertedWithCustomError(
        engine,
        "AlreadyPrepared",
      );
    });
  });

  describe("integration — multi-intent partial net", () => {
    it("nets opposing flow; residual-only swap; both users get decryptable fills", async () => {
      // Alice buys 10 base, Bob sells 4 base → residual = 6 base buy-heavy.
      const aliceAmt = 10n * ONE;
      const bobAmt = 4n * ONE;
      const expectedResidual = aliceAmt - bobAmt; // 6 base

      const epochId = await sealEpoch([
        { who: alice, side: Side.Buy, amount: aliceAmt },
        { who: bob, side: Side.Sell, amount: bobAmt },
      ]);

      const baseBefore = await base.balanceOf(engineAddr);
      const quoteBefore = await quote.balanceOf(engineAddr);

      const { residualBase, buyHeavy } = await settleEpoch(epochId);

      expect(residualBase).to.equal(expectedResidual);
      expect(buyHeavy).to.equal(true);
      expect(await epochs.statusOf(epochId)).to.equal(EpochStatus.Settled);
      expect(await engine.settlementStatus(epochId)).to.equal(SettlementStatus.Settled);

      // Residual buy-heavy: engine spent residual * price quote, received residual base.
      const quoteSpent = (expectedResidual * PRICE_NUM) / PRICE_DEN;
      expect(await quote.balanceOf(engineAddr)).to.equal(quoteBefore - quoteSpent);
      expect(await base.balanceOf(engineAddr)).to.equal(baseBefore + expectedResidual);

      // Fills decryptable by owners via ACL — full size at clearing price.
      const aliceFill = await decryptFillLegs(1, alice);
      expect(aliceFill.recvBase).to.equal(aliceAmt);
      expect(aliceFill.payQuote).to.equal((aliceAmt * PRICE_NUM) / PRICE_DEN);
      expect(aliceFill.recvQuote).to.equal(0n);
      expect(aliceFill.payBase).to.equal(0n);

      const bobFill = await decryptFillLegs(2, bob);
      expect(bobFill.payBase).to.equal(bobAmt);
      expect(bobFill.recvQuote).to.equal((bobAmt * PRICE_NUM) / PRICE_DEN);
      expect(bobFill.recvBase).to.equal(0n);
      expect(bobFill.payQuote).to.equal(0n);

      expect(await ledger.isFilled(1)).to.equal(true);
      expect(await ledger.isFilled(2)).to.equal(true);
    });

    it("perfect net (buy == sell) settles with zero residual swap", async () => {
      const amt = 5n * ONE;
      const epochId = await sealEpoch([
        { who: alice, side: Side.Buy, amount: amt },
        { who: bob, side: Side.Sell, amount: amt },
      ]);

      const baseBefore = await base.balanceOf(engineAddr);
      const quoteBefore = await quote.balanceOf(engineAddr);

      const { residualBase, buyHeavy } = await settleEpoch(epochId);
      expect(residualBase).to.equal(0n);
      // dir is 0 when not buy-heavy (equal → not gt).
      expect(buyHeavy).to.equal(false);

      // No residual swap — inventory unchanged.
      expect(await base.balanceOf(engineAddr)).to.equal(baseBefore);
      expect(await quote.balanceOf(engineAddr)).to.equal(quoteBefore);
      expect(await epochs.statusOf(epochId)).to.equal(EpochStatus.Settled);

      const aliceFill = await decryptFillLegs(1, alice);
      expect(aliceFill.recvBase).to.equal(amt);
    });
  });

  describe("integration — solo intent full residual", () => {
    it("solo buy routes the full size as a public residual swap", async () => {
      const amt = 3n * ONE;
      const epochId = await sealEpoch([{ who: alice, side: Side.Buy, amount: amt }]);

      const quoteBefore = await quote.balanceOf(engineAddr);
      const { residualBase, buyHeavy } = await settleEpoch(epochId);

      expect(residualBase).to.equal(amt);
      expect(buyHeavy).to.equal(true);
      expect(await quote.balanceOf(engineAddr)).to.equal(
        quoteBefore - (amt * PRICE_NUM) / PRICE_DEN,
      );

      const fill = await decryptFillLegs(1, alice);
      expect(fill.recvBase).to.equal(amt);
      expect(fill.payQuote).to.equal((amt * PRICE_NUM) / PRICE_DEN);
      expect(await epochs.statusOf(epochId)).to.equal(EpochStatus.Settled);
    });

    it("solo sell routes the full size as a public residual swap", async () => {
      const amt = 2n * ONE;
      const epochId = await sealEpoch([{ who: bob, side: Side.Sell, amount: amt }]);

      const baseBefore = await base.balanceOf(engineAddr);
      const { residualBase, buyHeavy } = await settleEpoch(epochId);

      expect(residualBase).to.equal(amt);
      expect(buyHeavy).to.equal(false);
      // Sell-heavy residual: engine sends base, receives quote.
      expect(await base.balanceOf(engineAddr)).to.equal(baseBefore - amt);

      const fill = await decryptFillLegs(1, bob);
      expect(fill.payBase).to.equal(amt);
      expect(fill.recvQuote).to.equal((amt * PRICE_NUM) / PRICE_DEN);
    });
  });

  describe("failure path", () => {
    it("marks epoch Failed and credits no fills when residual swap reverts", async () => {
      const amt = 1n * ONE;
      const epochId = await sealEpoch([{ who: alice, side: Side.Buy, amount: amt }]);

      const prepTx = await engine.prepareSettlement(epochId);
      const prepReceipt = await prepTx.wait();
      const prepared = prepReceipt!.logs
        .map((l) => {
          try {
            return engine.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "SettlementPrepared")!;

      const residualHandle: string = prepared.args.residualHandle;
      const dirHandle: string = prepared.args.dirHandle;
      const { clearValues, decryptionProof } = await fhevm.publicDecrypt([
        residualHandle,
        dirHandle,
      ]);
      const residualBase = BigInt(clearValues[residualHandle] as bigint);
      const buyHeavy = BigInt(clearValues[dirHandle] as bigint) === 1n;

      // Impossible min-out forces the mock router to revert → catch → Failed.
      const hugeMin = 10n ** 30n;
      await expect(
        engine.finalizeSettlement(
          epochId,
          residualBase,
          buyHeavy,
          PRICE_NUM,
          PRICE_DEN,
          hugeMin,
          decryptionProof,
        ),
      )
        .to.emit(engine, "SettlementFailedEvent")
        .and.to.emit(epochs, "EpochFailed");

      expect(await epochs.statusOf(epochId)).to.equal(EpochStatus.Failed);
      expect(await engine.settlementStatus(epochId)).to.equal(SettlementStatus.Failed);
      expect(await ledger.isFilled(1)).to.equal(false);
    });
  });

  describe("access control", () => {
    it("only owner can finalize settlement", async () => {
      const epochId = await sealEpoch([{ who: alice, side: Side.Buy, amount: ONE }]);
      await (await engine.prepareSettlement(epochId)).wait();
      const s = await engine.getSettlement(epochId);
      const residualHandle = s.residualHandle;
      const dirHandle = s.dirHandle;
      const { clearValues, decryptionProof } = await fhevm.publicDecrypt([
        residualHandle,
        dirHandle,
      ]);
      await expect(
        engine
          .connect(alice)
          .finalizeSettlement(
            epochId,
            BigInt(clearValues[residualHandle] as bigint),
            BigInt(clearValues[dirHandle] as bigint) === 1n,
            PRICE_NUM,
            PRICE_DEN,
            0n,
            decryptionProof,
          ),
      ).to.be.revertedWithCustomError(engine, "OwnableUnauthorizedAccount");
    });

    it("only the engine can credit fills", async () => {
      await expect(
        ledger.creditFill(
          1,
          1,
          await alice.getAddress(),
          ethers.ZeroHash,
          ethers.ZeroHash,
          ethers.ZeroHash,
          ethers.ZeroHash,
        ),
      ).to.be.revertedWithCustomError(ledger, "NotEngine");
    });
  });
});
