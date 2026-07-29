# Noxage Demo Runbook

## Demo Goal

Show that Noxage keeps individual trade data confidential while still using
public Ethereum settlement rails. The main proof is a perfectly matched epoch:
two users submit equal opposing encrypted intents, the batch settles with zero
public residual, and each user privately decrypts only their own fill.

Target final length: **6 to 8 minutes**.

## Wallet Setup

- **Wallet A, operator:** `0x866df327dF560c24d2BA0f85aFd95cBff43cf06C`
- **Wallet B, trader and observer:** a separate Sepolia test wallet
- Use two clearly named browser profiles so the active wallet is always obvious.
- Keep approximately `0.05-0.1` Sepolia ETH in Wallet A.
- Keep approximately `0.02-0.05` Sepolia ETH in Wallet B.
- Use only Sepolia funds and the in-app mUSDC and mWETH faucets.
- Never show `.env`, private keys, seed phrases, RPC credentials, or wallet
  extension account-management screens in the recording.

## Pre-Recording Checklist

1. Start the production candidate locally with `pnpm dev`, or use the deployed
   Vercel URL after verifying it.
2. Confirm both wallets are connected to Sepolia and have enough gas.
3. Confirm no epoch is currently open.
4. Confirm Wallet A is still the owner/operator recognized by the application.
5. Confirm the faucet, shield, decrypt, observer, intent, epoch, fill, and
   unshield actions work before recording.
6. Prepare Wallet B's full address in a private scratchpad for quick pasting.
7. Close unrelated tabs, disable notifications, and hide bookmarks containing
   personal information.
8. Record wallet approvals, but crop the extension so balances and account
   names unrelated to the demo are not exposed.
9. Pause briefly after every important state change so the viewer can read it.
10. Edit out long transaction and KMS waits, but retain the transaction
    submission and confirmed result.

## Recording Phases

### Phase 1: Product Thesis and Access Controls

**Screen**

1. Open the Noxage application overview.
2. Briefly show the navigation: Shield, Intent, Epoch, Fills, and Auditor.
3. With Wallet B on a network other than Sepolia, show the network-blocking
   message.
4. Switch Wallet B to Sepolia.
5. Open the Epoch page and show that Wallet B has no operator-only Open or
   Finalize control.
6. Switch to Wallet A and show the operator-only Open epoch control.

**Proof point**

Noxage is Sepolia-gated and distinguishes permissionless user actions from
operator-only lifecycle actions.

### Phase 2: Shield and Decrypt a Confidential Balance

**Screen**

1. With Wallet A, open **Shield**.
2. Faucet mUSDC and mWETH.
3. Shield `10 mUSDC`, then shield `2 mWETH`.
4. Show the public balance decreasing and the confidential balance displayed as
   `●●●●`.
5. Click **Decrypt**, sign the request, and show the correct confidential
   balance.

**Proof point**

Public ERC-20 value is wrapped into an encrypted on-chain balance. Reading the
amount requires an explicit wallet signature.

### Phase 3: Controlled Auditor Disclosure

**Screen**

1. With Wallet A, open **Auditor**.
2. Under c-mUSDC, paste Wallet B's address and click **Grant access**.
3. Return to **Shield** and shield another `1 mUSDC` to create a new balance
   handle after the grant.
4. Switch to Wallet B and open **Auditor**.
5. In **Auditor view**, enter Wallet A's address, select c-mUSDC, click
   **View as auditor**, sign, and show the decrypted balance.
6. Switch to Wallet A, revoke Wallet B, and shield a small additional amount.
7. Switch back to Wallet B and show that decrypting the new handle fails.

**Proof point**

Disclosure is explicit, token-specific, revocable, and applies to balance
handles created while access is active.

### Phase 4: Open an Epoch and Demonstrate Cancellation

**Screen**

1. With Wallet A, open **Epoch** and click **Open epoch**.
2. Show the new epoch number and 60-second countdown.
3. Open **Intent** and submit a small Buy mWETH intent for `0.1`, leaving the
   limit blank.
4. Open **Fills**, find that intent in **Intent history**, click **Cancel**, and
   confirm its status becomes **Cancelled**.

**Proof point**

Intents are accepted only during an open epoch and can be cancelled before the
batch closes.

### Phase 5: Submit Equal Opposing Encrypted Intents

**Screen**

1. With Wallet A, submit:
   - Side: **Buy mWETH**
   - Amount: `1`
   - Limit: blank
