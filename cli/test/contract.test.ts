import { describe, it, expect } from "vitest";
import { getRpcUrl } from "../src/contract.js";
import { BASE_SEPOLIA_RPC, BASE_MAINNET_RPC } from "../src/abi.js";

describe("getRpcUrl", () => {
  it("returns sepolia for 'sepolia'", () => {
    expect(getRpcUrl("sepolia")).toBe(BASE_SEPOLIA_RPC);
  });

  it("returns mainnet for 'mainnet'", () => {
    expect(getRpcUrl("mainnet")).toBe(BASE_MAINNET_RPC);
  });

  it("returns mainnet for 'base'", () => {
    expect(getRpcUrl("base")).toBe(BASE_MAINNET_RPC);
  });

  it("defaults to sepolia for unknown", () => {
    expect(getRpcUrl("unknown")).toBe(BASE_SEPOLIA_RPC);
  });
});
