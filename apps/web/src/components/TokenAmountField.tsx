"use client";

import { TOKEN_LIST, type TokenKey } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import styles from "./TokenAmountField.module.css";

interface TokenAmountFieldProps {
  label: string;
  amount: string;
  onAmountChange: (value: string) => void;
  tokenKey: TokenKey;
  onTokenChange?: (key: TokenKey) => void;
  /** Available balance in base units for the MAX shortcut + display. */
  balance?: bigint;
  balanceDecimals?: number;
  balanceLabel?: string;
  disabled?: boolean;
  error?: string;
  lockToken?: boolean;
}

/**
 * Amount input with a token selector and a MAX shortcut. Amounts render in mono
 * + tabular nums. Only accepts numeric input.
 */
export function TokenAmountField({
  label,
  amount,
  onAmountChange,
  tokenKey,
  onTokenChange,
  balance,
  balanceDecimals = 18,
  balanceLabel = "Balance",
  disabled = false,
  error,
  lockToken = false,
}: TokenAmountFieldProps) {
  const handleInput = (raw: string) => {
    // Allow only digits and a single decimal point.
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      onAmountChange(raw);
    }
  };

  const setMax = () => {
    if (balance !== undefined) {
      onAmountChange(formatAmount(balance, balanceDecimals, balanceDecimals).replace(/,/g, ""));
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <label className={styles.label}>{label}</label>
        {balance !== undefined && (
          <button
            type="button"
            className={styles.balance}
            onClick={setMax}
            disabled={disabled}
            title="Use max"
          >
            {balanceLabel}: {formatAmount(balance, balanceDecimals)}{" "}
            <span className={styles.max}>MAX</span>
          </button>
        )}
      </div>

      <div className={`${styles.row} ${error ? styles.rowError : ""}`.trim()}>
        <input
          className={styles.input}
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => handleInput(e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-label={label}
        />
        {lockToken || !onTokenChange ? (
          <span className={styles.tokenStatic}>{TOKEN_LIST.find((t) => t.key === tokenKey)?.symbol}</span>
        ) : (
          <select
            className={styles.select}
            value={tokenKey}
            onChange={(e) => onTokenChange(e.target.value as TokenKey)}
            disabled={disabled}
            aria-label="Token"
          >
            {TOKEN_LIST.map((t) => (
              <option key={t.key} value={t.key}>
                {t.symbol}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
