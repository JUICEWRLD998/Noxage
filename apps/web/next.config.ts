import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // RainbowKit's barrel imports `wagmi/connectors`, which pulls the Base
    // Account connector → @coinbase/cdp-sdk → optional, uninstalled `@x402/*`
    // packages that fail module resolution. We never configure the Base
    // Account / Coinbase wallet (see src/lib/wagmi.ts), so stub the SDK out.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
    };
    return config;
  },
};

export default nextConfig;
