"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  TokenAmountField,
  TxHashLink,
} from "@/components";
import { useConfidentialBalance, usePublicBalance } from "@/hooks/useBalances";
import { useShield } from "@/hooks/useShield";
import { useUnshield } from "@/hooks/useUnshield";
import { useTxToast } from "@/hooks/useTxToast";
import { mockErc20Abi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { formatAmount, parseAmount } from "@/lib/format";
import styles from "./shield.module.css";

export default function ShieldPage() {
  const { address, isConnected } = useAccount();
  const [tokenKey, setTokenKey] = useState<TokenKey>("USDC");
  const [amount, setAmount] = useState("");

  const token = TOKENS[tokenKey];
  const pub = usePublicBalance(tokenKey);
  const conf = useConfidentialBalance(tokenKey);
  const shield = useShield(tokenKey);
  const unshield = useUnshield(tokenKey);
  const toast = useTxToast();

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [faucetPending, setFaucetPending] = useState(false);

  const parsedAmount = parseAmount(amount, token.decimals);
  const insufficient =
    parsedAmount !== null &&
    pub.balance !== undefined &&
    parsedAmount > pub.balance;
  const amountError =
    amount && parsedAmount === null
      ? "Enter a valid amount"
      : insufficient
        ? "Exceeds balance"
        : undefined;

  if (!isConnected) {
    return (
      <div>
        <PageHeader title="Shield" description="Wrap public tokens into a confidential balance." />
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet on Sepolia to view balances and shield tokens."
        />
      </div>
    );
  }

  const runFaucet = async () => {
    if (!publicClient) return;
    setFaucetPending(true);
    try {
      toast.info("Faucet requested", `Minting test ${token.symbol}.`);
      const tx = await writeContractAsync({
        address: token.mock,
        abi: mockErc20Abi,
        functionName: "faucet",
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      toast.success("Faucet complete", `Test ${token.symbol} minted.`);
      void pub.refetch();
    } catch (err) {
      toast.error(
        "Faucet failed",
        err instanceof Error ? err.message.split("\n")[0] : undefined,
      );
    } finally {
      setFaucetPending(false);
    }
  };

  const doShield = async () => {
    if (parsedAmount === null || parsedAmount <= 0n || insufficient) return;
    const ok = await shield.shield(parsedAmount);
    if (ok) {
      setAmount("");
      void pub.refetch();
      void conf.refetch();
      conf.reset();
    }
  };

  const doUnshield = async () => {
    const ok = await unshield.unshield(conf.handle);
    if (ok) {
      conf.reset();
      void conf.refetch();
    }
  };

  return (
    <div>
      <PageHeader
        title="Shield"
        description="Wrap a public ERC-20 into a confidential balance, or unwrap back to public."
      />

      <div className={styles.grid}>
        {/* Balances */}
        <Card>
          <h3 className={styles.cardTitle}>Balances</h3>

          <div className={styles.balanceRow}>
            <div className={styles.balanceMeta}>
              <Badge variant="public">Public</Badge>
              <span className={styles.balanceToken}>{token.symbol}</span>
            </div>
            <div className={styles.balanceValue}>
              {pub.isLoading ? (
                <Skeleton width="90px" height="1.2em" />
              ) : (
                formatAmount(pub.balance ?? 0n, token.decimals)
              )}
            </div>
          </div>

          <div className={styles.balanceRow}>
            <div className={styles.balanceMeta}>
              <Badge variant="private">Sealed</Badge>
              <span className={styles.balanceToken}>c{token.symbol}</span>
            </div>
            <div className={styles.balanceValue}>
              {conf.isLoading ? (
                <Skeleton width="90px" height="1.2em" />
              ) : conf.clear !== null ? (
                formatAmount(conf.clear, conf.decimals)
              ) : conf.hasBalance ? (
                <button
                  className={styles.decryptBtn}
                  onClick={() => void conf.decrypt()}
                  disabled={conf.decrypting}
                >
                  {conf.decrypting ? "Decrypting…" : "●●●● Decrypt"}
                </button>
              ) : (
                <span className={styles.muted}>0</span>
              )}
            </div>
          </div>

          {conf.decryptError && (
            <p className={styles.errorText}>{conf.decryptError}</p>
          )}

          <div className={styles.faucet}>
            <span className={styles.muted}>Need test tokens?</span>
            <Button
              variant="ghost"
              size="sm"
              loading={faucetPending}
              onClick={runFaucet}
            >
              Faucet {token.symbol}
            </Button>
          </div>
        </Card>

        {/* Shield / Unshield */}
        <Card>
          <h3 className={styles.cardTitle}>Shield</h3>
          <TokenAmountField
            label="Amount to shield"
            amount={amount}
            onAmountChange={setAmount}
            tokenKey={tokenKey}
            onTokenChange={(k) => {
              setTokenKey(k);
              setAmount("");
              conf.reset();
            }}
            balance={pub.balance}
            balanceDecimals={token.decimals}
            balanceLabel={`Public ${token.symbol}`}
            error={amountError}
            disabled={shield.isPending}
          />

          <Button
            variant="accent"
            size="lg"
            className={styles.action}
            loading={shield.isPending}
            disabled={parsedAmount === null || parsedAmount <= 0n || !!amountError}
            onClick={doShield}
          >
            {shield.stage === "approving"
              ? "Approving…"
              : shield.stage === "wrapping"
                ? "Shielding…"
                : "Shield"}
          </Button>

          {shield.lastTx && shield.stage === "done" && (
            <div className={styles.txRow}>
              <TxHashLink hash={shield.lastTx} label="Shielded" />
            </div>
          )}

          <div className={styles.divider} />

          <div className={styles.unshieldRow}>
            <div>
              <p className={styles.unshieldTitle}>Unshield</p>
              <p className={styles.muted}>
                Unwrap your full confidential balance back to public {token.symbol}.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={unshield.isPending}
              disabled={!conf.hasBalance}
              onClick={doUnshield}
            >
              Unshield
            </Button>
          </div>

          {unshield.stage === "pending-decrypt" && (
            <p className={styles.note}>
              Unwrap submitted. Decryption runs off-chain via the Zama KMS; your
              public balance updates once it finalizes.
              {unshield.lastTx && (
                <>
                  {" "}
                  <TxHashLink hash={unshield.lastTx} label="Tx" />
                </>
              )}
            </p>
          )}
          {unshield.error && <p className={styles.errorText}>{unshield.error}</p>}
        </Card>
      </div>

      <p className={styles.privacyNote}>
        Confidential balances are stored as encrypted <code>euint64</code>{" "}
        handles. Decryption never happens silently — it requires your wallet
        signature. Confidential units use 6 decimals (the wrapper cap).
      </p>
    </div>
  );
}
