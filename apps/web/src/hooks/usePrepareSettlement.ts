"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useWriteContract } from "@/lib/wallet";
import { settlementEngineAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type PrepareStage = "idle" | "preparing" | "done" | "error";

/**
 * Permissionless homomorphic netting step: anyone may call prepareSettlement
 * once an epoch is closed. Reveals only aggregate residual handles for KMS
 * decrypt; finalize still requires the engine owner.
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
