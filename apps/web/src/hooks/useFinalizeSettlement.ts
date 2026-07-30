"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import {
  usePublicClient,
  useWalletClient,
  useWriteContract,
} from "@/lib/wallet";
import { settlementEngineAbi, SettlementStatus } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { publicDecryptHandles } from "@/lib/nox";
import { useTxToast } from "./useTxToast";

type FinalizeStage = "idle" | "decrypting" | "finalizing" | "done" | "error";

/**
 * MVP clearing price in raw token units: 2,000 mUSDC (6 decimals) per
 * 1 mWETH (18 decimals), simplified to 1 / 500,000,000.
 */
const DEFAULT_PRICE_NUM = 1n;
const DEFAULT_PRICE_DEN = 500_000_000n;

/**
 * Operator-only: Nox public-decrypt the prepared residual handles, then
 * finalize settlement on-chain (residual swap + encrypted fill credits).
 */
export function useFinalizeSettlement() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<FinalizeStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const finalize = useCallback(
    async (epochId: bigint): Promise<boolean> => {
      if (!publicClient || !walletClient || epochId <= 0n) return false;
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
          "Requesting Nox public decrypt for aggregate handles.",
        );
        const { clearValues, decryptionProofs } = await publicDecryptHandles(
          [
            {
              handle: settlement.residualHandle,
              solidityType: "uint256",
            },
            { handle: settlement.dirHandle, solidityType: "bool" },
          ],
          walletClient,
        );

        const residualBase = clearValues[settlement.residualHandle];
        const buyHeavy = clearValues[settlement.dirHandle];
        if (typeof residualBase !== "bigint" || typeof buyHeavy !== "boolean") {
          throw new Error("Nox returned unexpected settlement value types");
        }

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
            DEFAULT_PRICE_NUM,
            DEFAULT_PRICE_DEN,
            0n,
            decryptionProofs[settlement.residualHandle],
            decryptionProofs[settlement.dirHandle],
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
    [publicClient, walletClient, writeContractAsync, toast],
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
