"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";

const rpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

/** Shared read-only client — no wallet required. */
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

interface WalletContextValue {
  address: Address | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isSwitching: boolean;
  provider: Eip1193Provider | undefined;
  publicClient: PublicClient;
  walletClient: WalletClient | undefined;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToSepolia: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function getInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [provider, setProvider] = useState<Eip1193Provider | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  /** True only after the user clicks "Connect wallet" in this session. */
  const [userInitiated, setUserInitiated] = useState(false);

  const walletClient = useMemo(() => {
    if (!provider || !address) return undefined;
    return createWalletClient({
      account: address,
      chain: sepolia,
      transport: custom(provider),
    });
  }, [provider, address]);

  // Listen for wallet events only after an explicit connect — never auto-reconnect.
  useEffect(() => {
    if (!userInitiated || !provider) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as Address[];
      if (list[0]) {
        setAddress(list[0]);
      } else {
        setAddress(undefined);
        setProvider(undefined);
        setChainId(undefined);
        setUserInitiated(false);
      }
    };

    const onChainChanged = (chain: unknown) => {
      setChainId(Number.parseInt(chain as string, 16));
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [userInitiated, provider]);

  const connect = useCallback(async () => {
    const eth = getInjectedProvider();
    if (!eth) {
      throw new Error(
        "No wallet found. Install MetaMask or another browser wallet.",
      );
    }
    setIsConnecting(true);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as Address[];
      const chain = (await eth.request({ method: "eth_chainId" })) as Hex;
      setProvider(eth);
      setAddress(accounts[0]);
      setChainId(Number.parseInt(chain, 16));
      setUserInitiated(true);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setProvider(undefined);
    setChainId(undefined);
    setUserInitiated(false);
  }, []);

  const switchToSepolia = useCallback(async () => {
    const eth = provider ?? getInjectedProvider();
    if (!eth) return;
    setIsSwitching(true);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4902) throw err;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
            chainName: "Sepolia",
            nativeCurrency: {
              name: "Sepolia Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [rpcUrl],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } finally {
      setIsSwitching(false);
    }
  }, [provider]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      isConnected: !!address,
      isConnecting,
      isSwitching,
      provider,
      publicClient,
      walletClient,
      connect,
      disconnect,
      switchToSepolia,
    }),
    [
      address,
      chainId,
      isConnecting,
      isSwitching,
      provider,
      walletClient,
      connect,
      disconnect,
      switchToSepolia,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}

/** Drop-in replacement for wagmi's useAccount. */
export function useAccount() {
  const w = useWallet();
  const chain =
    w.chainId === SEPOLIA_CHAIN_ID
      ? { id: SEPOLIA_CHAIN_ID, name: "Sepolia", unsupported: false }
      : w.chainId !== undefined
        ? {
            id: w.chainId,
            name: `Chain ${w.chainId}`,
            unsupported: true,
          }
        : undefined;

  return {
    address: w.address,
    isConnected: w.isConnected,
    chainId: w.chainId,
    chain,
    connector: w.provider
      ? { getProvider: async () => w.provider! }
      : undefined,
  };
}

/** Drop-in replacement for wagmi's usePublicClient. */
export function usePublicClient() {
  return useWallet().publicClient;
}

/** Drop-in replacement for wagmi's useWalletClient. */
export function useWalletClient() {
  const { walletClient } = useWallet();
  return { data: walletClient };
}

/** Drop-in replacement for wagmi's useSwitchChain. */
export function useSwitchChain() {
  const { switchToSepolia, isSwitching } = useWallet();
  return {
    switchChain: ({ chainId }: { chainId: number }) => {
      if (chainId === SEPOLIA_CHAIN_ID) return switchToSepolia();
      throw new Error(`Unsupported chain: ${chainId}`);
    },
    isPending: isSwitching,
  };
}

interface ReadContractOptions {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  query?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  };
}

/** Drop-in replacement for wagmi's useReadContract. */
export function useReadContract<T = unknown>({
  address,
  abi,
  functionName,
  args,
  query,
}: ReadContractOptions) {
  const client = usePublicClient();
  const enabled = query?.enabled !== false && !!address;

  const result = useQuery({
    queryKey: ["readContract", address, functionName, args],
    enabled,
    refetchInterval: query?.refetchInterval,
    queryFn: () =>
      client.readContract({
        address,
        abi,
        functionName,
        args,
      }) as Promise<T>,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Drop-in replacement for wagmi's useWriteContract. */
export function useWriteContract() {
  const { walletClient, address } = useWallet();

  const writeContractAsync = useCallback(
    async (params: {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
    }) => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      return walletClient.writeContract({
        account: address,
        chain: sepolia,
        ...params,
      });
    },
    [walletClient, address],
  );

  return { writeContractAsync };
}
