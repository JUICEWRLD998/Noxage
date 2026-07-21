"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { confidentialTokenAbi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { isZeroHandle } from "@/lib/fhe";
import { useTxToast } from "./useTxToast";

type UnshieldStage = "idle" | "submitting" | "pending-decrypt" | "error";

/**
 * Unshield: submit an unwrap of the entire confidential balance handle. This
 * only *requests* the unwrap — the Zama KMS decrypts off-chain and an oracle
 * calls finalizeUnwrap, at which point the public ERC-20 arrives. So we confirm
 * the request tx, then tell the user the underlying settles asynchronously.
 */
export function useUnshield(tokenKey: TokenKey) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<UnshieldStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const token = TOKENS[tokenKey];

  const unshield = useCallback(
    async (balanceHandle: Hex | undefined): Promise<boolean> => {
      if (!address || !publicClient) return false;
      if (isZeroHandle(balanceHandle) || !balanceHandle) {
        setError("No confidential balance to unshield.");
        setStage("error");
        return false;
      }
      setError(null);
      setLastTx(null);
      try {
        setStage("submitting");
        toast.info("Unshield requested", "Submitting the unwrap request.");
        const tx = await writeContractAsync({
          address: token.confidential,
          abi: confidentialTokenAbi,
          functionName: "unwrap",
          args: [address, address, balanceHandle],
        });
        setLastTx(tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("pending-decrypt");
        toast.success(
          "Unwrap submitted",
          "Decryption runs off-chain; your public balance updates once the KMS finalizes.",
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Unshield failed";
        setError(message);
        setStage("error");
        toast.error("Unshield failed", message);
        return false;
      }
    },
    [address, publicClient, writeContractAsync, token, toast],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    unshield,
    stage,
    isPending: stage === "submitting",
    error,
    lastTx,
    reset,
  };
}
