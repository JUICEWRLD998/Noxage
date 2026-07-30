"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "@/lib/wallet";
import {
  IntentStatus,
  intentBookAbi,
  settlementEngineAbi,
} from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type PrepareStage = "idle" | "preparing" | "done" | "error";

/**
 * Permissionless confidential netting step: anyone may call prepareSettlement
 * once an epoch is closed. It reveals only aggregate residual handles for Nox
 * public decryption; finalize still requires the engine owner.
 */
export function usePrepareSettlement() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<PrepareStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const prepare = useCallback(
    async (epochId: bigint): Promise<boolean> => {
      if (!publicClient || epochId <= 0n) return false;
      setError(null);
      setLastTx(null);
      try {
        setStage("preparing");
        const intentIds = await publicClient.readContract({
          address: addresses.intentBook,
          abi: intentBookAbi,
          functionName: "epochIntentIds",
          args: [epochId],
        });
        const intents = await Promise.all(
          intentIds.map((intentId) =>
            publicClient.readContract({
              address: addresses.intentBook,
              abi: intentBookAbi,
              functionName: "getIntent",
              args: [intentId],
            }),
          ),
        );
        const hasActiveIntent = intents.some(
          (intent) => intent.status === IntentStatus.Active,
        );
        if (!hasActiveIntent) {
          throw new Error(
            `Epoch #${epochId} has no active intents to net. Open a new epoch and seal at least one intent before closing it.`,
          );
        }

        toast.info(
          "Preparing settlement",
          `Netting epoch #${epochId} over encrypted intents.`,
        );
        const tx = await writeContractAsync({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "prepareSettlement",
          args: [epochId],
        });
        setLastTx(tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("done");
        toast.success(
          "Settlement prepared",
          "Aggregate residual revealed — awaiting operator finalize.",
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Prepare failed";
        setError(message);
        setStage("error");
        toast.error("Prepare failed", message);
        return false;
      }
    },
    [publicClient, writeContractAsync, toast],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    prepare,
    stage,
    isPending: stage === "preparing",
    error,
    lastTx,
    reset,
  };
}
