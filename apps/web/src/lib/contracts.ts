import { keccak256, toBytes, type Address } from "viem";

/** Ethereum Sepolia — the only network Noxage runs on. */
export const SEPOLIA_CHAIN_ID = 11155111;

function required(name: string, value: string | undefined): Address {
  if (!value) {
    // Surfaced at runtime in the UI rather than crashing the build; a missing
    // address means the deploy step for that contract has not been run yet.
    console.warn(`[noxage] missing env ${name}`);
  }
  return (value ?? "0x0000000000000000000000000000000000000000") as Address;
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
} as const;

export type TokenKey = "USDC" | "WETH";

export interface TokenMeta {
  key: TokenKey;
  /** Display symbol. */
  symbol: string;
  /** Underlying public ERC-20 (the mock faucet token) decimals. */
  decimals: number;
  /**
   * Confidential-balance decimals. The ERC7984 wrapper caps at maxDecimals = 6,
   * so confidential balances are always stored in 6-decimal units regardless of
   * the underlying token's decimals.
   */
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
    confidentialDecimals: 6,
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
