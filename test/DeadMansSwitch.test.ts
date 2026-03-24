import { expect } from "chai";
import { ethers } from "hardhat";
import { DeadMansSwitch } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DeadMansSwitch", function () {
  let dms: DeadMansSwitch;
  let owner: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let stranger: SignerWithAddress;

  const EXPIRY_72H = 72 * 60 * 60; // 72 hours in seconds
  const ONE_ETH = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, beneficiary, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DeadMansSwitch");
    dms = await factory.deploy(beneficiary.address, EXPIRY_72H);
  });

  describe("constructor", function () {
    it("should set immutable parameters correctly", async function () {
      expect(await dms.owner()).to.equal(owner.address);
      expect(await dms.beneficiary()).to.equal(beneficiary.address);
      expect(await dms.expiryWindow()).to.equal(EXPIRY_72H);
      expect(await dms.triggered()).to.be.false;
    });

    it("should initialize lastHeartbeat to deploy time", async function () {
      const lastHb = await dms.lastHeartbeat();
      expect(lastHb).to.be.greaterThan(0);
    });

    it("should revert on zero beneficiary", async function () {
      const factory = await ethers.getContractFactory("DeadMansSwitch");
      await expect(
        factory.deploy(ethers.ZeroAddress, EXPIRY_72H)
      ).to.be.revertedWith("DeadMansSwitch: zero beneficiary");
    });

    it("should revert on expiry too short (< 1 hour)", async function () {
      const factory = await ethers.getContractFactory("DeadMansSwitch");
      await expect(
        factory.deploy(beneficiary.address, 1800)
      ).to.be.revertedWith("DeadMansSwitch: expiry too short");
    });

    it("should revert on expiry too long (> 365 days)", async function () {
      const factory = await ethers.getContractFactory("DeadMansSwitch");
      await expect(
        factory.deploy(beneficiary.address, 366 * 24 * 60 * 60)
      ).to.be.revertedWith("DeadMansSwitch: expiry too long");
    });

    it("should accept minimum expiry of 1 hour", async function () {
      const factory = await ethers.getContractFactory("DeadMansSwitch");
      const minDms = await factory.deploy(beneficiary.address, 3600);
      expect(await minDms.expiryWindow()).to.equal(3600);
    });
  });

  describe("heartbeat", function () {
    it("should reset the timer and emit event", async function () {
      await time.increase(3600); // advance 1 hour

      await expect(dms.heartbeat())
        .to.emit(dms, "Heartbeat");

      const remaining = await dms.timeRemaining();
      // Should be close to full expiryWindow again
      expect(remaining).to.be.closeTo(BigInt(EXPIRY_72H), 5n);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        dms.connect(stranger).heartbeat()
      ).to.be.revertedWith("DeadMansSwitch: not owner");
    });

    it("should revert after trigger", async function () {
      // Fund, expire, trigger
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      await time.increase(EXPIRY_72H);
      await dms.connect(stranger).execute();

      await expect(dms.heartbeat()).to.be.revertedWith(
        "DeadMansSwitch: already triggered"
      );
    });

    it("should allow multiple heartbeats", async function () {
      for (let i = 0; i < 5; i++) {
        await time.increase(3600);
        await dms.heartbeat();
      }
      // Should still have full time remaining
      const remaining = await dms.timeRemaining();
      expect(remaining).to.be.closeTo(BigInt(EXPIRY_72H), 5n);
    });
  });

  describe("execute", function () {
    beforeEach(async function () {
      // Fund the contract
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
    });

    it("should transfer ETH to beneficiary after expiry", async function () {
      await time.increase(EXPIRY_72H);

      const balBefore = await ethers.provider.getBalance(beneficiary.address);
      await dms.connect(stranger).execute();
      const balAfter = await ethers.provider.getBalance(beneficiary.address);

      expect(balAfter - balBefore).to.equal(ONE_ETH);
      expect(await dms.triggered()).to.be.true;
    });

    it("should emit SwitchTriggered event", async function () {
      await time.increase(EXPIRY_72H);

      await expect(dms.connect(stranger).execute())
        .to.emit(dms, "SwitchTriggered")
        .withArgs(
          stranger.address,
          beneficiary.address,
          ONE_ETH,
          (ts: bigint) => ts > 0n
        );
    });

    it("should be callable by anyone after expiry", async function () {
      await time.increase(EXPIRY_72H);

      // Stranger can trigger it
      await expect(dms.connect(stranger).execute()).to.not.be.reverted;
    });

    it("should revert before expiry", async function () {
      await time.increase(EXPIRY_72H - 100);

      await expect(
        dms.connect(stranger).execute()
      ).to.be.revertedWith("DeadMansSwitch: not expired");
    });

    it("should revert on second execute (single-fire)", async function () {
      await time.increase(EXPIRY_72H);
      await dms.connect(stranger).execute();

      await expect(
        dms.connect(stranger).execute()
      ).to.be.revertedWith("DeadMansSwitch: already triggered");
    });

    it("should handle zero balance execution", async function () {
      // Deploy a new unfunded contract
      const factory = await ethers.getContractFactory("DeadMansSwitch");
      const unfunded = await factory.deploy(beneficiary.address, EXPIRY_72H);

      await time.increase(EXPIRY_72H);
      await expect(unfunded.connect(stranger).execute()).to.not.be.reverted;
      expect(await unfunded.triggered()).to.be.true;
    });

    it("should prevent heartbeat reset during execution (reentrancy)", async function () {
      await time.increase(EXPIRY_72H);
      await dms.connect(stranger).execute();

      // triggered = true, so heartbeat reverts
      await expect(dms.heartbeat()).to.be.revertedWith(
        "DeadMansSwitch: already triggered"
      );
    });
  });

  describe("timeRemaining", function () {
    it("should return full expiry window at deploy", async function () {
      const remaining = await dms.timeRemaining();
      expect(remaining).to.be.closeTo(BigInt(EXPIRY_72H), 5n);
    });

    it("should decrease over time", async function () {
      await time.increase(3600);
      const remaining = await dms.timeRemaining();
      expect(remaining).to.be.closeTo(BigInt(EXPIRY_72H - 3600), 5n);
    });

    it("should return 0 after expiry", async function () {
      await time.increase(EXPIRY_72H + 100);
      expect(await dms.timeRemaining()).to.equal(0);
    });

    it("should return 0 after trigger", async function () {
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      await time.increase(EXPIRY_72H);
      await dms.execute();
      expect(await dms.timeRemaining()).to.equal(0);
    });
  });

  describe("isExpired", function () {
    it("should return false before expiry", async function () {
      expect(await dms.isExpired()).to.be.false;
    });

    it("should return true after expiry", async function () {
      await time.increase(EXPIRY_72H);
      expect(await dms.isExpired()).to.be.true;
    });

    it("should return false after trigger (already fired)", async function () {
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      await time.increase(EXPIRY_72H);
      await dms.execute();
      expect(await dms.isExpired()).to.be.false;
    });
  });

  describe("funding", function () {
    it("should accept ETH via receive", async function () {
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      const balance = await ethers.provider.getBalance(await dms.getAddress());
      expect(balance).to.equal(ONE_ETH);
    });

    it("should emit Funded event", async function () {
      const addr = await dms.getAddress();
      await expect(
        owner.sendTransaction({ to: addr, value: ONE_ETH })
      )
        .to.emit(dms, "Funded")
        .withArgs(owner.address, ONE_ETH);
    });

    it("should reject ETH after trigger", async function () {
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      await time.increase(EXPIRY_72H);
      await dms.execute();

      await expect(
        owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH })
      ).to.be.revertedWith("DeadMansSwitch: already triggered");
    });

    it("should accept multiple deposits", async function () {
      const addr = await dms.getAddress();
      await owner.sendTransaction({ to: addr, value: ONE_ETH });
      await stranger.sendTransaction({ to: addr, value: ONE_ETH });

      const balance = await ethers.provider.getBalance(addr);
      expect(balance).to.equal(ethers.parseEther("2.0"));
    });
  });

  describe("fallback", function () {
    it("should revert on calls to nonexistent functions", async function () {
      const addr = await dms.getAddress();
      await expect(
        owner.sendTransaction({
          to: addr,
          data: "0xdeadbeef",
          value: 0,
        })
      ).to.be.revertedWith("DeadMansSwitch: invalid call");
    });
  });

  describe("gas costs", function () {
    it("should report gas for heartbeat", async function () {
      const tx = await dms.heartbeat();
      const receipt = await tx.wait();
      console.log(`    Gas for heartbeat: ${receipt!.gasUsed.toString()}`);
    });

    it("should report gas for execute", async function () {
      await owner.sendTransaction({ to: await dms.getAddress(), value: ONE_ETH });
      await time.increase(EXPIRY_72H);

      const tx = await dms.connect(stranger).execute();
      const receipt = await tx.wait();
      console.log(`    Gas for execute: ${receipt!.gasUsed.toString()}`);
    });
  });
});
