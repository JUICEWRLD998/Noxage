"use client";

import type { Address } from "viem";
import { useAccount, useReadContract } from "@/lib/wallet";
import { epochManagerAbi, settlementEngineAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";

/** True when the connected wallet owns epoch manager + settlement engine. */
export function useOperator() {
  const { address, isConnected } = useAccount();

  const epochOwner = useReadContract({
    address: addresses.epochManager,
    abi: epochManagerAbi,
    functionName: "owner",
    query: { enabled: isConnected },
  });

  const engineOwner = useReadContract({
    address: addresses.settlementEngine,
    abi: settlementEngineAbi,
    functionName: "owner",
    query: { enabled: isConnected },
  });

  const epochOwnerAddr = epochOwner.data as Address | undefined;
  const engineOwnerAddr = engineOwner.data as Address | undefined;
  const isOperator =
    !!address &&
    epochOwnerAddr?.toLowerCase() === address.toLowerCase() &&
    engineOwnerAddr?.toLowerCase() === address.toLowerCase();

  return {
    isOperator,
    epochOwner: epochOwnerAddr,
    engineOwner: engineOwnerAddr,
    isLoading: epochOwner.isLoading || engineOwner.isLoading,
  };
}