2. With Wallet B, submit:
   - Side: **Sell mWETH**
   - Amount: `1`
   - Limit: blank
3. Show each sealed-intent receipt.
4. Return to **Epoch** and show two active sealed intents. The cancelled intent
   may remain in history, but must not participate in settlement.

**Proof point**

Direction, amount, and optional limit are encrypted in the browser. The chain
records ciphertext handles and public batch metadata instead of plaintext
trade details.

### Phase 6: Permissionless Netting and Operator Finalization

**Screen**

1. Wait for the countdown to expire.
2. With either wallet, click **Close epoch**.
3. Show the epoch becoming **Closed**.
4. With either wallet, click **Prepare settlement**.
5. Show **Encrypted netting in progress** and the prepared state.
6. Switch to Wallet A and click **Finalize settlement**.
7. Approve the residual-decryption signature and settlement transaction.
8. Show the epoch becoming **Settled**.
9. Hold on the **Perfect net** result and the message that nothing touched the
   public rail.

**Proof point**

Closing and encrypted netting are permissionless. Finalization verifies the
aggregate residual, and equal opposing flow settles without a public Uniswap
swap.

### Phase 7: Private Fills and On-Chain Persistence

**Screen**

1. With Wallet A, open **Fills**, locate the Buy intent, click **Decrypt**, and
   show that it received mWETH and paid mUSDC.
2. With Wallet B, open **Fills**, locate the Sell intent, click **Decrypt**, and
   show that it paid mWETH and received mUSDC.
3. Refresh both pages and show that fill and intent history remains.

**Proof point**

Each participant decrypts only their own fill. History is reconstructed from
Sepolia events rather than browser-local state.

### Phase 8: Unshield and Close

**Screen**

1. With Wallet A, return to **Shield**.
2. Select a token with a confidential balance and click **Unshield**.
3. Approve the transaction.
4. Show the message explaining that Zama KMS finalization is asynchronous.
5. If finalization completes during recording, refresh and show the public
   balance increase. Otherwise, keep the pending message visible briefly.
6. End on the settled epoch's **Perfect net** view or the Noxage overview.

**Proof point**

Confidential value can return to its public ERC-20 form, with asynchronous KMS
finalization clearly represented by the interface.

## Continuous Voiceover

Copy the following block as one script for the voice generator:

```text
Noxage is a confidential intent settlement prototype for open DeFi. Its purpose is to keep each trader's direction, size, limit, balance, and fill encrypted, while preserving access to public liquidity for any unmatched remainder. In this demonstration, I will use two independent wallets on Ethereum Sepolia. Wallet A is the protocol operator, while Wallet B acts as a second trader and, temporarily, as an authorized observer.

The application first enforces its network boundary. When Wallet B is connected to another network, Noxage blocks the workflow and requests a switch to Sepolia. After switching, Wallet B can use normal trading features, but it cannot see operator-only controls. When I connect Wallet A, the Open epoch control appears. This separates ordinary users from the account authorized to open and finalize settlement.

I will begin by creating confidential balances. Noxage includes faucets for mock mUSDC and mWETH, so no real assets are needed. After minting the test tokens, I shield ten mUSDC and two mWETH. The public balance decreases, while the confidential balance is represented by an encrypted handle and displayed as sealed. The application does not reveal this value automatically. I click Decrypt and approve a wallet signature, after which the correct confidential amount is shown locally.

Noxage also supports controlled disclosure. From the Auditor page, Wallet A grants Wallet B observer access for confidential mUSDC. Observer access applies from the next balance update, so I shield one additional mUSDC to create a new encrypted balance handle. Wallet B can now enter Wallet A's address, request the auditor view, sign, and decrypt that balance. This access is token-specific and revocable. After Wallet A revokes Wallet B and creates another balance handle, Wallet B's next decrypt attempt fails. The demonstration shows that disclosure is deliberate, limited, and can be withdrawn for future balance updates.

Now I will demonstrate the confidential intent lifecycle. Wallet A opens a new sixty-second epoch. Before creating the final matched batch, I submit a small buy intent and cancel it from the Fills page while the epoch is still open. Its state changes to Cancelled, proving that a user can withdraw an intent before the batch closes and that it will not participate in settlement.

For the successful settlement, Wallet A submits an intent to buy exactly one mWETH, and Wallet B submits an intent to sell exactly one mWETH. Both limits are left blank. Each browser encrypts the direction, amount, and limit before submitting ciphertext handles to the intent book. The public interface can show that two active intents exist in the epoch, but the individual trading instructions remain sealed.

When the epoch timer expires, closing becomes permissionless, so either wallet can seal the batch. Preparing settlement is also permissionless. During preparation, the settlement engine homomorphically totals the encrypted buy and sell flow and computes the residual without revealing either user's individual intent. Because these orders are equal and opposite, they form a perfect net.

Finalization remains restricted to the operator. Wallet A requests public decryption of the aggregate residual, approves the signed result, and submits the final settlement transaction. The epoch becomes Settled, and the interface reports Perfect net. No residual swap reaches Uniswap, because all opposing flow was absorbed inside the encrypted batch. This is the central Noxage result: private coordination can reduce the amount of order flow exposed to public liquidity.

The final fills also remain confidential. Wallet A opens the Fills page, signs a decrypt request, and sees that the buy intent received mWETH and paid mUSDC. Wallet B separately decrypts the sell fill and sees that it paid mWETH and received mUSDC. Neither user needs the other user's private fill data. After refreshing both pages, the intent and fill history remains available because the application reconstructs it from Sepolia events rather than relying on browser-local storage.

Finally, I return to the Shield page and unshield part of the confidential value. The unwrap transaction begins an asynchronous Zama KMS finalization process, and the interface reports that state honestly until the public balance updates.

This demonstration brings the complete Noxage flow together: confidential balances, explicit and revocable disclosure, encrypted intents, epoch-based private netting, aggregate-only public settlement, owner-gated fill decryption, and on-chain history. Noxage does not hide that a batch occurred, but it prevents individual strategy data from being published in plaintext and sends only the unmatched aggregate residual to public DeFi.
```

