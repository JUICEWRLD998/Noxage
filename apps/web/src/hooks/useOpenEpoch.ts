"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "@/lib/wallet";
import { epochManagerAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type OpenStage = "idle" | "opening" | "done" | "error";

/** Operator-only: open a new intent epoch. */
export function useOpenEpoch() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<OpenStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const openEpoch = useCallback(async (): Promise<boolean> => {
    if (!publicClient) return false;
    setError(null);
    setLastTx(null);
    try {
      setStage("opening");
      toast.info("Opening epoch", "Starting a new 60-second intent window.");
      const tx = await writeContractAsync({
        address: addresses.epochManager,
        abi: epochManagerAbi,
        functionName: "openEpoch",
      });
      setLastTx(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStage("done");
      toast.success("Epoch opened", "Users can now seal intents.");
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message.split("\n")[0] : "Open epoch failed";
      setError(message);
      setStage("error");
      toast.error("Open epoch failed", message);
      return false;
    }
  }, [publicClient, writeContractAsync, toast]);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    openEpoch,
    stage,
    isPending: stage === "opening",
    error,
    lastTx,
    reset,
  };
}
