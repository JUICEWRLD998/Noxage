"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SealedIntentCard,
  Skeleton,
  TokenAmountField,
} from "@/components";
import { useEpochStatus } from "@/hooks/useEpochStatus";
import { useSubmitIntent } from "@/hooks/useSubmitIntent";
import { MVP_PAIR_LABEL, TOKENS } from "@/lib/contracts";
import { parseAmount } from "@/lib/format";
import styles from "./intent.module.css";

// Intent amounts are in confidential (6-decimal) base units. Base = mWETH.
const CONF_DECIMALS = TOKENS.WETH.confidentialDecimals;

type Side = 0 | 1;

export default function IntentPage() {
  const { isConnected } = useAccount();
  const epoch = useEpochStatus();
  const submit = useSubmitIntent();

  const [side, setSide] = useState<Side>(1);
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");

  const parsedAmount = parseAmount(amount, CONF_DECIMALS);
  const parsedLimit = limit ? parseAmount(limit, CONF_DECIMALS) : 0n;
  const amountError =
    amount && (parsedAmount === null || parsedAmount <= 0n)
      ? "Enter a valid amount"
      : undefined;
  const limitError =
    limit && parsedLimit === null ? "Enter a valid limit" : undefined;

  if (!isConnected) {
    return (
      <div>
        <PageHeader title="Submit intent" description="Seal an encrypted intent into the open epoch." />
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet on Sepolia to create an intent."
        />
      </div>
    );
  }

  const canSubmit =
    epoch.hasOpenEpoch &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    parsedLimit !== null &&
    !submit.isPending;

  const doSubmit = async () => {
    if (!canSubmit || parsedAmount === null || parsedLimit === null) return;
    // Public deadline: 1 hour out (well past the ~60s epoch window).
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const result = await submit.submit({
      side,
      amount: parsedAmount,
      limit: parsedLimit,
      deadline,
    });
    if (result) {
      setAmount("");
      setLimit("");
    }
  };

  return (
    <div>
      <PageHeader
        title="Submit intent"
        description="Encrypt size, direction, and limit locally, then seal them into the open epoch."
      />

      <div className={styles.grid}>
        <Card>
          {/* Epoch gate */}
          {epoch.isLoading ? (
            <Skeleton width="100%" height="1.4em" />
          ) : epoch.hasOpenEpoch ? (
            <div className={styles.epochRow}>
              <Badge variant="accent">Epoch #{epoch.activeEpochId?.toString()} open</Badge>
              <span className={styles.epochMeta}>
                {epoch.intentCount} sealed
              </span>
            </div>
          ) : (
            <div className={styles.gate}>
              <Badge variant="warning">No open epoch</Badge>
              <p className={styles.gateText}>
                Intents can only be sealed while an epoch is open. Wait for the
                next epoch to open, then submit.
              </p>
            </div>
          )}

          <fieldset
            className={styles.form}
            disabled={!epoch.hasOpenEpoch || submit.isPending}
          >
            <legend className={styles.srOnly}>Intent details</legend>

            <div className={styles.field}>
              <span className={styles.label}>Pair</span>
              <div className={styles.pair}>
                {MVP_PAIR_LABEL}
                <Badge variant="public">Public</Badge>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Side</span>
              <div className={styles.sideToggle} role="group" aria-label="Side">
                <button
                  type="button"
                  className={`${styles.sideBtn} ${side === 1 ? styles.sideActive : ""}`.trim()}
                  onClick={() => setSide(1)}
                  aria-pressed={side === 1}
                >
                  Buy mWETH
                </button>
                <button
                  type="button"
                  className={`${styles.sideBtn} ${side === 0 ? styles.sideActive : ""}`.trim()}
                  onClick={() => setSide(0)}
                  aria-pressed={side === 0}
                >
                  Sell mWETH
                </button>
              </div>
            </div>

            <TokenAmountField
              label="Amount (sealed)"
              amount={amount}
              onAmountChange={setAmount}
              tokenKey="WETH"
              lockToken
              error={amountError}
            />

            <TokenAmountField
              label="Limit price — optional (sealed)"
              amount={limit}
              onAmountChange={setLimit}
              tokenKey="USDC"
              lockToken
              error={limitError}
            />
          </fieldset>

          <Button
            variant="accent"
            size="lg"
            className={styles.action}
            loading={submit.isPending}
            disabled={!canSubmit}
            onClick={doSubmit}
          >
            {submit.stage === "encrypting"
              ? "Encrypting…"
              : submit.stage === "submitting"
                ? "Submitting…"
                : submit.stage === "confirming"
                  ? "Confirming…"
                  : "Seal intent"}
          </Button>

          {submit.error && <p className={styles.errorText}>{submit.error}</p>}
        </Card>

        <div>
          {submit.sealed ? (
            <SealedIntentCard intent={submit.sealed} />
          ) : (
            <Card>
              <h3 className={styles.previewTitle}>What stays private</h3>
              <p className={styles.previewBody}>
                Your <strong>amount</strong>, <strong>direction</strong>, and{" "}
                <strong>limit</strong> are encrypted in your browser and submitted
                as ciphertext handles. Only the token pair and deadline are public.
              </p>
              <p className={styles.previewBody}>
                A sealed-intent receipt appears here after you submit.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
