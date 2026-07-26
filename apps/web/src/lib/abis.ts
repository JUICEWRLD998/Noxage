// Minimal viem const ABIs — only the fragments the frontend calls. Hand-written
// (not imported from artifacts) to keep the web bundle free of contract JSON.

export const mockErc20Abi = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "FAUCET_AMOUNT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const confidentialTokenAbi = [
  {
    type: "function",
    name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    // The plaintext-handle unwrap overload (from == msg.sender's holdings).
    type: "function",
    name: "unwrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "bytes32" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "rate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "underlying",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    // ERC7984ObserverAccess: appoint / revoke a selective-disclosure observer.
    // Caller must be `account`; zero address revokes.
    type: "function",
    name: "setObserver",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "newObserver", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "observer",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const intentBookAbi = [
  {
    type: "function",
    name: "submitIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pair", type: "bytes32" },
      { name: "deadline", type: "uint64" },
      { name: "sideExt", type: "bytes32" },
      { name: "amountExt", type: "bytes32" },
      { name: "limitExt", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "intentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "intentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "epochIntentCount",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getIntent",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "epochId", type: "uint256" },
          { name: "pair", type: "bytes32" },
          { name: "deadline", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "side", type: "bytes32" },
          { name: "amount", type: "bytes32" },
          { name: "limit", type: "bytes32" },
        ],
      },
    ],
  },
  {
    // Encrypted field handles (euint8/euint64 surface as bytes32 in the ABI).
    type: "function",
    name: "intentHandles",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [
      { name: "side", type: "bytes32" },
      { name: "amount", type: "bytes32" },
      { name: "limit", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "IntentSubmitted",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true },
      { name: "epochId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "pair", type: "bytes32", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentCancelled",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true },
      { name: "epochId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export const epochManagerAbi = [
  {
    type: "function",
    name: "activeEpochId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "currentEpochId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "statusOf",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "epochDuration",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "getEpoch",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "openedAt", type: "uint64" },
          { name: "closedAt", type: "uint64" },
          { name: "intentCount", type: "uint32" },
          { name: "settlementRef", type: "bytes32" },
        ],
      },
    ],
  },
  {
    // Owner any time; permissionless once openedAt + epochDuration has elapsed.
    type: "function",
    name: "closeEpoch",
    stateMutability: "nonpayable",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [],
  },
] as const;

/** NoxageEpochManager status enum (None, Open, Closed, Settled, Failed). */
export enum EpochStatus {
  None = 0,
  Open = 1,
  Closed = 2,
  Settled = 3,
  Failed = 4,
}

export const fillLedgerAbi = [
  {
    type: "function",
    name: "isFilled",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getFill",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "epochId", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "set", type: "bool" },
          { name: "recvBase", type: "bytes32" },
          { name: "recvQuote", type: "bytes32" },
          { name: "payBase", type: "bytes32" },
          { name: "payQuote", type: "bytes32" },
        ],
      },
    ],
  },
  {
    // Encrypted fill legs (euint64 handles surface as bytes32 in the ABI).
    type: "function",
    name: "fillHandles",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [
      { name: "recvBase", type: "bytes32" },
      { name: "recvQuote", type: "bytes32" },
      { name: "payBase", type: "bytes32" },
      { name: "payQuote", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "FillCredited",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "intentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export const settlementEngineAbi = [
  {
    type: "function",
    name: "settlementStatus",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "getSettlement",
    stateMutability: "view",
    inputs: [{ name: "epochId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "residualHandle", type: "bytes32" },
          { name: "dirHandle", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "SettlementPrepared",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "residualHandle", type: "bytes32", indexed: false },
      { name: "dirHandle", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResidualSwapped",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "buyHeavy", type: "bool", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SettlementFinalized",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "filledIntents", type: "uint256", indexed: false },
      { name: "settlementRef", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SettlementFailedEvent",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "settlementRef", type: "bytes32", indexed: false },
    ],
  },
] as const;

/** NoxageSettlementEngine status enum (None, Prepared, Settled, Failed). */
export enum SettlementStatus {
  None = 0,
  Prepared = 1,
  Settled = 2,
  Failed = 3,
}

/** NoxageIntentBook intent status enum (None, Active, Cancelled). */
export enum IntentStatus {
  None = 0,
  Active = 1,
  Cancelled = 2,
}
