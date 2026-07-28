"use client";

import { useCallback, useState } from "react";
import { zeroAddress, type Address, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "@/lib/wallet";
import { confidentialTokenAbi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { useTxToast } from "./useTxToast";

type ObserverStage = "idle" | "setting" | "done" | "error";

/**
 * Selective disclosure for a confidential token: read the connected account's
 * current observer and appoint (or revoke) one. Single tx, no approval.
 *
 * ACL caveat: an observer only gains access to handles created AFTER the
 * appointment — the balance handle refreshes on the account's next transfer
 * (wrap/unwrap/send), so a newly appointed auditor cannot decrypt the current
 * balance until the account moves funds once. Surface this in the auditor UI.
 */
export function useObserver(tokenKey: TokenKey) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const token = TOKENS[tokenKey];

  const [stage, setStage] = useState<ObserverStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const observerQuery = useReadContract({
    address: token.confidential,
    abi: confidentialTokenAbi,
    functionName: "observer",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const currentObserver = observerQuery.data as Address | undefined;
  const hasObserver = !!currentObserver && currentObserver !== zeroAddress;

  const setObserver = useCallback(
    async (newObserver: Address | null): Promise<boolean> => {
      if (!address || !publicClient) return false;
      setError(null);
      setLastTx(null);
      const target = newObserver ?? zeroAddress;
      const revoking = target === zeroAddress;
      try {
        setStage("setting");
        toast.info(
          revoking ? "Revoking observer" : "Appointing observer",
          revoking
            ? `Removing view access on your ${token.symbol} balance.`
            : `Granting view access to future ${token.symbol} handles.`,
        );
        const tx = await writeContractAsync({
          address: token.confidential,
          abi: confidentialTokenAbi,
          functionName: "setObserver",
          args: [address, target],
        });
        setLastTx(tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("done");
        toast.success(
          revoking ? "Observer revoked" : "Observer appointed",
          revoking
            ? "No one else can view your confidential balance."
            : "They can decrypt handles created from your next transfer onward.",
        );
        void observerQuery.refetch();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message.split("\n")[0] : "Observer update failed";
        setError(message);
        setStage("error");
        toast.error("Observer update failed", message);
        return false;
      }
    },
    [address, publicClient, writeContractAsync, token, toast, observerQuery],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    observer: currentObserver,
    hasObserver,
    setObserver,
    stage,
    isPending: stage === "setting",
    error,
    lastTx,
    reset,
    isLoading: observerQuery.isLoading,
    queryError: observerQuery.error,
    refetch: observerQuery.refetch,
  };
}
