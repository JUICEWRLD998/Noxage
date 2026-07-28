"use client";

import type { Eip1193Provider } from "@/lib/wallet";

export type { Eip1193Provider };

export interface ConnectorLike {
  getProvider: () => Promise<Eip1193Provider>;
}

/** Resolve the active wallet's injected provider. */
export async function getConnectorProvider(
  connector: ConnectorLike | undefined,
): Promise<Eip1193Provider | undefined> {
  if (!connector) return undefined;
  try {
    return await connector.getProvider();
  } catch {
    return undefined;
  }
}
