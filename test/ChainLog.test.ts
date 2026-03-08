import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainLog } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainLog", function () {
  let chainLog: ChainLog;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  const AGENT_ID = "forge-orchestrator-v2";
  const METADATA_URI = "ipfs://QmTest123";

  function makeHash(data: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("ChainLog");
    chainLog = await factory.deploy();
  });

  describe("logAction", function () {
    it("should log a single action and emit event", async function () {
      const hash = makeHash("action-1");

      await expect(chainLog.logAction(AGENT_ID, hash, METADATA_URI))
        .to.emit(chainLog, "ActionLogged")
        .withArgs(AGENT_ID, hash, await getBlockTimestamp(), owner.address);

      expect(await chainLog.totalActions()).to.equal(1);
      expect(await chainLog.getRecordCount(AGENT_ID)).to.equal(1);
    });

    it("should store correct record data", async function () {
      const hash = makeHash("action-data");
      await chainLog.logAction(AGENT_ID, hash, METADATA_URI);

      const record = await chainLog.agentLogs(AGENT_ID, 0);
      expect(record.actionHash).to.equal(hash);
      expect(record.metadataURI).to.equal(METADATA_URI);
      expect(record.submitter).to.equal(owner.address);
    });

    it("should allow different submitters", async function () {
      const hash1 = makeHash("from-owner");
      const hash2 = makeHash("from-other");

      await chainLog.logAction(AGENT_ID, hash1, METADATA_URI);
      await chainLog.connect(other).logAction(AGENT_ID, hash2, METADATA_URI);

      expect(await chainLog.getRecordCount(AGENT_ID)).to.equal(2);

      const record1 = await chainLog.agentLogs(AGENT_ID, 0);
      const record2 = await chainLog.agentLogs(AGENT_ID, 1);
      expect(record1.submitter).to.equal(owner.address);
      expect(record2.submitter).to.equal(other.address);
    });

    it("should allow multiple agents", async function () {
      const hash1 = makeHash("agent-a-action");
      const hash2 = makeHash("agent-b-action");

      await chainLog.logAction("agent-a", hash1, METADATA_URI);
      await chainLog.logAction("agent-b", hash2, METADATA_URI);

      expect(await chainLog.getRecordCount("agent-a")).to.equal(1);
      expect(await chainLog.getRecordCount("agent-b")).to.equal(1);
      expect(await chainLog.totalActions()).to.equal(2);
    });

    it("should increment totalActions correctly", async function () {
      for (let i = 0; i < 5; i++) {
        await chainLog.logAction(AGENT_ID, makeHash(`action-${i}`), METADATA_URI);
      }
      expect(await chainLog.totalActions()).to.equal(5);
      expect(await chainLog.getRecordCount(AGENT_ID)).to.equal(5);
    });
  });

  describe("logBatch", function () {
    it("should log multiple actions in one tx", async function () {
      const hashes = [makeHash("batch-1"), makeHash("batch-2"), makeHash("batch-3")];
      const uris = [METADATA_URI, METADATA_URI, METADATA_URI];

      const tx = await chainLog.logBatch(AGENT_ID, hashes, uris);
      const receipt = await tx.wait();

      expect(await chainLog.totalActions()).to.equal(3);
      expect(await chainLog.getRecordCount(AGENT_ID)).to.equal(3);

      // Should emit BatchLogged
      await expect(tx)
        .to.emit(chainLog, "BatchLogged")
        .withArgs(AGENT_ID, 3, owner.address);

      // Should emit individual ActionLogged for each
      for (const hash of hashes) {
        await expect(tx).to.emit(chainLog, "ActionLogged");
      }
    });

    it("should revert on length mismatch", async function () {
      const hashes = [makeHash("a"), makeHash("b")];
      const uris = [METADATA_URI];

      await expect(
        chainLog.logBatch(AGENT_ID, hashes, uris)
      ).to.be.revertedWith("ChainLog: length mismatch");
    });

    it("should revert on empty batch", async function () {
      await expect(
        chainLog.logBatch(AGENT_ID, [], [])
      ).to.be.revertedWith("ChainLog: empty batch");
    });

    it("should revert on batch > 100", async function () {
      const hashes = Array.from({ length: 101 }, (_, i) => makeHash(`item-${i}`));
      const uris = Array.from({ length: 101 }, () => METADATA_URI);

      await expect(
        chainLog.logBatch(AGENT_ID, hashes, uris)
      ).to.be.revertedWith("ChainLog: batch too large");
    });

    it("should handle max batch size of 100", async function () {
      const hashes = Array.from({ length: 100 }, (_, i) => makeHash(`item-${i}`));
      const uris = Array.from({ length: 100 }, () => METADATA_URI);

      await chainLog.logBatch(AGENT_ID, hashes, uris);
      expect(await chainLog.totalActions()).to.equal(100);
      expect(await chainLog.getRecordCount(AGENT_ID)).to.equal(100);
    });
  });

  describe("verifyAction", function () {
    it("should return true for matching hash", async function () {
      const hash = makeHash("verify-me");
      await chainLog.logAction(AGENT_ID, hash, METADATA_URI);

      expect(await chainLog.verifyAction(AGENT_ID, 0, hash)).to.be.true;
    });

    it("should return false for non-matching hash", async function () {
      const hash = makeHash("original");
      const wrongHash = makeHash("tampered");
      await chainLog.logAction(AGENT_ID, hash, METADATA_URI);

      expect(await chainLog.verifyAction(AGENT_ID, 0, wrongHash)).to.be.false;
    });

    it("should revert on out-of-bounds index", async function () {
      await chainLog.logAction(AGENT_ID, makeHash("only-one"), METADATA_URI);

      await expect(
        chainLog.verifyAction(AGENT_ID, 1, makeHash("anything"))
      ).to.be.revertedWith("ChainLog: index out of bounds");
    });

    it("should revert for agent with no records", async function () {
      await expect(
        chainLog.verifyAction("nonexistent-agent", 0, makeHash("anything"))
      ).to.be.revertedWith("ChainLog: index out of bounds");
    });
  });

  describe("getRecordCount", function () {
    it("should return 0 for unknown agent", async function () {
      expect(await chainLog.getRecordCount("unknown-agent")).to.equal(0);
    });

    it("should track per-agent counts independently", async function () {
      await chainLog.logAction("agent-x", makeHash("x1"), METADATA_URI);
      await chainLog.logAction("agent-x", makeHash("x2"), METADATA_URI);
      await chainLog.logAction("agent-y", makeHash("y1"), METADATA_URI);

      expect(await chainLog.getRecordCount("agent-x")).to.equal(2);
      expect(await chainLog.getRecordCount("agent-y")).to.equal(1);
    });
  });

  describe("gas costs", function () {
    it("should report gas for single logAction", async function () {
      const hash = makeHash("gas-test");
      const tx = await chainLog.logAction(AGENT_ID, hash, METADATA_URI);
      const receipt = await tx.wait();
      console.log(`    Gas for logAction: ${receipt!.gasUsed.toString()}`);
    });

    it("should report gas for batch of 10", async function () {
      const hashes = Array.from({ length: 10 }, (_, i) => makeHash(`gas-batch-${i}`));
      const uris = Array.from({ length: 10 }, () => METADATA_URI);

      const tx = await chainLog.logBatch(AGENT_ID, hashes, uris);
      const receipt = await tx.wait();
      console.log(`    Gas for logBatch(10): ${receipt!.gasUsed.toString()}`);
      console.log(`    Gas per action (batched): ${(Number(receipt!.gasUsed) / 10).toFixed(0)}`);
    });
  });

  // Helper to get the next block timestamp
  async function getBlockTimestamp(): Promise<number> {
    const block = await ethers.provider.getBlock("latest");
    return block!.timestamp + 1;
  }
});
