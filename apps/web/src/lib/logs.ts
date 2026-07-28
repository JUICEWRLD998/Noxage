import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const logsRpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL ?? "https://sepolia.drpc.org";

/**
 * Historical event scans use a separate client because the default PublicNode
 * endpoint requires a personal token for archive requests.
 */
export const historicalLogsClient = createPublicClient({
  chain: sepolia,
  transport: http(logsRpcUrl),
});

const MAX_LOG_BLOCKS = 10_000n;

export async function getHistoricalLogRanges(
  fromBlock: bigint,
): Promise<Array<{ fromBlock: bigint; toBlock: bigint }>> {
  const latestBlock = await historicalLogsClient.getBlockNumber();
  if (fromBlock > latestBlock) return [];

  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let start = fromBlock; start <= latestBlock; start += MAX_LOG_BLOCKS) {
    const end = start + MAX_LOG_BLOCKS - 1n;
    ranges.push({
      fromBlock: start,
      toBlock: end < latestBlock ? end : latestBlock,
    });
  }
  return ranges;
}
