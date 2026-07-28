"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAbiItem, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "@/lib/wallet";
import { fillLedgerAbi } from "@/lib/abis";
import { addresses, INTENT_BOOK_DEPLOY_BLOCK } from "@/lib/contracts";
import { decryptHandles } from "@/lib/fhe";
import {
  getHistoricalLogRanges,
  historicalLogsClient,
} from "@/lib/logs";
import { getConnectorProvider } from "@/lib/wallet-provider";
import { useTxToast } from "./useTxToast";

const fillCreditedEvent = getAbiItem({
  abi: fillLedgerAbi,
  name: "FillCredited",
});

export interface FillLeg {
  recvBase: bigint;
  recvQuote: bigint;
  payBase: bigint;
  payQuote: bigint;
}

export interface OwnedFill {
  intentId: bigint;
  epochId: bigint;
  /** Encrypted euint64 leg handles; decrypt via decryptFill (ACL: intent owner). */
  handles: {
    recvBase: Hex;
    recvQuote: Hex;
    payBase: Hex;
    payQuote: Hex;
  };
}

type DecryptStage = "idle" | "decrypting" | "done" | "error";

/**
 * Fills credited to the connected address, discovered via owner-indexed
 * FillCredited logs (the ledger deployed alongside the intent book, so the same
 * deploy block bounds the scan). Handles are always readable ciphertext;
 * decryptFill(intentId) prompts one EIP-712 signature, decrypts all four legs
 * against the ledger, and caches the cleartext per intent so the UI never
 * re-asks for a signature it already has.
 */
export function useFills() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const toast = useTxToast();

  const [decrypted, setDecrypted] = useState<Record<string, FillLeg>>({});
  const [stage, setStage] = useState<DecryptStage>("idle");
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["noxage", "fills", address],
    enabled: !!address && !!publicClient,
    refetchInterval: 15_000,
    queryFn: async (): Promise<OwnedFill[]> => {
      if (!address || !publicClient) return [];

      const ranges = await getHistoricalLogRanges(INTENT_BOOK_DEPLOY_BLOCK);
      const logs = (
        await Promise.all(
          ranges.map((range) =>
            historicalLogsClient.getLogs({
              address: addresses.fillLedger,
              event: fillCreditedEvent,
              args: { owner: address },
              ...range,
            }),
          ),
        )
      ).flat();

      const seen = new Set<bigint>();
      const entries: { intentId: bigint; epochId: bigint }[] = [];
      for (const log of logs) {
        const { intentId, epochId } = log.args;
        if (typeof intentId !== "bigint" || typeof epochId !== "bigint") continue;
        if (seen.has(intentId)) continue; // creditFill is once-per-intent anyway
        seen.add(intentId);
        entries.push({ intentId, epochId });
      }

      const fills = await Promise.all(
        entries.map(async ({ intentId, epochId }) => {
          const [recvBase, recvQuote, payBase, payQuote] =
            await publicClient.readContract({
              address: addresses.fillLedger,
              abi: fillLedgerAbi,
              functionName: "fillHandles",
              args: [intentId],
            });
          return {
            intentId,
            epochId,
            handles: { recvBase, recvQuote, payBase, payQuote },
          };
        }),
      );

      // Newest first.
      return fills.sort((a, b) => (a.intentId > b.intentId ? -1 : 1));
    },
  });

  const queryData = query.data;
  const fills = useMemo(() => queryData ?? [], [queryData]);

  const decryptFill = useCallback(
    async (intentId: bigint): Promise<FillLeg | null> => {
      const cached = decrypted[intentId.toString()];
      if (cached) return cached;

      const fill = fills.find((f) => f.intentId === intentId);
      if (!address || !walletClient || !fill) return null;

      setStage("decrypting");
      setDecryptError(null);
      try {
        toast.info("Decrypting fill", "Sign once to reveal your fill legs.");
        const { handles } = fill;
        const provider = await getConnectorProvider(connector);
        const results = await decryptHandles(
          [
            { handle: handles.recvBase, contractAddress: addresses.fillLedger },
            { handle: handles.recvQuote, contractAddress: addresses.fillLedger },
            { handle: handles.payBase, contractAddress: addresses.fillLedger },
            { handle: handles.payQuote, contractAddress: addresses.fillLedger },
          ],
          address,
          walletClient,
          provider,
        );
        const legs: FillLeg = {
          recvBase: results[handles.recvBase],
          recvQuote: results[handles.recvQuote],
          payBase: results[handles.payBase],
          payQuote: results[handles.payQuote],
        };
        setDecrypted((prev) => ({ ...prev, [intentId.toString()]: legs }));
        setStage("done");
        toast.success("Fill revealed", "Decrypted locally — only you can see this.");
        return legs;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Decryption failed";
        setDecryptError(message);
        setStage("error");
        toast.error("Decryption failed", message);
        return null;
      }
    },
    [address, connector, walletClient, fills, decrypted, toast],
  );

  return {
    fills,
    /** Cleartext legs keyed by intentId.toString(), for fills already decrypted. */
    decrypted,
    decryptFill,
    stage,
    isDecrypting: stage === "decrypting",
    decryptError,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
