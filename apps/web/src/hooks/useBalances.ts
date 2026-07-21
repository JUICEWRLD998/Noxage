"use client";

import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useAccount, useReadContract, useWalletClient } from "wagmi";
import { confidentialTokenAbi, mockErc20Abi } from "@/lib/abis";
import { TOKENS, type TokenKey } from "@/lib/contracts";
import { decryptHandle, isZeroHandle } from "@/lib/fhe";

/** Public ERC-20 balance of the connected account for a token. */
export function usePublicBalance(tokenKey: TokenKey) {
  const { address } = useAccount();
  const token = TOKENS[tokenKey];

  const query = useReadContract({
    address: token.mock,
    abi: mockErc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    balance: query.data as bigint | undefined,
    decimals: token.decimals,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Confidential balance handle + on-demand decrypt. The handle is always readable
 * (it's a ciphertext); the cleartext only appears after the user explicitly
 * decrypts (which prompts a wallet signature).
 */
export function useConfidentialBalance(tokenKey: TokenKey) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const token = TOKENS[tokenKey];

  const [clear, setClear] = useState<bigint | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const handleQuery = useReadContract({
    address: token.confidential,
    abi: confidentialTokenAbi,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const handle = handleQuery.data as Hex | undefined;
  const hasBalance = !isZeroHandle(handle);

  const decrypt = useCallback(async () => {
    if (!address || !walletClient || !handle || isZeroHandle(handle)) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      const value = await decryptHandle(
        handle,
        token.confidential,
        address,
        walletClient,
      );
      setClear(value);
    } catch (err) {
      setDecryptError(
        err instanceof Error ? err.message : "Decryption failed",
      );
    } finally {
      setDecrypting(false);
    }
  }, [address, walletClient, handle, token.confidential]);

  // Reset the revealed cleartext when the underlying handle changes.
  const reset = useCallback(() => {
    setClear(null);
    setDecryptError(null);
  }, []);

  return {
    handle,
    hasBalance,
    /** Confidential balances are stored in 6-decimal units (wrapper maxDecimals). */
    decimals: token.confidentialDecimals,
    clear,
    decrypt,
    decrypting,
    decryptError,
    reset,
    isLoading: handleQuery.isLoading,
    error: handleQuery.error,
    refetch: handleQuery.refetch,
  };
}
