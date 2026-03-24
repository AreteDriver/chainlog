import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeadMansSwitchModule = buildModule("DeadMansSwitchModule", (m) => {
  const beneficiary = m.getParameter("beneficiary");
  const expiryWindow = m.getParameter("expiryWindow", 259200); // default 72 hours

  const dms = m.contract("DeadMansSwitch", [beneficiary, expiryWindow]);
  return { dms };
});

export default DeadMansSwitchModule;
