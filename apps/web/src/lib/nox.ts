"use client";

import {
  createViemHandleClient,
  type Handle,
  type HandleClient,
  type JsValue,
  type SolidityType,
} from "@iexec-nox/handle";
import { getAddress, type Address, type Hex, type WalletClient } from "viem";

const clientPromises = new WeakMap<WalletClient, Promise<HandleClient>>();

const noxConfigValues = [
  process.env.NEXT_PUBLIC_NOX_GATEWAY_URL,
  process.env.NEXT_PUBLIC_NOX_COMPUTE_ADDRESS,
  process.env.NEXT_PUBLIC_NOX_SUBGRAPH_URL,
] as const;

function getNoxConfig(): Parameters<typeof createViemHandleClient>[1] {
  const configured = noxConfigValues.filter(Boolean).length;
  if (configured === 0) return undefined;
  if (configured !== noxConfigValues.length) {
    throw new Error(
      "Set all three NEXT_PUBLIC_NOX_* variables or leave all three unset",
    );
  }

  return {
    gatewayUrl: noxConfigValues[0],
    smartContractAddress: noxConfigValues[1],
    subgraphUrl: noxConfigValues[2],
  } as NonNullable<Parameters<typeof createViemHandleClient>[1]>;
}

function normalizeAddress(address: Address | string): Address {
  return getAddress(address.toLowerCase());
}

/**
 * Create one Nox handle client per viem wallet client. The SDK resolves its
 * Ethereum Sepolia gateway, NoxCompute address, and subgraph from chain ID.
 */
export function getNoxHandleClient(
  walletClient: WalletClient,
): Promise<HandleClient> {
  const cached = clientPromises.get(walletClient);
  if (cached) return cached;

  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("The Nox handle client can only run in the browser"),
    );
  }

  if (walletClient.chain?.id !== 11_155_111) {
    return Promise.reject(
      new Error("Noxage confidential operations require Ethereum Sepolia"),
    );
  }

  const clientPromise = createViemHandleClient(walletClient, getNoxConfig());
  clientPromises.set(walletClient, clientPromise);
  clientPromise.catch(() => {
    clientPromises.delete(walletClient);
  });
  return clientPromise;
}

export interface IntentPlain {
  /** 0 = sell base, 1 = buy base. */
  side: number;
  /** Size in the base token's raw units. */
  amount: bigint;
  /** Limit price in the quote token's raw units; 0 = no limit. */
  limit: bigint;
}

export interface EncryptedInput<T extends SolidityType> {
  handle: Handle<T>;
  handleProof: Hex;
}

export interface EncryptedIntent {
  side: EncryptedInput<"bool">;
  amount: EncryptedInput<"uint256">;
  limit: EncryptedInput<"uint256">;
}

/**
 * Encrypt each intent field independently for the intent book. Nox produces
 * one handle proof per input, so submitIntent must accept all three proofs.
 */
export async function encryptIntent(
  bookAddress: Address,
  intent: IntentPlain,
  walletClient: WalletClient,
): Promise<EncryptedIntent> {
  if (intent.side !== 0 && intent.side !== 1) {
    throw new RangeError("Intent side must be 0 (sell) or 1 (buy)");
  }
  if (intent.amount < 0n || intent.limit < 0n) {
    throw new RangeError("Intent amount and limit cannot be negative");
  }

  const client = await getNoxHandleClient(walletClient);
  const applicationContract = normalizeAddress(bookAddress);
  const [side, amount, limit] = await Promise.all([
    client.encryptInput(intent.side === 1, "bool", applicationContract),
    client.encryptInput(intent.amount, "uint256", applicationContract),
    client.encryptInput(intent.limit, "uint256", applicationContract),
  ]);

  return {
    side: {
      handle: side.handle,
      handleProof: side.handleProof as Hex,
    },
    amount: {
      handle: amount.handle,
      handleProof: amount.handleProof as Hex,
    },
    limit: {
      handle: limit.handle,
      handleProof: limit.handleProof as Hex,
    },
  };
}

/** One handle/contract pair to decrypt through Nox. */
export interface DecryptRequest {
  handle: Hex;
  solidityType: "uint256";
}

/**
 * Decrypt confidential handles for the connected viewer. Nox resolves the
 * Solidity type and viewer authorization from each handle's metadata and ACL.
 */
export async function decryptHandles(
  requests: DecryptRequest[],
  walletClient: WalletClient,
): Promise<Record<Hex, bigint>> {
  const results: Record<Hex, bigint> = {};
  const live = requests.filter((request) => {
    if (isZeroHandle(request.handle)) {
      results[request.handle] = 0n;
      return false;
    }
    return true;
  });
  if (live.length === 0) return results;

  const client = await getNoxHandleClient(walletClient);
  // The first decrypt creates and stores the wallet authorization. Run these
  // sequentially so later handles reuse it instead of prompting in parallel.
  for (const { handle, solidityType } of live) {
    const result = await client.decrypt(handle as Handle<SolidityType>);
    if (result.solidityType !== solidityType || typeof result.value !== "bigint") {
      throw new Error(
        `Nox returned ${result.solidityType}; expected ${solidityType} for ${handle}`,
      );
    }
    results[handle] = result.value;
  }
  return results;
}

/** Decrypt one confidential handle for the connected viewer. */
export async function decryptHandle(
  handle: Hex,
  walletClient: WalletClient,
): Promise<bigint> {
  const results = await decryptHandles(
    [{ handle, solidityType: "uint256" }],
    walletClient,
  );
  return results[handle];
}

export type PublicDecryptedValue = JsValue<SolidityType>;

export interface PublicDecryptRequest {
  handle: Hex;
  solidityType: "bool" | "uint256";
}

export interface PublicDecryptResult {
  clearValues: Record<Hex, PublicDecryptedValue>;
  decryptionProofs: Record<Hex, Hex>;
}

/**
 * Publicly decrypt handles marked as publicly decryptable on-chain. Nox emits
 * one proof per handle rather than a single aggregate decryption proof.
 */
export async function publicDecryptHandles(
  requests: PublicDecryptRequest[],
  walletClient: WalletClient,
): Promise<PublicDecryptResult> {
  const clearValues: Record<Hex, PublicDecryptedValue> = {};
  const decryptionProofs: Record<Hex, Hex> = {};
  for (const { handle } of requests) {
    if (isZeroHandle(handle)) {
      throw new Error("Cannot publicly decrypt an empty Nox handle");
    }
  }

  const client = await getNoxHandleClient(walletClient);
  const decrypted = await Promise.all(
    requests.map(async ({ handle, solidityType }) => {
      const result = await client.publicDecrypt(
        handle as Handle<SolidityType>,
      );
      if (result.solidityType !== solidityType) {
        throw new Error(
          `Nox returned ${result.solidityType}; expected ${solidityType} for ${handle}`,
        );
      }
      return {
        handle,
        value: result.value,
        proof: result.decryptionProof as Hex,
      };
    }),
  );

  for (const { handle, value, proof } of decrypted) {
    clearValues[handle] = value;
    decryptionProofs[handle] = proof;
  }
  return { clearValues, decryptionProofs };
}

/** An all-zero confidential handle means that no value has been written yet. */
export function isZeroHandle(handle: Hex | undefined): boolean {
  return (
    !handle ||
    handle ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
}