## Optional Failure-Path Appendix

Record this separately and include it only if the submission benefits from
showing honest failure handling:

1. Open another epoch.
2. Submit Buy `1 mWETH` from Wallet A.
3. Submit Sell `0.5 mWETH` from Wallet B.
4. Close and prepare the epoch.
5. Finalize with Wallet A.
6. Show the epoch becoming **Failed** because the current Sepolia residual swap
   path is not operational.
7. Emphasize that the UI does not display a successful fill when public
   residual execution fails.

Do not place this path before the successful perfect-net flow.

## Vercel Deployment Checklist

Create the Vercel project from the repository with these settings:

- **Framework preset:** Next.js
- **Root directory:** `apps/web`
- **Install command:** leave on automatic detection
- **Build command:** leave on automatic detection, or use `pnpm build`
- **Node.js:** 20 or newer

Add these variables to the Vercel project for Production and Preview:

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_SEPOLIA_RPC_URL
NEXT_PUBLIC_SEPOLIA_LOGS_RPC_URL
NEXT_PUBLIC_NOXAGE_INTENT_BOOK_ADDRESS
NEXT_PUBLIC_NOXAGE_EPOCH_MANAGER_ADDRESS
NEXT_PUBLIC_NOXAGE_SETTLEMENT_EXECUTOR_ADDRESS
NEXT_PUBLIC_NOXAGE_FILL_LEDGER_ADDRESS
NEXT_PUBLIC_UNISWAP_V3_ROUTER_ADDRESS
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_USDC_ADDRESS
NEXT_PUBLIC_NOXAGE_CONFIDENTIAL_WETH_ADDRESS
NEXT_PUBLIC_MOCK_USDC_ADDRESS
NEXT_PUBLIC_MOCK_WETH_ADDRESS
NEXT_PUBLIC_FHEVM_RELAYER_URL
NEXT_PUBLIC_FHEVM_NETWORK
```

Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin with no trailing path, for
example `https://noxage.vercel.app`.

Do **not** add any of the following to Vercel:

```text
DEPLOYER_PRIVATE_KEY
ETHERSCAN_API_KEY
SEPOLIA_RPC_URL
```

The deployed browser application does not need the operator private key.
Operator actions must continue to be signed through the connected Wallet A.

After deployment:

1. Open the production URL in a clean browser profile.
2. Confirm the page has no **Misconfigured build** banner.
3. Connect Wallet B and verify the Sepolia network guard.
4. Connect Wallet A and verify the operator-only controls.
5. Run one faucet action and one read-only decrypt before recording.
6. Check the browser console for blocked RPC, relayer, CORS, or content-security
   errors.
7. Confirm social preview images use the deployed URL rather than localhost.
