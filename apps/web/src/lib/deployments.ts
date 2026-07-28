/** Landing-only deployment list — no viem imports (keeps marketing page lean). */

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name: string): string {
  return process.env[name] ?? ZERO;
}

export const LANDING_DEPLOYMENTS = [
  { label: "Intent book", address: env("NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS") },
  { label: "Epoch manager", address: env("NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS") },
  {
    label: "Settlement engine",
    address: env("NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS"),
  },
  {
    label: "Confidential mUSDC",
    address: env("NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS"),
  },
] as const;

export const ETHERSCAN_ADDRESS = (addr: string) =>
  `https://sepolia.etherscan.io/address/${addr}`;
