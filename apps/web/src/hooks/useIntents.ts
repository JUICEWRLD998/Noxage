"use client";

import { useQuery } from "@tanstack/react-query";
import { getAbiItem } from "viem";
import { useAccount, usePublicClient } from "@/lib/wallet";
import { intentBookAbi, type IntentStatus } from "@/lib/abis";
import { addresses, INTENT_BOOK_DEPLOY_BLOCK } from "@/lib/contracts";

const intentSubmittedEvent = getAbiItem({
  abi: intentBookAbi,
  name: "IntentSubmitted",
});

export interface OwnedIntent {
  intentId: bigint;
  epochId: bigint;
  deadline: bigint;
  /** Current on-chain status (Active may have flipped to Cancelled since submit). */
  status: IntentStatus;
}

/**
 * All intents the connected address ever submitted, newest first. Discovered
 * via IntentSubmitted logs (owner-indexed, bounded by the book's deploy block),
 * then re-read through getIntent so the status reflects any later cancel.
 */
export function useIntents() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["noxage", "intents", address],
    enabled: !!address && !!publicClient,
    refetchInterval: 15_000,
    queryFn: async (): Promise<OwnedIntent[]> => {
      if (!address || !publicClient) return [];

      const logs = await publicClient.getLogs({
        address: addresses.intentBook,
        event: intentSubmittedEvent,
        args: { owner: address },
        fromBlock: INTENT_BOOK_DEPLOY_BLOCK,
        toBlock: "latest",
      });

      const intentIds = [
        ...new Set(
          logs
            .map((log) => log.args.intentId)
            .filter((id): id is bigint => typeof id === "bigint"),
        ),
      ];

      // Re-read current state; the log alone can't show cancellations.
      const intents = await Promise.all(
        intentIds.map(async (intentId) => {
          const intent = await publicClient.readContract({
            address: addresses.intentBook,
            abi: intentBookAbi,
            functionName: "getIntent",
            args: [intentId],
          });
          return {
            intentId,
            epochId: intent.epochId,
            deadline: BigInt(intent.deadline),
            status: intent.status as IntentStatus,
          };
        }),
      );

      // Newest first (ids are monotonically increasing).
      return intents.sort((a, b) => (a.intentId > b.intentId ? -1 : 1));
    },
  });

  return {
    intents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
