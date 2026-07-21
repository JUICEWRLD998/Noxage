"use client";

import { useCallback, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { intentBookAbi } from "@/lib/abis";
import { addresses, MVP_PAIR_ID } from "@/lib/contracts";
import { encryptIntent } from "@/lib/fhe";
import { useTxToast } from "./useTxToast";

type IntentStage =
  | "idle"
  | "encrypting"
  | "submitting"
  | "confirming"
  | "done"
  | "error";

export interface SubmitIntentInput {
  /** 0 = sell base, 1 = buy base. */
  side: number;
  /** Size in confidential (6-decimal) base units. */
  amount: bigint;
  /** Optional limit price (6-decimal); 0 = no limit. */
  limit: bigint;
  /** Public unix deadline. */
  deadline: bigint;
}

export interface SealedIntent {
  intentId: bigint;
  epochId: bigint;
  side: number;
  deadline: bigint;
  txHash: Hex;
}

export function useSubmitIntent() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<IntentStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState<SealedIntent | null>(null);

  const submit = useCallback(
    async (input: SubmitIntentInput): Promise<SealedIntent | null> => {
      if (!address || !publicClient) return null;
      setError(null);
      setSealed(null);
      try {
        // 1. Encrypt (side, amount, limit) client-side, bound to book + user.
        setStage("encrypting");
        toast.info("Sealing intent", "Encrypting size and direction locally.");
        const enc = await encryptIntent(addresses.intentBook, address, {
          side: input.side,
          amount: input.amount,
          limit: input.limit,
        });

        // 2. Submit the encrypted handles + proof. Pair & deadline are public.
        setStage("submitting");
        const tx = await writeContractAsync({
          address: addresses.intentBook,
          abi: intentBookAbi,
          functionName: "submitIntent",
          args: [
            MVP_PAIR_ID,
            input.deadline,
            enc.sideExt,
            enc.amountExt,
            enc.limitExt,
            enc.inputProof,
          ],
        });

        setStage("confirming");
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        // Recover intentId / epochId from the IntentSubmitted event.
        let intentId = 0n;
        let epochId = 0n;
        for (const log of receipt.logs) {
          try {
            const parsed = decodeEventLog({
              abi: intentBookAbi,
              data: log.data,
              topics: log.topics,
            });
            if (parsed.eventName === "IntentSubmitted") {
              intentId = parsed.args.intentId as bigint;
              epochId = parsed.args.epochId as bigint;
              break;
            }
          } catch {
            // Not our event; skip.
          }
        }

        const result: SealedIntent = {
          intentId,
          epochId,
          side: input.side,
          deadline: input.deadline,
          txHash: tx,
        };
        setSealed(result);
        setStage("done");
        toast.success("Intent sealed", "Your encrypted intent joined the open epoch.");
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Submit failed";
        setError(message);
        setStage("error");
        toast.error("Intent failed", message);
        return null;
      }
    },
    [address, publicClient, writeContractAsync, toast],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setSealed(null);
  }, []);

  return {
    submit,
    stage,
    isPending:
      stage === "encrypting" || stage === "submitting" || stage === "confirming",
    error,
    sealed,
    reset,
  };
}
