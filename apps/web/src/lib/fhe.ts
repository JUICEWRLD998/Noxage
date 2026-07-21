"use client";

import { toHex, type Address, type Hex, type WalletClient } from "viem";

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
}

let instancePromise: Promise<FhevmInstance> | null = null;

/**
 * Lazily initialize a single relayer instance. Loads ~5MB of wasm on first call.
 * Runs single-threaded (thread: 1) so we don't need COOP/COEP headers, which can
 * break wallet popups.
 */
export function getFheInstance(): Promise<FhevmInstance> {
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("FHE client can only run in the browser");
    }
    const eth = (window as unknown as { ethereum?: object }).ethereum;
    if (!eth) {
      throw new Error("No injected Ethereum provider found");
    }

    const sdk = await import("@zama-fhe/relayer-sdk/web");
    await sdk.initSDK({ thread: 1 });
    const instance = await sdk.createInstance({
      ...sdk.SepoliaConfig,
      // window.ethereum is an EIP-1193 provider; the SDK accepts it or an RPC URL.
      network: eth as Parameters<typeof sdk.createInstance>[0]["network"],
    });
    return instance as unknown as FhevmInstance;
  })();

  // Reset on failure so a later attempt can retry (e.g. user unlocks wallet).
  instancePromise.catch(() => {
    instancePromise = null;
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
): Promise<EncryptedIntent> {
  const instance = await getFheInstance();
  const input = instance.createEncryptedInput(bookAddress, userAddress);
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

/**
 * Decrypt a confidential balance handle for the connected user. Requires an
 * explicit wallet signature (EIP-712) — nothing is decrypted silently.
 */
export async function decryptHandle(
  handle: Hex,
  tokenAddress: Address,
  userAddress: Address,
  walletClient: WalletClient,
): Promise<bigint> {
  const instance = await getFheInstance();
  const { publicKey, privateKey } = instance.generateKeypair();

  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const contractAddresses = [tokenAddress];

  const eip712 = instance.createEIP712(
    publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
  );

  const signature = await walletClient.signTypedData({
    account: userAddress,
    domain: eip712.domain,
    types: {
      UserDecryptRequestVerification:
        eip712.types.UserDecryptRequestVerification,
    },
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message,
  });

  const result = await instance.userDecrypt(
    [{ handle, contractAddress: tokenAddress }],
    privateKey,
    publicKey,
    signature.replace(/^0x/, ""),
    contractAddresses,
    userAddress,
    startTimestamp,
    durationDays,
  );

  const value = result[handle];
  if (typeof value !== "bigint") {
    throw new Error("Decryption returned an unexpected type");
  }
  return value;
}

/** A confidential balance handle of all-zeros means "no balance yet". */
export function isZeroHandle(handle: Hex | undefined): boolean {
  return (
    !handle ||
    handle ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
}
