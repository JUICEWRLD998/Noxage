import { formatUnits } from "viem";

export { truncateHex } from "./hex";

/**
 * Insert en-US thousands separators into a bigint's decimal string without
 * round-tripping through Number (which loses precision above 2^53).
 */
function groupDigits(whole: string): string {
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    grouped += digits[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) grouped += ",";
  }
  return negative ? `-${grouped}` : grouped;
}

/** Format a bigint amount to a readable, tabular-friendly string. */
export function formatAmount(
  value: bigint,
  decimals: number,
  maxFractionDigits = 4,
): string {
  const raw = formatUnits(value, decimals);
  const [whole, frac = ""] = raw.split(".");
  const trimmedFrac = frac.slice(0, maxFractionDigits).replace(/0+$/, "");
  const wholeGrouped = groupDigits(whole);
  return trimmedFrac ? `${wholeGrouped}.${trimmedFrac}` : wholeGrouped;
}

/** mm:ss countdown from a number of seconds remaining (clamped at 0). */
export function formatCountdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Parse a user-typed decimal string into base units. Returns null on invalid
 * input (empty, non-numeric, too many decimals). Never throws.
 */
export function parseAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = frac.padEnd(decimals, "0");
  try {
    const value = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
    return value;
  } catch {
    return null;
  }
}
