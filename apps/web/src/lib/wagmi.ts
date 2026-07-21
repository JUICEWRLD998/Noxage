import { createConfig, http, injected } from "wagmi";
import { sepolia } from "wagmi/chains";

const rpcUrl =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

// Injected only (MetaMask / Rabby / Brave via the browser extension). `injected`
// is re-exported from the `wagmi` entrypoint, so we avoid the `wagmi/connectors`
// barrel — that barrel also pulls in the Base Account connector, whose
// @coinbase/cdp-sdk dependency statically imports optional, uninstalled `@x402/*`
// packages that break the production build (webpack errors / Turbopack hangs).
const connectors = [injected({ shimDisconnect: true })];

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
