"use client";

import { useQuery } from "@tanstack/react-query";
import { getAbiItem, type Hex } from "viem";
import { usePublicClient } from "@/lib/wallet";
import { settlementEngineAbi, SettlementStatus } from "@/lib/abis";
import { addresses, INTENT_BOOK_DEPLOY_BLOCK } from "@/lib/contracts";

const residualSwappedEvent = getAbiItem({
  abi: settlementEngineAbi,
  name: "ResidualSwapped",
});
const settlementFinalizedEvent = getAbiItem({
  abi: settlementEngineAbi,
  name: "SettlementFinalized",
});
const settlementFailedEvent = getAbiItem({
  abi: settlementEngineAbi,
  name: "SettlementFailedEvent",
});

export interface ResidualSwap {
  amountIn: bigint;
  amountOut: bigint;
  buyHeavy: boolean;
  /** Tx hash of the residual swap, for the Etherscan link. */
  txHash: Hex;
}

interface SettlementData {
  status: SettlementStatus;
  residualHandle: Hex;
  dirHandle: Hex;
  residualSwap: ResidualSwap | null;
  finalizedTxHash: Hex | null;
  failed: boolean;
}

/**
 * Settlement progress for one epoch: on-chain status, the public residual swap
 * (the only value Noxage ever reveals), and the finalize/fail tx. Polls every
 * 10s while the settlement is still in flight (None/Prepared) and stops once it
 * reaches Settled or Failed — those states are terminal.
 */
export function useSettlement(epochId?: bigint) {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ["noxage", "settlement", epochId?.toString()],
    enabled: epochId !== undefined && !!publicClient,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      // Terminal states never change; stop burning RPC calls.
      if (status === SettlementStatus.Settled || status === SettlementStatus.Failed) {
        return false;
      }
      return 10_000;
    },
    queryFn: async (): Promise<SettlementData> => {
      if (epochId === undefined || !publicClient) {
        throw new Error("Settlement query ran without an epoch");
      }

      const [status, settlement] = await Promise.all([
        publicClient.readContract({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "settlementStatus",
          args: [epochId],
        }),
        publicClient.readContract({
          address: addresses.settlementEngine,
          abi: settlementEngineAbi,
          functionName: "getSettlement",
          args: [epochId],
        }),
      ]);

      const logArgs = {
        address: addresses.settlementEngine,
        args: { epochId },
        fromBlock: INTENT_BOOK_DEPLOY_BLOCK,
        toBlock: "latest",
      } as const;

      const [swapLogs, finalizedLogs, failedLogs] = await Promise.all([
        publicClient.getLogs({ ...logArgs, event: residualSwappedEvent }),
        publicClient.getLogs({ ...logArgs, event: settlementFinalizedEvent }),
        publicClient.getLogs({ ...logArgs, event: settlementFailedEvent }),
      ]);

      const swapLog = swapLogs.at(-1);
      const residualSwap: ResidualSwap | null =
        swapLog &&
        typeof swapLog.args.amountIn === "bigint" &&
        typeof swapLog.args.amountOut === "bigint" &&
        typeof swapLog.args.buyHeavy === "boolean"
          ? {
              amountIn: swapLog.args.amountIn,
              amountOut: swapLog.args.amountOut,
              buyHeavy: swapLog.args.buyHeavy,
              txHash: swapLog.transactionHash,
            }
          : null;

      // A failed settlement's terminal tx is the SettlementFailedEvent one.
      const finalizedTxHash =
        finalizedLogs.at(-1)?.transactionHash ??
        failedLogs.at(-1)?.transactionHash ??
        null;

      return {
        status: status as SettlementStatus,
        residualHandle: settlement.residualHandle,
        dirHandle: settlement.dirHandle,
        residualSwap,
        finalizedTxHash,
        failed:
          status === SettlementStatus.Failed || failedLogs.length > 0,
      };
    },
  });

  return {
    status: query.data?.status ?? SettlementStatus.None,
    residualSwap: query.data?.residualSwap ?? null,
    finalizedTxHash: query.data?.finalizedTxHash ?? null,
    failed: query.data?.failed ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
