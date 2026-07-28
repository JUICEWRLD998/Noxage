"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "@/lib/wallet";
import { settlementEngineAbi, SettlementStatus } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { publicDecryptHandles } from "@/lib/fhe";
import { getConnectorProvider } from "@/lib/wallet-provider";
import { useTxToast } from "./useTxToast";

type FinalizeStage = "idle" | "decrypting" | "finalizing" | "done" | "error";

/** MVP clearing price: 2000 mUSDC per 1 mWETH (6-decimal confidential units). */
const DEFAULT_PRICE_NUM = 2000n;
const DEFAULT_PRICE_DEN = 1n;

/**
 * Operator-only: KMS public-decrypt the prepared residual handles, then
 * finalize settlement on-chain (residual swap + encrypted fill credits).
 */
export function useFinalizeSettlement() {
  const { connector } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<FinalizeStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const finalize = useCallback(
    async (epochId: bigint): Promise<boolean> => {
      if (!publicClient || epochId <= 0n) return false;
      setError(null);
      setLastTx(null);
      try {
        const status = await publicClient.readContract({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "settlementStatus",
          args: [epochId],
        });
        if (Number(status) !== SettlementStatus.Prepared) {
          throw new Error("Settlement is not in Prepared state");
        }

        const settlement = await publicClient.readContract({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "getSettlement",
          args: [epochId],
        });

        setStage("decrypting");
        toast.info(
          "Decrypting residual",
          "Requesting KMS public decrypt for aggregate handles.",
        );
        const provider = await getConnectorProvider(connector);
        const { clearValues, decryptionProof } = await publicDecryptHandles(
          [settlement.residualHandle, settlement.dirHandle],
          provider,
        );

        const residualBase = clearValues[settlement.residualHandle];
        const dir = clearValues[settlement.dirHandle];
        const buyHeavy = dir === 1n;

        setStage("finalizing");
        toast.info(
          "Finalizing settlement",
          `Settling epoch #${epochId} on-chain.`,
        );
        const tx = await writeContractAsync({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "finalizeSettlement",
          args: [
            epochId,
            residualBase,
            buyHeavy,
            DEFAULT_PRICE_NUM,
            DEFAULT_PRICE_DEN,
            0n,
            decryptionProof,
          ],
        });
        setLastTx(tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("done");
        toast.success(
          "Settlement finalized",
          residualBase === 0n
            ? "Perfect net — no public residual swap."
            : "Epoch settled — check fills to decrypt.",
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Finalize failed";
        setError(message);
        setStage("error");
        toast.error("Finalize failed", message);
        return false;
      }
    },
    [publicClient, connector, writeContractAsync, toast],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    finalize,
    stage,
    isPending: stage === "decrypting" || stage === "finalizing",
    error,
    lastTx,
    reset,
  };
}
