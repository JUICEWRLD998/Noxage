"use client";

import {
  getAddress,
  toHex,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import type { Eip1193Provider } from "@/lib/wallet";

// The Zama relayer SDK touches window / Worker / wasm, so it must only ever be
// imported dynamically on the client — never at module top level in anything the
// server renders. All access goes through getFheInstance().

// Loosely-typed handle to the SDK's FhevmInstance (the SDK's own types are only
// available after the dynamic import; we keep a narrow structural type here).
interface FhevmInstance {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string,
  ) => {
    add8: (v: number | bigint) => unknown;
    add64: (v: number | bigint) => unknown;
    encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
  };
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ) => {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    message: Record<string, unknown>;
  };
  userDecrypt: (
    handles: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ) => Promise<Record<string, bigint | boolean | string>>;
  publicDecrypt: (
    handles: string[],
  ) => Promise<{
    clearValues: Record<string, bigint | boolean | string>;
    decryptionProof: Hex;
  }>;
}

let instancePromise: Promise<FhevmInstance> | null = null;
let boundProvider: Eip1193Provider | null = null;

function normalizeAddress(address: Address | string): Address {
  return getAddress(address.toLowerCase());
}

function resolveProvider(explicit?: Eip1193Provider): Eip1193Provider {
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (eth) return eth;
  }
  throw new Error("No injected Ethereum provider found");
}

/**
 * Lazily initialize a single relayer instance. Loads ~5MB of wasm on first call.
 * Runs single-threaded (thread: 1) so we don't need COOP/COEP headers, which can
 * break wallet popups.
 *
 * Pass the active wallet provider so FHE uses the same injected wallet the user
 * connected with.
 */
export function getFheInstance(provider?: Eip1193Provider): Promise<FhevmInstance> {
  const network = resolveProvider(provider);
  if (instancePromise && boundProvider === network) return instancePromise;

  boundProvider = network;
  instancePromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("FHE client can only run in the browser");
    }

    const sdk = await import("@zama-fhe/relayer-sdk/web");
    await sdk.initSDK({ thread: 1 });
    const instance = await sdk.createInstance({
      ...sdk.SepoliaConfig,
      // Injected provider from the wallet context, or window.ethereum as fallback.
      network: network as Parameters<typeof sdk.createInstance>[0]["network"],
    });
    return instance as unknown as FhevmInstance;
  })();

  // Reset on failure so a later attempt can retry (e.g. user unlocks wallet).
  instancePromise.catch(() => {
    instancePromise = null;
    boundProvider = null;
  });

  return instancePromise;
}

export interface IntentPlain {
  /** 0 = sell base, 1 = buy base. */
  side: number;
  /** Size in confidential (6-decimal) base units. */
  amount: bigint;
  /** Limit price in confidential units; 0 = no limit. */
  limit: bigint;
}

export interface EncryptedIntent {
  sideExt: Hex;
  amountExt: Hex;
  limitExt: Hex;
  inputProof: Hex;
}

/**
 * Encrypt (side, amount, limit) bound to the intent book and the submitter,
 * matching submitIntent's argument order. Handles come back as raw bytes32 and
 * are hex-encoded for viem.
 */
export async function encryptIntent(
  bookAddress: Address,
  userAddress: Address,
  intent: IntentPlain,
  provider?: Eip1193Provider,
): Promise<EncryptedIntent> {
  const instance = await getFheInstance(provider);
  const input = instance.createEncryptedInput(
    normalizeAddress(bookAddress),
    normalizeAddress(userAddress),
  );
  input.add8(intent.side);
  input.add64(intent.amount);
  input.add64(intent.limit);
  const { handles, inputProof } = await input.encrypt();
  return {
    sideExt: toHex(handles[0]),
    amountExt: toHex(handles[1]),
    limitExt: toHex(handles[2]),
    inputProof: toHex(inputProof),
  };
}

/** One handle/contract pair to decrypt via the relayer. */
export interface DecryptRequest {
  handle: Hex;
  contractAddress: Address;
}

/**
 * Batch-decrypt confidential handles for the connected user with a single
 * keypair + a single EIP-712 wallet signature covering the union of contract
 * addresses. Zero handles ("no value yet") short-circuit to 0n and are never
 * sent to the relayer. Returns a map keyed by handle.
 */
export async function decryptHandles(
  requests: DecryptRequest[],
  userAddress: Address,
  walletClient: WalletClient,
  provider?: Eip1193Provider,
): Promise<Record<Hex, bigint>> {
  const results: Record<Hex, bigint> = {};

  // Zero handles mean "nothing here" — resolve locally, skip the relayer.
  const live = requests.filter((r) => {
    if (isZeroHandle(r.handle)) {
      results[r.handle] = 0n;
      return false;
    }
    return true;
  });
  if (live.length === 0) return results;

  const instance = await getFheInstance(provider);
  const { publicKey, privateKey } = instance.generateKeypair();

  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const normalizedUserAddress = normalizeAddress(userAddress);
  // One signature covers the union of contracts holding the handles.
  const contractAddresses = [
    ...new Set(live.map((r) => normalizeAddress(r.contractAddress))),
  ];

  const eip712 = instance.createEIP712(
    publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
  );
  const verifyingContract = eip712.domain.verifyingContract;
  const domain = {
    ...eip712.domain,
    ...(typeof verifyingContract === "string"
      ? { verifyingContract: normalizeAddress(verifyingContract) }
      : {}),
  };

  const signature = await walletClient.signTypedData({
    account: normalizedUserAddress,
    domain,
    types: {
      UserDecryptRequestVerification:
        eip712.types.UserDecryptRequestVerification,
    },
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message,
  });

  const decrypted = await instance.userDecrypt(
    live.map((r) => ({
      handle: r.handle,
      contractAddress: normalizeAddress(r.contractAddress),
    })),
    privateKey,
    publicKey,
    signature.replace(/^0x/, ""),
    contractAddresses,
    normalizedUserAddress,
    startTimestamp,
    durationDays,
  );

  for (const r of live) {
    const value = decrypted[r.handle];
    if (typeof value !== "bigint") {
      throw new Error("Decryption returned an unexpected type");
    }
    results[r.handle] = value;
  }
  return results;
}

/**
 * Decrypt a confidential balance handle for the connected user. Requires an
 * explicit wallet signature (EIP-712) — nothing is decrypted silently.
 */
export async function decryptHandle(
  handle: Hex,
  tokenAddress: Address,
  userAddress: Address,
  walletClient: WalletClient,
  provider?: Eip1193Provider,
): Promise<bigint> {
  const results = await decryptHandles(
    [{ handle, contractAddress: tokenAddress }],
    userAddress,
    walletClient,
    provider,
  );
  return results[handle];
}

/** Public KMS decrypt for handles marked publicly decryptable on-chain. */
export async function publicDecryptHandles(
  handles: Hex[],
  provider?: Eip1193Provider,
): Promise<{
  clearValues: Record<Hex, bigint>;
  decryptionProof: Hex;
}> {
  const instance = await getFheInstance(provider);
  const result = await instance.publicDecrypt(handles);
  const clearValues: Record<Hex, bigint> = {};
  for (const handle of handles) {
    const value = result.clearValues[handle];
    if (typeof value !== "bigint") {
      throw new Error(`Public decrypt returned unexpected type for ${handle}`);
    }
    clearValues[handle] = value;
  }
  return { clearValues, decryptionProof: result.decryptionProof };
}

/** A confidential balance handle of all-zeros means "no balance yet". */
export function isZeroHandle(handle: Hex | undefined): boolean {
  return (
    !handle ||
    handle ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
}
