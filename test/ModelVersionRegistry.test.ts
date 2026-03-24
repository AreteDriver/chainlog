import { expect } from "chai";
import { ethers } from "hardhat";
import { ModelVersionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ModelVersionRegistry", function () {
  let registry: ModelVersionRegistry;
  let operator: SignerWithAddress;
  let other: SignerWithAddress;

  const MODEL_ID = "claude-sonnet-4-5-20251001";
  const MODEL_HASH = ethers.keccak256(ethers.toUtf8Bytes("model-weights-v1"));
  const PIN_METHOD = "PROXY_FINGERPRINT";
  const METADATA = '{"temperature":0.7,"max_tokens":4096}';

  beforeEach(async function () {
    [operator, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("ModelVersionRegistry");
    registry = await factory.deploy();
  });

  describe("pinVersion", function () {
    it("should pin a model version and emit event", async function () {
      await expect(
        registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA)
      )
        .to.emit(registry, "VersionPinned")
        .withArgs(
          operator.address,
          ethers.keccak256(ethers.toUtf8Bytes(MODEL_ID)),
          MODEL_ID,
          MODEL_HASH,
          PIN_METHOD,
          METADATA,
          (ts: bigint) => ts > 0n
        );

      expect(await registry.totalPins()).to.equal(1);
    });

    it("should store correct pin record", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA);

      const pin = await registry.getLatestPin(MODEL_ID, operator.address);
      expect(pin.modelHash).to.equal(MODEL_HASH);
      expect(pin.pinMethod).to.equal(PIN_METHOD);
      expect(pin.metadata).to.equal(METADATA);
      expect(pin.operator).to.equal(operator.address);
      expect(pin.timestamp).to.be.greaterThan(0);
    });

    it("should allow multiple pins for same model (version history)", async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("v1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("v2"));

      await registry.pinVersion(MODEL_ID, hash1, PIN_METHOD, "v1");
      await registry.pinVersion(MODEL_ID, hash2, PIN_METHOD, "v2");

      expect(await registry.getPinCount(MODEL_ID, operator.address)).to.equal(2);

      const latest = await registry.getLatestPin(MODEL_ID, operator.address);
      expect(latest.modelHash).to.equal(hash2);
    });

    it("should allow different operators to pin same model", async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("op1-hash"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("op2-hash"));

      await registry.pinVersion(MODEL_ID, hash1, PIN_METHOD, "");
      await registry.connect(other).pinVersion(MODEL_ID, hash2, PIN_METHOD, "");

      expect(await registry.getPinCount(MODEL_ID, operator.address)).to.equal(1);
      expect(await registry.getPinCount(MODEL_ID, other.address)).to.equal(1);
      expect(await registry.totalPins()).to.equal(2);
    });

    it("should allow different pin methods", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("weights"));
      await registry.pinVersion(MODEL_ID, hash, "PROVIDER_HASH", "");

      const pin = await registry.getLatestPin(MODEL_ID, operator.address);
      expect(pin.pinMethod).to.equal("PROVIDER_HASH");
    });

    it("should allow empty metadata", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, "");

      const pin = await registry.getLatestPin(MODEL_ID, operator.address);
      expect(pin.metadata).to.equal("");
    });

    it("should revert on empty modelId", async function () {
      await expect(
        registry.pinVersion("", MODEL_HASH, PIN_METHOD, METADATA)
      ).to.be.revertedWith("ModelVersionRegistry: empty modelId");
    });

    it("should revert on zero hash", async function () {
      await expect(
        registry.pinVersion(MODEL_ID, ethers.ZeroHash, PIN_METHOD, METADATA)
      ).to.be.revertedWith("ModelVersionRegistry: zero hash");
    });

    it("should revert on empty pinMethod", async function () {
      await expect(
        registry.pinVersion(MODEL_ID, MODEL_HASH, "", METADATA)
      ).to.be.revertedWith("ModelVersionRegistry: empty pinMethod");
    });
  });

  describe("getLatestPin", function () {
    it("should return the most recent pin", async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("old"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("new"));

      await registry.pinVersion(MODEL_ID, hash1, PIN_METHOD, "first");
      await registry.pinVersion(MODEL_ID, hash2, PIN_METHOD, "second");

      const latest = await registry.getLatestPin(MODEL_ID, operator.address);
      expect(latest.modelHash).to.equal(hash2);
      expect(latest.metadata).to.equal("second");
    });

    it("should revert when no pins exist", async function () {
      await expect(
        registry.getLatestPin("nonexistent-model", operator.address)
      ).to.be.revertedWith("ModelVersionRegistry: no pins found");
    });
  });

  describe("verifyPin", function () {
    it("should return true for a pinned hash", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA);

      expect(
        await registry.verifyPin(MODEL_ID, MODEL_HASH, operator.address)
      ).to.be.true;
    });

    it("should return false for an unpinned hash", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA);
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));

      expect(
        await registry.verifyPin(MODEL_ID, wrongHash, operator.address)
      ).to.be.false;
    });

    it("should return false for wrong operator", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA);

      expect(
        await registry.verifyPin(MODEL_ID, MODEL_HASH, other.address)
      ).to.be.false;
    });

    it("should return true for historical pin even after newer pin", async function () {
      const oldHash = ethers.keccak256(ethers.toUtf8Bytes("old-version"));
      const newHash = ethers.keccak256(ethers.toUtf8Bytes("new-version"));

      await registry.pinVersion(MODEL_ID, oldHash, PIN_METHOD, "");
      await registry.pinVersion(MODEL_ID, newHash, PIN_METHOD, "");

      // Both should verify
      expect(await registry.verifyPin(MODEL_ID, oldHash, operator.address)).to.be.true;
      expect(await registry.verifyPin(MODEL_ID, newHash, operator.address)).to.be.true;
    });

    it("should return false for nonexistent model", async function () {
      expect(
        await registry.verifyPin("no-such-model", MODEL_HASH, operator.address)
      ).to.be.false;
    });
  });

  describe("getPins (paginated)", function () {
    beforeEach(async function () {
      for (let i = 0; i < 5; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`version-${i}`));
        await registry.pinVersion(MODEL_ID, hash, PIN_METHOD, `v${i}`);
      }
    });

    it("should return all pins with sufficient limit", async function () {
      const [records, total] = await registry.getPins(
        MODEL_ID, operator.address, 0, 10
      );
      expect(total).to.equal(5);
      expect(records.length).to.equal(5);
      expect(records[0].metadata).to.equal("v0");
      expect(records[4].metadata).to.equal("v4");
    });

    it("should paginate with offset and limit", async function () {
      const [records, total] = await registry.getPins(
        MODEL_ID, operator.address, 2, 2
      );
      expect(total).to.equal(5);
      expect(records.length).to.equal(2);
      expect(records[0].metadata).to.equal("v2");
      expect(records[1].metadata).to.equal("v3");
    });

    it("should return empty array for offset beyond total", async function () {
      const [records, total] = await registry.getPins(
        MODEL_ID, operator.address, 10, 5
      );
      expect(total).to.equal(5);
      expect(records.length).to.equal(0);
    });

    it("should clamp limit to available records", async function () {
      const [records, total] = await registry.getPins(
        MODEL_ID, operator.address, 3, 100
      );
      expect(total).to.equal(5);
      expect(records.length).to.equal(2);
    });

    it("should return empty for unknown model", async function () {
      const [records, total] = await registry.getPins(
        "unknown", operator.address, 0, 10
      );
      expect(total).to.equal(0);
      expect(records.length).to.equal(0);
    });
  });

  describe("getPinCount", function () {
    it("should return 0 for unknown model", async function () {
      expect(await registry.getPinCount("unknown", operator.address)).to.equal(0);
    });

    it("should track counts per operator independently", async function () {
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, "");
      await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, "");
      await registry.connect(other).pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, "");

      expect(await registry.getPinCount(MODEL_ID, operator.address)).to.equal(2);
      expect(await registry.getPinCount(MODEL_ID, other.address)).to.equal(1);
    });
  });

  describe("gas costs", function () {
    it("should report gas for pinVersion", async function () {
      const tx = await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, METADATA);
      const receipt = await tx.wait();
      console.log(`    Gas for pinVersion: ${receipt!.gasUsed.toString()}`);
    });

    it("should report gas for pinVersion with empty metadata", async function () {
      const tx = await registry.pinVersion(MODEL_ID, MODEL_HASH, PIN_METHOD, "");
      const receipt = await tx.wait();
      console.log(`    Gas for pinVersion (no metadata): ${receipt!.gasUsed.toString()}`);
    });
  });
});
