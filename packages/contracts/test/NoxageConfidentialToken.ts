import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signer } from "ethers";
import type { MockERC20, NoxageConfidentialToken } from "../typechain-types";

/**
 * Phase 2 — confidential balances (shield / unshield + ACL).
 *
 * These tests run against the FHEVM mock coprocessor bundled with
 * `@fhevm/hardhat-plugin`. The mock reproduces the real Sepolia encryption,
 * ACL, and KMS-signed decryption flow in-process, so the same code paths that
 * run on Sepolia are exercised here — no privacy is faked.
 */
describe("NoxageConfidentialToken", () => {
  const DECIMALS = 6; // USDC-style; also the wrapper's max decimals
  const ONE = 10n ** BigInt(DECIMALS);

  let deployer: Signer;
  let alice: Signer;
  let bob: Signer;
  let auditor: Signer;

  let underlying: MockERC20;
  let token: NoxageConfidentialToken;
  let tokenAddr: string;

  beforeEach(async () => {
    // The mock coprocessor is only available on the in-process hardhat network.
    if (!fhevm.isMock) {
      throw new Error("These tests require the FHEVM mock (hardhat network).");
    }

    [deployer, alice, bob, auditor] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    underlying = await Mock.deploy("Mock USD Coin", "mUSDC", DECIMALS);
    await underlying.waitForDeployment();

    const Token = await ethers.getContractFactory("NoxageConfidentialToken");
    token = await Token.deploy(
      await underlying.getAddress(),
      "Confidential mUSDC",
      "cmUSDC",
      "https://noxage.xyz/tokens/cmusdc",
    );
    await token.waitForDeployment();
    tokenAddr = await token.getAddress();

    // Fund alice with public tokens to shield.
    await (await underlying.mint(await alice.getAddress(), 1_000n * ONE)).wait();
  });

  // Helper: decrypt an account's confidential balance handle as that account.
  async function balanceOf(who: Signer): Promise<bigint> {
    const handle = await token.confidentialBalanceOf(await who.getAddress());
    if (handle === ethers.ZeroHash) return 0n; // uninitialized == 0
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddr, who);
  }

  describe("shield (wrap)", () => {
    it("wraps public ERC-20 into a confidential balance", async () => {
      const amount = 100n * ONE;
      const aliceAddr = await alice.getAddress();

      await (await underlying.connect(alice).approve(tokenAddr, amount)).wait();
      await (await token.connect(alice).wrap(aliceAddr, amount)).wait();

      // Public tokens moved into the wrapper.
      expect(await underlying.balanceOf(tokenAddr)).to.equal(amount);
      expect(await underlying.balanceOf(aliceAddr)).to.equal(900n * ONE);

      // Confidential balance credited (wrapper scales by rate; rate == 1 here).
      expect(await balanceOf(alice)).to.equal(100n);
    });

    it("stores the balance as a ciphertext handle, not plaintext", async () => {
      const amount = 100n * ONE;
      const aliceAddr = await alice.getAddress();
      await (await underlying.connect(alice).approve(tokenAddr, amount)).wait();
      await (await token.connect(alice).wrap(aliceAddr, amount)).wait();

      const handle = await token.confidentialBalanceOf(aliceAddr);
      // A handle is a 32-byte ciphertext reference, never the cleartext value.
      expect(handle).to.not.equal(ethers.ZeroHash);
      expect(BigInt(handle)).to.not.equal(100n);
    });
  });

  describe("confidential transfer", () => {
    it("moves an encrypted amount between accounts without revealing it", async () => {
      const aliceAddr = await alice.getAddress();
      const bobAddr = await bob.getAddress();

      await (await underlying.connect(alice).approve(tokenAddr, 100n * ONE)).wait();
      await (await token.connect(alice).wrap(aliceAddr, 100n * ONE)).wait();

      // Encrypt the transfer amount client-side, bound to (contract, sender).
      const enc = await fhevm
        .createEncryptedInput(tokenAddr, aliceAddr)
        .add64(30n)
        .encrypt();

      await (
        await token
          .connect(alice)
          ["confidentialTransfer(address,bytes32,bytes)"](
            bobAddr,
            enc.handles[0],
            enc.inputProof,
          )
      ).wait();

      expect(await balanceOf(alice)).to.equal(70n);
      expect(await balanceOf(bob)).to.equal(30n);
    });
  });

  describe("unshield (unwrap → finalize)", () => {
    it("burns confidential balance and returns public ERC-20", async () => {
      const aliceAddr = await alice.getAddress();
      await (await underlying.connect(alice).approve(tokenAddr, 100n * ONE)).wait();
      await (await token.connect(alice).wrap(aliceAddr, 100n * ONE)).wait();

      // Step 1: request unwrap of 40 confidential tokens (handle overload).
      const enc = await fhevm
        .createEncryptedInput(tokenAddr, aliceAddr)
        .add64(40n)
        .encrypt();

      const reqTx = await token
        .connect(alice)
        ["unwrap(address,address,bytes32,bytes)"](
          aliceAddr,
          aliceAddr,
          enc.handles[0],
          enc.inputProof,
        );
      const receipt = await reqTx.wait();

      // Recover the unwrap request id from the emitted event.
      const parsed = receipt!.logs
        .map((l) => {
          try {
            return token.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "UnwrapRequested");
      expect(parsed, "UnwrapRequested event").to.not.equal(undefined);
      const requestId: string = parsed!.args.unwrapRequestId;

      // Confidential balance already reduced by the burn.
      expect(await balanceOf(alice)).to.equal(60n);

      // Step 2: the amount handle is made publicly decryptable; obtain the
      // KMS-signed cleartext + proof and finalize (mirrors the Sepolia oracle).
      const { clearValues, decryptionProof } = await fhevm.publicDecrypt([
        requestId,
      ]);
      const cleartext = BigInt(clearValues[requestId] as bigint);
      expect(cleartext).to.equal(40n);

      await (
        await token.finalizeUnwrap(requestId, cleartext, decryptionProof)
      ).wait();

      // Public tokens returned to alice; wrapper holds the remainder.
      expect(await underlying.balanceOf(aliceAddr)).to.equal(940n * ONE);
      expect(await underlying.balanceOf(tokenAddr)).to.equal(60n * ONE);
    });
  });

  describe("ACL — selective disclosure via observer", () => {
    it("lets the owner grant an auditor read access to their balance", async () => {
      const aliceAddr = await alice.getAddress();
      const auditorAddr = await auditor.getAddress();

      await (await underlying.connect(alice).approve(tokenAddr, 50n * ONE)).wait();
      await (await token.connect(alice).wrap(aliceAddr, 50n * ONE)).wait();

      // Grant: alice appoints the auditor as her observer.
      await (await token.connect(alice).setObserver(aliceAddr, auditorAddr)).wait();
      expect(await token.observer(aliceAddr)).to.equal(auditorAddr);

      // A subsequent transfer refreshes the balance handle and grants the
      // observer ACL access to the new handle.
      const enc = await fhevm
        .createEncryptedInput(tokenAddr, aliceAddr)
        .add64(10n)
        .encrypt();
      await (
        await token
          .connect(alice)
          ["confidentialTransfer(address,bytes32,bytes)"](
            await bob.getAddress(),
            enc.handles[0],
            enc.inputProof,
          )
      ).wait();

      // The auditor can now decrypt alice's balance handle.
      const handle = await token.confidentialBalanceOf(aliceAddr);
      const seenByAuditor = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        tokenAddr,
        auditor,
      );
      expect(seenByAuditor).to.equal(40n);
    });

    it("lets the owner revoke the auditor", async () => {
      const aliceAddr = await alice.getAddress();
      const auditorAddr = await auditor.getAddress();

      await (await token.connect(alice).setObserver(aliceAddr, auditorAddr)).wait();
      expect(await token.observer(aliceAddr)).to.equal(auditorAddr);

      // Revoke by setting observer back to the zero address.
      await (
        await token.connect(alice).setObserver(aliceAddr, ethers.ZeroAddress)
      ).wait();
      expect(await token.observer(aliceAddr)).to.equal(ethers.ZeroAddress);
    });

    it("rejects an unauthorized observer assignment", async () => {
      const aliceAddr = await alice.getAddress();
      const auditorAddr = await auditor.getAddress();
      // Bob cannot set an observer on alice's account.
      await expect(
        token.connect(bob).setObserver(aliceAddr, auditorAddr),
      ).to.be.revertedWithCustomError(token, "Unauthorized");
    });
  });
});
