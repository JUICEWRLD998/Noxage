"use client";

import { useState } from "react";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "@/lib/wallet";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  TxHashLink,
} from "@/components";
import { useObserver } from "@/hooks/useObserver";
import { confidentialTokenAbi } from "@/lib/abis";
import { TOKENS, TOKEN_LIST, type TokenKey } from "@/lib/contracts";
import { decryptHandle, isZeroHandle } from "@/lib/nox";
import { formatAmount, truncateHex } from "@/lib/format";
import styles from "./auditor.module.css";

/** Per-token observer grant/revoke card. */
function GrantCard({ tokenKey }: { tokenKey: TokenKey }) {
  const { address } = useAccount();
  const token = TOKENS[tokenKey];
  const confSymbol = `c${token.symbol}`;
  const obs = useObserver(tokenKey);

  const [input, setInput] = useState("");
  const [confirmGrant, setConfirmGrant] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [pendingAction, setPendingAction] = useState<"grant" | "revoke" | null>(
    null,
  );

  const trimmed = input.trim();
  const inputError = !trimmed
    ? undefined
    : !isAddress(trimmed)
      ? "Enter a valid Ethereum address"
      : address && trimmed.toLowerCase() === address.toLowerCase()
        ? "That's your own address — you can already decrypt this balance."
        : undefined;
  const canGrant = !!trimmed && !inputError && !obs.isPending;

  const doGrant = async () => {
    setConfirmGrant(false);
    if (!trimmed || inputError) return;
    setPendingAction("grant");
    const ok = await obs.setObserver(getAddress(trimmed));
    setPendingAction(null);
    if (ok) setInput("");
  };

  const doRevoke = async () => {
    setConfirmRevoke(false);
    setPendingAction("revoke");
    await obs.setObserver(null);
    setPendingAction(null);
  };

  return (
    <Card>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{confSymbol}</h3>
        {obs.isLoading ? (
          <Skeleton width="110px" height="1.4em" />
        ) : obs.queryError ? (
          <Badge variant="danger">Status unknown</Badge>
        ) : obs.hasObserver ? (
          <Badge variant="accent">Observer active</Badge>
        ) : (
          <Badge variant="default">No observer</Badge>
        )}
      </div>

      <div className={styles.observerRow}>
        <span className={styles.observerLabel}>Current observer</span>
        {obs.isLoading ? (
          <Skeleton width="130px" height="1.2em" />
        ) : obs.queryError ? (
          <span className={styles.errorText} role="alert">
            Couldn’t read observer state — retrying automatically.
          </span>
        ) : obs.hasObserver && obs.observer ? (
          <span className={styles.mono} title={obs.observer}>
            {truncateHex(obs.observer, 8, 6)}
          </span>
        ) : (
          <span className={styles.muted}>None appointed</span>
        )}
      </div>

      <Field
        label={`Observer address for ${confSymbol}`}
        placeholder="0x…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        error={inputError}
        helper={
          !inputError
            ? "They gain standing access to decrypt this balance."
            : undefined
        }
        disabled={obs.isPending}
        fullWidth
        spellCheck={false}
        autoComplete="off"
        className={styles.monoInput}
      />

      <div className={styles.actions}>
        <ConfirmDialog
          open={confirmGrant}
          onOpenChange={setConfirmGrant}
          title="Grant observer access?"
          description={`${trimmed} will be able to decrypt your ${confSymbol} balance going forward.`}
          confirmLabel="Grant access"
          tone="accent"
          onConfirm={() => void doGrant()}
        >
          <Button
            variant="accent"
            disabled={!canGrant}
            loading={obs.isPending && pendingAction === "grant"}
          >
            {obs.isPending && pendingAction === "grant"
              ? "Granting…"
              : "Grant access"}
          </Button>
        </ConfirmDialog>
        {obs.hasObserver && (
          <ConfirmDialog
            open={confirmRevoke}
            onOpenChange={setConfirmRevoke}
            title="Revoke observer access?"
            description={`${obs.observer ?? ""} will no longer be able to decrypt new ${confSymbol} balance handles.`}
            confirmLabel="Revoke"
            tone="danger"
            onConfirm={() => void doRevoke()}
          >
            <Button
              variant="ghost"
              disabled={obs.isPending}
              loading={obs.isPending && pendingAction === "revoke"}
            >
              {obs.isPending && pendingAction === "revoke"
                ? "Revoking…"
                : "Revoke"}
            </Button>
          </ConfirmDialog>
        )}
      </div>

      {obs.lastTx && obs.stage === "done" && (
        <div className={styles.txRow}>
          <TxHashLink hash={obs.lastTx} label="Observer updated" />
        </div>
      )}
      {obs.error && <p className={styles.errorText}>{obs.error}</p>}

    </Card>
  );
}

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "zero"; tokenKey: TokenKey; target: Address }
  | { status: "decrypted"; tokenKey: TokenKey; target: Address; value: bigint }
  | { status: "error"; message: string };

