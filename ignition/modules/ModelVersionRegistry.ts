import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ModelVersionRegistryModule = buildModule("ModelVersionRegistryModule", (m) => {
  const registry = m.contract("ModelVersionRegistry");
  return { registry };
});

export default ModelVersionRegistryModule;
