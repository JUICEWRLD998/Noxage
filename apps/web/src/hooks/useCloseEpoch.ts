"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { epochManagerAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type CloseStage = "idle" | "closing" | "done" | "error";

/**
 * Permissionless epoch close: anyone may seal an open epoch once
 * openedAt + epochDuration has elapsed (the owner can close any time). The UI
 * offers this when the countdown hits zero so the batch cadence stays honest
 * even if the operator stalls.
 */
export function useCloseEpoch() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<CloseStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const closeEpoch = useCallback(
    async (epochId: bigint): Promise<boolean> => {
      if (!publicClient || epochId <= 0n) return false;
      setError(null);
      setLastTx(null);
      try {
        setStage("closing");
        toast.info("Closing epoch", `Sealing epoch #${epochId} for settlement.`);
        const tx = await writeContractAsync({
          address: addresses.epochManager,
          abi: epochManagerAbi,
          functionName: "closeEpoch",
          args: [epochId],
        });
        setLastTx(tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("done");
        toast.success(
          "Epoch closed",
          `Epoch #${epochId} is sealed — settlement can begin.`,
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Close failed";
        setError(message);
        setStage("error");
        toast.error("Close failed", message);
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
    closeEpoch,
    stage,
    isPending: stage === "closing",
    error,
    lastTx,
    reset,
  };
}