export default function AuditorPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [viewInput, setViewInput] = useState("");
  const [viewTokenKey, setViewTokenKey] = useState<TokenKey>("USDC");
  const [viewState, setViewState] = useState<ViewState>({ status: "idle" });

  const viewTrimmed = viewInput.trim();
  const viewInputError =
    viewTrimmed && !isAddress(viewTrimmed)
      ? "Enter a valid Ethereum address"
      : undefined;
  const viewing = viewState.status === "loading";
  const canView =
    !!viewTrimmed && !viewInputError && !viewing && !!walletClient;

  const runAuditorView = async () => {
    if (!viewTrimmed || viewInputError || !publicClient || !address || !walletClient)
      return;
    const target = getAddress(viewTrimmed);
    const token = TOKENS[viewTokenKey];
    const tokenKey = viewTokenKey;
    setViewState({ status: "loading" });

    let handle: Hex;
    try {
      handle = (await publicClient.readContract({
        address: token.confidential,
        abi: confidentialTokenAbi,
        functionName: "confidentialBalanceOf",
        args: [target],
      })) as Hex;
    } catch {
      setViewState({
        status: "error",
        message:
          "Could not read the balance handle. Check your connection and try again.",
      });
      return;
    }

    if (isZeroHandle(handle)) {
      setViewState({ status: "zero", tokenKey, target });
      return;
    }

    try {
      const value = await decryptHandle(handle, walletClient);
      setViewState({ status: "decrypted", tokenKey, target, value });
    } catch {
      setViewState({
        status: "error",
        message:
          "You are not an authorized observer for this address, or the balance predates your grant.",
      });
    }
  };

  if (!isConnected) {
    return (
      <div>
        <PageHeader
          title="Auditor"
          description="Grant a second address standing access to decrypt your confidential balances."
        />
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet on Sepolia to manage observer grants or decrypt balances as an auditor."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Auditor"
        description="Grant a second address standing access to decrypt your confidential balances. Disclosure is per-token, revocable, and takes effect from your next balance update."
      />

      <div className={styles.grid}>
        <GrantCard tokenKey="USDC" />
        <GrantCard tokenKey="WETH" />
      </div>

      <aside className={styles.caveat} role="note">
        Access begins with your next balance change. Existing balance handles
        predating the grant stay sealed to the observer.
      </aside>

      <section aria-labelledby="auditor-view-title">
        <h2 id="auditor-view-title" className={styles.sectionTitle}>
          Auditor view
        </h2>
        <p className={styles.sectionDesc}>
          If another account appointed your connected wallet as its observer,
          you can decrypt its confidential balance here.
        </p>

        <Card>
          <div
            className={styles.tokenToggle}
            role="group"
            aria-label="Token to view"
          >
            {TOKEN_LIST.map((t) => (
              <Button
                key={t.key}
                variant={viewTokenKey === t.key ? "accent" : "secondary"}
                size="sm"
                aria-pressed={viewTokenKey === t.key}
                disabled={viewing}
                onClick={() => {
                  setViewTokenKey(t.key);
                  setViewState({ status: "idle" });
                }}
              >
                c{t.symbol}
              </Button>
            ))}
          </div>

          <Field
            label="Account to view"
            placeholder="0x…"
            value={viewInput}
            onChange={(e) => setViewInput(e.target.value)}
            error={viewInputError}
            helper={
              !viewInputError
                ? "The account that appointed you as observer."
                : undefined
            }
            disabled={viewing}
            fullWidth
            spellCheck={false}
            autoComplete="off"
            className={styles.monoInput}
          />

          <Button
            variant="accent"
            className={styles.viewAction}
            disabled={!canView}
            loading={viewing}
            onClick={() => void runAuditorView()}
          >
            {viewing ? "Decrypting…" : "View as auditor"}
          </Button>

          {viewState.status === "error" && (
            <p className={styles.errorText} role="alert">
              {viewState.message}
            </p>
          )}

          {viewState.status === "zero" && (
            <div className={styles.result}>
              <span className={styles.mono} title={viewState.target}>
                {truncateHex(viewState.target, 8, 6)}
              </span>
              <span className={styles.muted}>
                No confidential balance for c{TOKENS[viewState.tokenKey].symbol}.
              </span>
            </div>
          )}

          {viewState.status === "decrypted" && (
            <div className={styles.result}>
              <div className={styles.resultMeta}>
                <span className={styles.mono} title={viewState.target}>
                  {truncateHex(viewState.target, 8, 6)}
                </span>
                <Badge variant="success">Decrypted via observer grant</Badge>
              </div>
              <span className={styles.resultValue}>
                {formatAmount(
                  viewState.value,
                  TOKENS[viewState.tokenKey].confidentialDecimals,
                )}{" "}
                c{TOKENS[viewState.tokenKey].symbol}
              </span>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
