import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const rpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Injected is always available; WalletConnect only when a project id is set.
const connectors = [
  injected({ shimDisconnect: true }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
          metadata: {
            name: "Noxage",
            description:
              "Confidential intent settlement for open DeFi — public liquidity, private strategy.",
            url: "https://noxage.app",
            icons: [],
          },
        }),
      ]
    : []),
];

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
