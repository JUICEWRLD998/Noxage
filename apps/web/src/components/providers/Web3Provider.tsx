"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ToastProvider } from "@/components/Toast";
import { wagmiConfig } from "@/lib/wagmi";

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain state is polled explicitly by hooks that need it.
            staleTime: 10_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    // reconnectOnMount={false}: never silently reattach to an extension on
    // page load — the wallet only connects when the user clicks Connect.
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={sepolia}
          modalSize="compact"
          theme={darkTheme({
            accentColor: "var(--accent, #7c5cff)",
            borderRadius: "medium",
          })}
        >
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
