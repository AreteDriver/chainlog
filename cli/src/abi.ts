/** Minimal ChainLog contract ABI for CLI read operations. */
export const CHAINLOG_ABI = [
  {
    inputs: [
      { name: "agentId", type: "string" },
      { name: "index", type: "uint256" },
      { name: "claimedHash", type: "bytes32" },
    ],
    name: "verifyAction",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "string" }],
    name: "getRecordCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "", type: "string" },
      { name: "", type: "uint256" },
    ],
    name: "agentLogs",
    outputs: [
      { name: "actionHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
      { name: "timestamp", type: "uint256" },
      { name: "submitter", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalActions",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_MAINNET_RPC = "https://mainnet.base.org";
