# Noxage Demo Runbook

## Demo Goal

Show that Noxage keeps individual trade data confidential while still using
public Ethereum settlement rails. The main proof is a perfectly matched epoch:
two users submit equal opposing encrypted intents, the batch settles with zero
public residual, and each user privately decrypts only their own fill.

Target final length: **about 4 minutes**.

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

## Four-Minute Recording Plan

Transaction confirmations and the 60-second epoch wait should be shortened
during editing. Show each wallet request, then cut to the confirmed result.

### Phase 1: Introduce Noxage and the Two Roles

**Time:** `0:00-0:25`

**Screen**

1. Open the Noxage overview and briefly show Shield, Intent, Epoch, Fills, and
   Auditor.
2. Show Wallet B blocked on the wrong network, then switch to Sepolia.
3. Open Epoch with Wallet B and show that operator controls are hidden.
4. Switch to Wallet A and show **Open epoch**.

**Key message**

Noxage runs on Sepolia and separates normal users from the settlement operator.

### Phase 2: Create and Read a Confidential Balance

**Time:** `0:25-1:00`

**Screen**

1. With Wallet A, open **Shield** and faucet mUSDC.
2. Shield `10 mUSDC`.
3. Show the public balance decreasing and the confidential balance as `●●●●`.
4. Click **Decrypt**, sign, and show the amount.

**Key message**

The balance is encrypted on-chain and is revealed only after an approved wallet
signature.

### Phase 3: Show Controlled Auditor Access

**Time:** `1:00-1:30`

**Screen**

1. With Wallet A, grant Wallet B observer access for c-mUSDC.
2. Shield another `1 mUSDC` to create a new balance handle.
3. With Wallet B, use **View as auditor** and show the decrypted balance.
4. Return briefly to Wallet A and show the **Revoke** control.

**Key message**

A user can give a chosen wallet access to one confidential balance and can stop
access to future balance updates.

### Phase 4: Submit Two Matching Private Intents

**Time:** `1:30-2:20`

**Screen**

1. With Wallet A, open a new epoch and show the countdown.
2. Wallet A submits **Buy 1 mWETH**, with the limit blank.
3. Wallet B submits **Sell 1 mWETH**, with the limit blank.
4. Show both sealed-intent receipts.
5. Return to Epoch and show two sealed intents.

**Key message**

The amount, side, and limit are encrypted before they reach the chain. The
public can see the batch, but not each user's trade details.

### Phase 5: Settle a Perfect Net

**Time:** `2:20-3:15`

**Screen**

1. Cut to the expired epoch timer.
2. With either wallet, click **Close epoch**.
3. Click **Prepare settlement** and show **Encrypted netting in progress**.
4. Switch to Wallet A and click **Finalize settlement**.
5. Approve the decrypt signature and settlement transaction.
6. Show **Settled** and hold on **Perfect net**.

**Key message**

The equal buy and sell cancel inside the encrypted batch. There is no remaining
amount to send to Uniswap.

### Phase 6: Decrypt Private Fills and Close

**Time:** `3:15-4:00`

**Screen**

1. With Wallet A, decrypt the Buy fill and show received mWETH and paid mUSDC.
2. With Wallet B, decrypt the Sell fill and show paid mWETH and received mUSDC.
3. Refresh one Fills page to show that history remains.
4. End on the Epoch page with **Perfect net** visible.

**Key message**

Each trader can read their own private result, while the history is rebuilt from
Sepolia events.

## Continuous Voiceover

This script is written for a calm pace of about 125 to 135 words per minute.
Copy the block as one script for the voice generator:

```text
Noxage is a private trading system for open DeFi. It keeps each user's trade amount, buy or sell choice, limit, balance, and final fill encrypted. Only the part that cannot be matched inside the batch needs public liquidity.

For this demo, I am using two wallets on Ethereum Sepolia. Wallet A is the operator. Wallet B is a normal trader. When Wallet B is connected to the wrong network, the app blocks the workflow and asks for Sepolia. After switching networks, Wallet B can use the app, but it cannot see operator controls. When I connect Wallet A, the Open epoch control appears.

First, I will create a confidential balance. I use the built-in faucet to receive test mUSDC. I then shield ten mUSDC. The public balance goes down, and the confidential balance is hidden. The app shows sealed dots instead of the amount. To read the balance, I click Decrypt and approve a wallet signature. The correct amount is then shown in my browser.

Noxage also supports controlled access. Wallet A gives Wallet B permission to view its confidential mUSDC balance. I make one more balance update, then switch to Wallet B. Wallet B enters Wallet A's address, signs the request, and can read the balance as an auditor. Wallet A can use the Revoke control to block access to future balance updates.

Now I will show the main trading flow. Wallet A opens a new sixty-second epoch. Wallet A submits an intent to buy one mWETH. Wallet B submits an intent to sell one mWETH. Both limits are left blank.

The browser encrypts the amount, the side, and the limit before sending the intent to the chain. The public can see that the epoch contains two intents, but it cannot read the private details of either trade.

After the timer ends, either user can close the epoch. Either user can also prepare settlement. At this stage, Noxage adds the encrypted buy and sell amounts and finds the difference without first revealing each user's order.

These two trades are equal and opposite, so they form a perfect net. Wallet A performs the final operator step. I approve the request to reveal the total difference, then approve the settlement transaction.

The epoch is now settled. The result says Perfect net. This means the buy and sell matched inside the private batch. There was no amount left over, so no trade had to be sent to Uniswap.

The final fills are also private. Wallet A signs a request and sees that the buy order received mWETH and paid mUSDC. Wallet B signs separately and sees that the sell order paid mWETH and received mUSDC.

After a refresh, the fill history is still available because the app rebuilds it from Sepolia events. This demo shows the main value of Noxage: users can submit private trade instructions, match them inside an encrypted batch, reveal only the total difference, and privately read their own results.
```

## Optional Proof Clips

Do not include these in the main four-minute video unless there is spare time:

- Cancel an intent while the epoch is open.
- Revoke Wallet B, create a new balance handle, and show its decrypt request
  failing.
- Unshield a confidential balance and show the asynchronous KMS message.

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
