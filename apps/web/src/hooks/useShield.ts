"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { confidentialTokenAbi, mockErc20Abi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type ShieldStage = "idle" | "approving" | "wrapping" | "done" | "error";

/**
 * Shield: approve the underlying public ERC-20, then wrap it into a confidential
 * balance. Two sequential txs; both must confirm on Sepolia.
 */
export function useShield(tokenKey: TokenKey) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<ShieldStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const token = TOKENS[tokenKey];

  const shield = useCallback(
    async (amount: bigint): Promise<boolean> => {
      if (!address || !publicClient || amount <= 0n) return false;
      setError(null);
      setLastTx(null);
      try {
        // 1. Approve the confidential wrapper to pull the underlying.
        setStage("approving");
        toast.info("Approve requested", `Allow the wrapper to move your ${token.symbol}.`);
        const approveTx = await writeContractAsync({
          address: token.mock,
          abi: mockErc20Abi,
          functionName: "approve",
          args: [token.confidential, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });

        // 2. Wrap (shield) into a confidential balance credited to the user.
        setStage("wrapping");
        toast.info("Shielding", "Wrapping into a confidential balance.");
        const wrapTx = await writeContractAsync({
          address: token.confidential,
          abi: confidentialTokenAbi,
          functionName: "wrap",
          args: [address, amount],
        });
        setLastTx(wrapTx);
        await publicClient.waitForTransactionReceipt({ hash: wrapTx });

        setStage("done");
        toast.success("Shielded", `Your ${token.symbol} is now a confidential balance.`);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Shield failed";
        setError(message);
        setStage("error");
        toast.error("Shield failed", message);
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
    shield,
    stage,
    isPending: stage === "approving" || stage === "wrapping",
    error,
    lastTx,
    reset,
  };
}
