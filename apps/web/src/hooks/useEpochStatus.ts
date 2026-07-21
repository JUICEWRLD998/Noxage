"use client";

import { useReadContract } from "wagmi";
import { epochManagerAbi, EpochStatus } from "@/lib/abis";
import { addresses } from "@/lib/contracts";

/**
 * Read the active epoch and its status. Polled so the intent form can gate
 * itself honestly (submission requires an open epoch). Intent submission is only
 * possible when activeEpochId != 0.
 */
export function useEpochStatus() {
  const activeQuery = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "activeEpochId",
    query: { refetchInterval: 8_000 },
  });

  const activeEpochId = activeQuery.data as bigint | undefined;
  const hasOpenEpoch = !!activeEpochId && activeEpochId > 0n;

  const epochQuery = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "getEpoch",
    args: hasOpenEpoch ? [activeEpochId] : undefined,
    query: { enabled: hasOpenEpoch, refetchInterval: 8_000 },
  });

  const durationQuery = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "epochDuration",
  });

  const epoch = epochQuery.data as
    | {
        status: number;
        openedAt: bigint;
        closedAt: bigint;
        intentCount: number;
        settlementRef: `0x${string}`;
      }
    | undefined;

  const duration = durationQuery.data as bigint | undefined;

  return {
    activeEpochId,
    hasOpenEpoch,
    status: (epoch?.status ?? EpochStatus.None) as EpochStatus,
    openedAt: epoch?.openedAt,
    intentCount: epoch?.intentCount ?? 0,
    duration,
    isLoading: activeQuery.isLoading,
    error: activeQuery.error,
    refetch: () => {
      void activeQuery.refetch();
      void epochQuery.refetch();
    },
  };
}
