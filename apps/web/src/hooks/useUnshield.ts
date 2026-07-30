"use client";

import { useCallback, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useWriteContract,
} from "@/lib/wallet";
import { confidentialTokenAbi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { isZeroHandle, publicDecryptHandles } from "@/lib/nox";
import { useTxToast } from "./useTxToast";

type UnshieldStage =
  | "idle"
  | "submitting"
  | "pending-decrypt"
  | "finalizing"
  | "done"
  | "error";

/**
 * Unshield: submit an unwrap of the entire confidential balance handle. This
 * only *requests* the unwrap. The Nox gateway returns a public-decryption proof
 * that can finalize the request and release the public ERC-20.
 */
export function useUnshield(tokenKey: TokenKey) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useTxToast();

  const [stage, setStage] = useState<UnshieldStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  const token = TOKENS[tokenKey];

  const unshield = useCallback(
    async (balanceHandle: Hex | undefined): Promise<boolean> => {
      if (!address || !publicClient || !walletClient) return false;
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
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

        setStage("pending-decrypt");
        let requestHandle: Hex | undefined;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== token.confidential.toLowerCase()) {
            continue;
          }
          try {
            const parsed = decodeEventLog({
              abi: confidentialTokenAbi,
              data: log.data,
              topics: log.topics,
            });
            if (parsed.eventName === "UnwrapRequested") {
              requestHandle = parsed.args.amount as Hex;
              break;
            }
          } catch {
            // Ignore events emitted by the underlying token or Nox protocol.
          }
        }
        if (!requestHandle) {
          throw new Error("Unwrap request handle was not emitted");
        }

        toast.info(
          "Decrypting unwrap",
          "Requesting a Nox public-decryption proof.",
        );

        const { clearValues, decryptionProofs } = await publicDecryptHandles(
          [{ handle: requestHandle, solidityType: "uint256" }],
          walletClient,
        );
        if (typeof clearValues[requestHandle] !== "bigint") {
          throw new Error("Nox returned an unexpected unwrap amount type");
        }

        setStage("finalizing");
        const finalizeTx = await writeContractAsync({
          address: token.confidential,
          abi: confidentialTokenAbi,
          functionName: "finalizeUnwrap",
          args: [requestHandle, decryptionProofs[requestHandle]],
        });
        setLastTx(finalizeTx);
        await publicClient.waitForTransactionReceipt({ hash: finalizeTx });

        setStage("done");
        toast.success("Unshielded", "Your public token balance has been released.");
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
    [address, publicClient, walletClient, writeContractAsync, token, toast],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setLastTx(null);
  }, []);

  return {
    unshield,
    stage,
    isPending:
      stage === "submitting" ||
      stage === "pending-decrypt" ||
      stage === "finalizing",
    error,
    lastTx,
    reset,
  };
}
