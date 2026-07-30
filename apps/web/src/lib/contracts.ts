import { keccak256, toBytes, type Address } from "viem";

/** Ethereum Sepolia — the only network Noxage runs on. */
export const SEPOLIA_CHAIN_ID = 11155111;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function required(name: string, value: string | undefined): Address {
  if (!value) {
    // Surfaced at runtime in the UI rather than crashing the build; a missing
    // address means the deploy step for that contract has not been run yet.
    console.warn(`[noxage] missing env ${name}`);
  }
  return (value ?? ZERO_ADDRESS) as Address;
}

export const addresses = {
  intentBook: required(
    "NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS,
  ),
  epochManager: required(
    "NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS,
  ),
  confidentialUSDC: required(
    "NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS,
  ),
  confidentialWETH: required(
    "NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS,
  ),
  mockUSDC: required(
    "NEXT_PUBLIC_MOCK_USDC_ADDRESS",
    process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS,
  ),
  mockWETH: required(
    "NEXT_PUBLIC_MOCK_WETH_ADDRESS",
    process.env.NEXT_PUBLIC_MOCK_WETH_ADDRESS,
  ),
  fillLedger: required(
    "NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS,
  ),
  // "Executor" is the deploy-time name for the settlement engine (same address).
  settlementEngine: required(
    "NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS",
    process.env.NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS,
  ),
} as const;

/**
 * Names of contracts whose env address is missing (zero address). Non-empty
 * means the build is misconfigured — the app shell shows a blocking notice
 * instead of letting reads silently return nothing.
 */
export const MISSING_ADDRESSES: string[] = Object.entries(addresses)
  .filter(([, addr]) => addr === ZERO_ADDRESS)
  .map(([name]) => name);

function requiredBlock(name: string, value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) {
    console.warn(`[noxage] missing or invalid env ${name}`);
    return 0n;
  }
  return BigInt(value);
}

/** First block scanned for intent, settlement, and fill events. */
export const INTENT_BOOK_DEPLOY_BLOCK = requiredBlock(
  "NEXT_PUBLIC_NOXAGE_DEPLOY_BLOCK",
  process.env.NEXT_PUBLIC_NOXAGE_DEPLOY_BLOCK,
);

export type TokenKey = "USDC" | "WETH";

export interface TokenMeta {
  key: TokenKey;
  /** Display symbol. */
  symbol: string;
  /** Underlying public ERC-20 (the mock faucet token) decimals. */
  decimals: number;
  /** Confidential balances preserve the underlying token's native decimals. */
  confidentialDecimals: number;
  /** Public ERC-20 (mock, faucet-mintable). */
  mock: Address;
  /** Confidential wrapper (shield target). */
  confidential: Address;
}

export const TOKENS: Record<TokenKey, TokenMeta> = {
  USDC: {
    key: "USDC",
    symbol: "mUSDC",
    decimals: 6,
    confidentialDecimals: 6,
    mock: addresses.mockUSDC,
    confidential: addresses.confidentialUSDC,
  },
  WETH: {
    key: "WETH",
    symbol: "mWETH",
    decimals: 18,
    confidentialDecimals: 18,
    mock: addresses.mockWETH,
    confidential: addresses.confidentialWETH,
  },
};

export const TOKEN_LIST: TokenMeta[] = [TOKENS.WETH, TOKENS.USDC];

/**
 * Public market identifier for the MVP residual pair. Must match the contract's
 * convention: keccak256 of the "base/quote" string. Base = mWETH, quote = mUSDC.
 */
export const MVP_PAIR_LABEL = "mWETH/mUSDC";
export const MVP_PAIR_ID = keccak256(toBytes(MVP_PAIR_LABEL));

export const ETHERSCAN_TX = (hash: string) =>
  `https://sepolia.etherscan.io/tx/${hash}`;
export const ETHERSCAN_ADDRESS = (addr: string) =>
  `https://sepolia.etherscan.io/address/${addr}`;
