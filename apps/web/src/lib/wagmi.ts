import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

const rpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

// RainbowKit wallet list, deliberately restricted to extension wallets
// (MetaMask, Phantom, plus a generic injected fallback). Do NOT add
// coinbaseWallet or walletConnectWallet here: their dependency chains pull in
// @coinbase/cdp-sdk, whose optional, uninstalled `@x402/*` packages break the
// production build (webpack errors / Turbopack hangs).
const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [metaMaskWallet, phantomWallet, injectedWallet],
    },
  ],
  {
    appName: "Noxage",
    // Required by the RainbowKit API but only used by WalletConnect-based
    // wallets, none of which are configured above.
    projectId: "NOXAGE_PLACEHOLDER",
  },
);

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
