import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ChainLogModule = buildModule("ChainLogModule", (m) => {
  const chainLog = m.contract("ChainLog");
  return { chainLog };
});

export default ChainLogModule;
