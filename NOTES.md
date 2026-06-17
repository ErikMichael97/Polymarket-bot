# Bot To-Do Notes

## 1. Dynamic Position Sizing — Not Working
Currently every copy trade uses `CONFIG.capital.maxPerTradePct * CONFIG.capital.totalUsd` as a flat dollar amount (e.g. always $2 at 2% of $100). The README documents win/loss scaling (reduce 20% per consecutive loss, increase 10% per consecutive win, capped at 5%), but this logic only exists for direct/arbitrage strategies. The smart money copy trade path just uses the base `maxPerTradePct` directly and never applies the dynamic adjustment.

**Fix needed:** In the smart money callback, read `state.consecutiveLosses` and `state.consecutiveWins` and scale `ourCost` the same way the other strategies do before deducting from paper balance and recording the position.

---

## 2. Wallet Following Logic — Need to Investigate
Questions to answer by reading the leaderboard fetch code:
- How often does the bot re-query the leaderboard? (on startup only, or on a schedule?)
- If a better wallet joins the top list mid-session, does it get picked up without a restart?
- If a currently-followed wallet drops below the quality thresholds (60% win rate, $500 PnL, etc.), does it get dropped automatically?
- What is `topN: 20` — does the bot literally follow up to 20 wallets, or is it capped lower somewhere?
- The two hardcoded `customWallets` in CONFIG always get followed regardless of quality — worth verifying these are still good performers.

---

## 3. Custom Wallet Input in the Dashboard
The Controls panel sends `addWallet` / `removeWallet` commands and the bot handler exists for them, but the dashboard UI for it was never finished — the "followed wallets" card has no input box. Need to add a text field + Add button to the SmartMoneyPanel (or a separate card) so wallets can be added live without editing the .env and restarting.
