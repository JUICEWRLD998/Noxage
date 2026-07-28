• Fund this Sepolia operator wallet:

  0x866df327dF560c24d2BA0f85aFd95cBff43cf06C

  It owns both the epoch manager and settlement engine, so it must open and finalize epochs. It currently has
  approximately 0.03 Sepolia ETH; topping it up to roughly 0.05–0.1 Sepolia ETH is sensible.

  Also prepare a second test wallet with around 0.02–0.05 Sepolia ETH. You do not need to buy mUSDC or mWETH—the
  application has an in-app mock-token faucet.

  Important: only use testnet wallets. Never fund these addresses with real mainnet assets.

  ## Wallet roles

  - Wallet A — operator: 0x866d…f06C
      - Opens epochs
      - Submits the buy intent
      - Finalizes settlement

  - Wallet B — second test wallet
      - Submits the matching sell intent
      - Can act as the observer/auditor

  - Optional Wallet C
      - Useful if you want the auditor completely separate

  Use a second browser profile or incognito window for Wallet B.

  ## Complete testing flow

  Start the application:

  pnpm dev

  Open http://localhost:3000.

  ### 1. Network and wallet checks

  1. Connect Wallet B on a network other than Sepolia.
  2. Confirm the application blocks usage and asks you to switch.
  3. Switch to Sepolia.
  4. Confirm Wallet B cannot see operator-only “Open epoch” or “Finalize” controls.
  5. Connect Wallet A and confirm those operator controls appear.

  ### 2. Faucet and shield

  Using Wallet A:

  1. Open /app/shield.
  2. Select mUSDC and click its faucet button.
  3. Select mWETH and click its faucet button.
  4. Shield approximately:
      - 10 mUSDC
      - 2 mWETH

  5. Confirm the public balance decreases.
  6. Confirm the confidential balance appears sealed as ●●●●.
  7. Click Decrypt and approve the wallet signature.
  8. Confirm the decrypted amount is correct.

  The intent system currently does not debit these confidential balances. Shielding and intent settlement are
  separate MVP flows, so test both even though one does not fund the other.

  ### 3. Auditor/observer flow

  Using Wallet A:

  1. Open /app/auditor.
  2. Grant Wallet B observer access for c-mUSDC.
  3. Return to /app/shield.
  4. Shield another 1 mUSDC. This balance update creates a handle that Wallet B can access.

  Using Wallet B:

  5. Open /app/auditor.
  6. In “Auditor view,” enter Wallet A’s address.
  7. Select c-mUSDC.
  8. Click “View as auditor” and sign.
  9. Confirm Wallet B can decrypt Wallet A’s balance.

  Then test revocation:

  10. With Wallet A, revoke Wallet B.
  11. Shield another small amount to create a new balance handle.
  12. With Wallet B, try decrypting again.
  13. Confirm access fails for the new handle.

  ### 4. Open an epoch

  Using Wallet A:

  1. Open /app/epoch.
  2. Click “Open epoch.”
  3. Confirm a new epoch appears with a 60-second countdown.

  ### 5. Test cancellation

  Before submitting the main matching intents:

  1. Using Wallet A, submit a small Buy intent such as 0.1 mWETH.
  2. Open /app/fills.
  3. Cancel that intent while the epoch remains open.
  4. Confirm its state changes to cancelled.

  This cancelled intent should not affect settlement.

  ### 6. Submit perfectly matching intents

  A perfect net is currently the reliable Sepolia path.

  Using Wallet A:

  - Side: Buy mWETH
  - Amount: 1
  - Limit: leave blank

  Using Wallet B:

  - Side: Sell mWETH
  - Amount: 1
  - Limit: leave blank

  Make sure the amounts are exactly equal. Confirm the epoch shows two active sealed intents, excluding the
  cancelled one.

  ### 7. Close and prepare

  1. Wait for the 60-second epoch timer to expire.
  2. Using either wallet, click “Close epoch.”
  3. Confirm the epoch becomes Closed.
  4. Using either wallet, click “Prepare settlement.”
  5. Confirm the settlement becomes Prepared.

  Close and prepare are permissionless after the relevant lifecycle conditions.

  ### 8. Finalize using Wallet A

  1. Connect Wallet A.
  2. Click “Finalize settlement.”
  3. Approve the residual-decryption signature.
  4. Approve the settlement transaction.
  5. Confirm the epoch becomes Settled.
  6. Confirm the UI reports “Perfect net.”
  7. Confirm no residual Uniswap swap occurred.

  Only Wallet A can finalize because it owns the settlement engine.

  ### 9. Decrypt fills

  Using Wallet A:

  1. Open /app/fills.
  2. Find the Buy intent.
  3. Click Decrypt.
  4. Confirm it received mWETH and paid mUSDC.

  Using Wallet B:

  5. Open /app/fills.
  6. Find the Sell intent.
  7. Click Decrypt.
  8. Confirm it paid mWETH and received mUSDC.

  Refresh both pages and confirm the history remains. It should be reconstructed from chain events.

  ### 10. Unshield

  Using Wallet A:

  1. Open /app/shield.
  2. Select a token with a confidential balance.
  3. Click Unshield.
  4. Confirm the unwrap transaction.
  5. Wait for the Zama KMS/oracle finalization.
  6. Refresh and confirm the public balance eventually increases.

  Unshielding is asynchronous, so the public balance may not update immediately.

  ## Optional failure-path test

  After completing the successful flow, open another epoch and submit unequal amounts:

  - Wallet A: Buy 1 mWETH
  - Wallet B: Sell 0.5 mWETH

  This creates a non-zero residual. On the current Sepolia deployment, finalization is expected to mark the epoch
  Failed because the residual Uniswap path is not operational. The UI should report this honestly without displaying
  a successful fill.

  One configuration detail: the private key in .env currently lacks the 0x prefix. Add it before using the Hardhat
  operator scripts, without sharing or committing the key.
