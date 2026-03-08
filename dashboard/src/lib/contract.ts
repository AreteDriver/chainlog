/** ChainLog contract configuration and ABI. */

export const CHAINLOG_ABI = [
  {
    inputs: [
      { name: "agentId", type: "string" },
      { name: "actionHash", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    name: "logAction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "string" },
      { indexed: true, name: "actionHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "submitter", type: "address" },
    ],
    name: "ActionLogged",
    type: "event",
  },
] as const;

// Default contract address — set via NEXT_PUBLIC_CHAINLOG_CONTRACT
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CHAINLOG_CONTRACT as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
