# Sentinel Personal Auto-Trader — Handoff Doc v2

## Philosophy

Test the base bot first. Get it running, understand how it actually behaves in dry run mode, evaluate the results. Only add complexity (Sentinel signals, lag detection, custom tiers) after the base bot has proven itself worth building on.

The only additions from day one are:
- Order slice detection — prevents copying the same position 15 times
- Daily digest email (so you know what happened without watching it all day)
- Auto-pause at configurable trade milestone (so you can evaluate before it keeps going)
- Configurable take-profit on Smart Money trades
- AI pre-trade analysis toggle (off by default)

Everything else — risk management, position sizing, strategy logic — use what MrFadiAi already built. It's better than what we'd build from scratch.

---

## Phase Structure

```
Phase 1 — Base bot, dry run only
  Get it running. Let it trade in simulation.
  100 trades → pause → evaluate.

Phase 2 — Base bot, small real money
  $50 real capital if Phase 1 results look good.
  Another 100 trades → pause → evaluate.

Phase 3 — Add Sentinel signal layer
  Feed your anomaly detection into Smart Money strategy.
  Compare results vs base bot.

Phase 4 — Add lag detection
  Correlated market lag as additional signal source.

Phase 5 — Live with real capital
  Only if Phases 1-4 are demonstrably profitable.
```

Do not skip phases. Do not go to Phase 2 until Phase 1 data is reviewed.

---

## The Base Bot — MrFadiAi/Polymarket-bot v3.1

**GitHub:** https://github.com/MrFadiAi/Polymarket-bot
**License:** MIT
**Stack:** Node.js, TypeScript

### What it already provides (do not rebuild any of this)

- **Dry run mode** — `DRY_RUN=true` in `.env`. Full simulation, no real money.
- **Dashboard** — built React app, runs at `localhost:3001`. Real-time P&L, risk status, strategy toggles, emergency stop.
- **4-layer risk management** — daily 5%, monthly 15%, drawdown 25%, total halt 40%.
- **Dynamic position sizing** — base 2% of capital. Reduces 20% per consecutive loss. Increases 10% per consecutive win (capped at 5%).
- **4 strategies** — Arbitrage, DipArb, Smart Money, Direct Trading. Toggle each independently.
- **Smart money filtering** — 60%+ win rate, $500+ total PnL, 1.5x profit factor, 70%+ consistency score, whale trade detection.
- **Emergency stop and panic sell** — one click in dashboard.

### What we add on top

- Order slice detection — deduplication for high-frequency wallets (Phase 1, day one)
- Sentinel signal API integration (Phase 3)
- Correlated market lag detection (Phase 4)
- Daily digest email (Phase 1, day one)
- Auto-pause at configurable trade milestone (Phase 1, day one)
- Configurable take-profit (Phase 1, day one)
- AI pre-trade analysis (Phase 1, optional, off by default)

---

## Order Slice Detection — Critical for High-Frequency Wallets

**This is the most important thing to add before running Smart Money.**

Top Polymarket wallets (the ones worth following) don't place one clean trade per market. They slice large orders into dozens or hundreds of small transactions on the same market within minutes to minimize price impact. Without deduplication your bot would copy all 15 fills as 15 separate trades, deploying 30% of your capital into one market and completely breaking your position sizing.

**What you saw in the screenshots:**

Wallet "Latina" placed 15+ transactions on "Spread: Spain (-2.5)" all within 2-3 minutes ranging from $4.51 to $428,239.74. This is ONE trading decision executed as hundreds of fills working through the orderbook. Not 15 separate signals.

Wallet "0x2c33..." placed 5+ fills on "Will IR Iran vs. New Zealand end in a draw?" all within 2 hours at identical odds (71¢). Again one decision, many fills.

**The deduplication rule:**

```typescript
// src/slice-detector.ts

interface RecentEntry {
  walletAddress: string;
  marketId: string;
  firstSeenAt: Date;
  fillCount: number;
}

const recentEntries = new Map<string, RecentEntry>();
const DEDUP_WINDOW_MINUTES = 5;

export function isOrderSlice(
  walletAddress: string,
  marketId: string
): boolean {
  const key = `${walletAddress}:${marketId}`;
  const existing = recentEntries.get(key);

  if (!existing) {
    // First fill on this wallet+market combo — record it, allow entry
    recentEntries.set(key, {
      walletAddress,
      marketId,
      firstSeenAt: new Date(),
      fillCount: 1,
    });
    return false; // not a slice, enter the trade
  }

  const minutesSinceFirst =
    (Date.now() - existing.firstSeenAt.getTime()) / 60000;

  if (minutesSinceFirst <= DEDUP_WINDOW_MINUTES) {
    // Same wallet, same market, within window — this is a slice
    existing.fillCount++;
    console.log(
      `[SLICE DETECTED] ${walletAddress.slice(0, 8)}... ` +
      `on market ${marketId} — fill #${existing.fillCount}, skipping`
    );
    return true; // is a slice, skip this fill
  }

  // Window expired — treat as new signal (wallet re-entering same market later)
  recentEntries.set(key, {
    walletAddress,
    marketId,
    firstSeenAt: new Date(),
    fillCount: 1,
  });
  return false;
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000;
  for (const [key, entry] of recentEntries.entries()) {
    if (entry.firstSeenAt.getTime() < cutoff) {
      recentEntries.delete(key);
    }
  }
}, 10 * 60 * 1000);
```

Wire into Smart Money trade handler — call `isOrderSlice()` before any copy trade logic. If it returns true, log it and skip. If false, proceed normally.

**Log slices in the digest email:**

Add a "Slices Detected" section to the daily digest showing how many fills were skipped as slices per wallet. This tells you how active the followed wallets are and confirms the deduplication is working correctly.

---

## Wallet Behavior Notes — What You're Actually Following

Understanding how top Polymarket bots operate helps you configure your bot correctly.

**How they size positions:**

Top wallets use Kelly Criterion or a variant — position size scales with conviction, not a fixed percentage. High confidence signal → large fraction of bankroll. Low confidence → small. This is why you see $428k and $4.51 from the same wallet on the same market — the large fill is the bulk of the position, the small ones are the tail end hitting thin liquidity.

**Implication for you:** You don't need to match their sizing strategy. Your fixed 2% + dynamic sizing is appropriate for your capital level. Just enter once per signal.

**How they enter:**

Split orders / order slicing to minimize price impact. One decision → hundreds of transactions. The base bot's deduplication (above) handles this.

**Latency matters:**

These bots enter within seconds of detecting a signal. Your copy enters with some lag (polling interval + processing time). For sports markets that move fast, check in dry run whether your entry prices are close to the wallet's first fill price or significantly worse. If you're consistently entering 5-10 points after them on fast markets, you need a faster polling interval.

**What "hundreds of trades per day" actually means:**

A wallet making 200+ trades per day is almost certainly running 5-20 actual market decisions per day, each sliced into 10-50 fills. When you follow them with deduplication you're making 5-20 copy trades per day — manageable and what your position sizing is built around.

---

## Return Projections — Realistic Numbers

Based on the dynamic position sizing the base bot uses, starting at $100.

**Key variables:**
- Break-even win rate at 20% take-profit / 40% stop-loss: **66.7%**
- You need above 67% to be clearly profitable

| Win Rate | 100 Trades | 500 Trades | Notes |
|---|---|---|---|
| 60% | -$5 to -$8 | -$20 to -$35 | Losing money — wallet quality too low |
| 65% | ~flat | +$3 to +$8 | Breakeven — marginally viable |
| 70% | +$7 | +$47 | Profitable — good wallet quality |
| 75% | +$14 | +$90 | Strong — excellent wallet quality |

**500 trades is where compounding starts to show.** 100 trades has too much variance to draw conclusions — a lucky or unlucky streak skews the result.

**On arbitrage math:**

At 2% fail rate and 1.5% profit margin, arbitrage is slightly unprofitable at $100 capital because gas fees eat the margin on small positions. Arbitrage becomes meaningful at $500+ capital where positions are large enough that gas is negligible. Leave arbitrage off in Phase 1 and reassess after seeing real dry run data on what fail rate and margins actually look like.

**Compounding at 70% win rate, 500 trades:**

```
Starting: $100
After 500 trades: ~$147
After 1,000 trades: ~$216
After 2,000 trades: ~$466
```

Not exciting headline numbers but consistent and provable. The real value of Phase 1 is establishing the actual win rate — not making money.

---

### Which strategies to enable and when

**Phase 1 — Start with Smart Money only**

Smart Money is the most relevant to your Sentinel work. It follows top leaderboard traders who pass strict quality filters. This is the closest thing to what you're trying to build — acting on smart signals from observed market behavior.

Enable: Smart Money ✅
Disable: Arbitrage ❌, DipArb ❌, Direct Trading ❌

Run this alone for the first 50 trades. You want clean data on one strategy before mixing signals.

**After 50 trades — add Arbitrage**

Arbitrage is mathematically low risk. When YES + NO < $1.00, buying both sides guarantees profit when the market resolves. The risk is gas fees eating into small profits.

Enable: Smart Money ✅, Arbitrage ✅
Disable: DipArb ❌, Direct Trading ❌

**DipArb — hold off**

DipArb watches for panic selling in 15-minute BTC/ETH Polymarket markets specifically (not the actual crypto price crashing — these are short-window prediction markets). It's more contained than it sounds but adds noise to your data in Phase 1. Leave it off until Phase 2.

**Direct Trading — manual only**

This is for you to manually place trades when you spot something. Not automated. Use it if you see a signal and want to act on it manually while the bot runs in the background.

### Position sizing — what the bot actually does

```
Base capital: whatever you set CAPITAL_USD to
Base position size: 2% of capital

Example with CAPITAL_USD=100:
  Normal trade: $2.00
  After 3 consecutive losses: $2.00 × 0.8 × 0.8 × 0.8 = $1.02
  After 5 consecutive wins: $2.00 × 1.5 = $3.00 (capped at 5% = $5.00)
```

Multiple strategies run simultaneously. Each takes its own 2% position independently. So if Smart Money and Arbitrage both fire at the same time you could have $2 in each — $4 deployed total.

### Honest return expectations

Arbitrage edges are fractions of a percent per trade. Smart Money returns depend entirely on who it's following. 5-10% daily is not realistic — professional quant funds target 20-30% annually. A good month might be 5-15% total.

The value of Phase 1 is not making money. It's learning whether the bot's signals have any edge at all before you put real money in.

---

## Setup

### Step 1 — Fork the repo

Go to https://github.com/MrFadiAi/Polymarket-bot and click Fork. Make it **private**. You need a private fork because:
- Your `.env` file with real credentials must never be public
- You'll add Sentinel integration code later that's personal
- Railway deploys from GitHub — needs to be your repo

```bash
git clone https://github.com/YOURUSERNAME/Polymarket-bot.git
cd Polymarket-bot
```

### Step 2 — Install and build

```bash
npm install

cd dashboard
npm install
npm run build
cd ..
```

### Step 3 — Configure .env

Copy `.env.example` to `.env` and fill in:

```
# Wallet — required even in dry run to verify connection
POLYMARKET_PRIVATE_KEY=0xYourPrivateKeyHere

# Start in dry run, small capital
CAPITAL_USD=100
DRY_RUN=true

# Risk management — use these defaults for Phase 1
DAILY_MAX_LOSS_PCT=0.05
MONTHLY_MAX_LOSS_PCT=0.15
MAX_DRAWDOWN_PCT=0.25
TOTAL_MAX_LOSS_PCT=0.40

# Added by us — digest email
RESEND_API_KEY=re_xxxx...
DIGEST_EMAIL=your@email.com
DIGEST_HOUR=7
TZ=America/New_York

# Added by us — auto-pause
BOT_PAUSED=false
TRADE_MILESTONE=100
```

### Step 4 — Test locally first

```bash
npx tsx bot-with-dashboard.ts
```

Dashboard opens at `http://localhost:3001`. Confirm:
- Connection verified (wallet connects even in dry run)
- Dry run mode indicator showing green
- Smart Money strategy enabled, others disabled
- Risk status panel showing all green

Leave it running locally for 24-48 hours before deploying to Railway. Catch any issues while you can see the logs directly.

---

## Phase 1 Additions — Two New Files + Take-Profit + AI Analysis

Four things to add to the base bot in Phase 1:
1. Daily digest email
2. Auto-pause at 100 trades
3. Configurable take-profit on Smart Money trades
4. AI pre-trade analysis (optional, can enable/disable)

---

## Take-Profit — Configurable via Dashboard

The base bot's Smart Money strategy copies wallet entries but has no take-profit logic — it holds until the position resolves or hits the stop-loss. Add a configurable take-profit that exits when a position reaches a target return percentage.

**Why this matters for sports markets especially:**
Sports markets move fast and decisively. When the result becomes clear the market jumps quickly. A 20% take-profit captures that move before the market fully reprices, without waiting for full resolution.

**Dashboard control:**
Add a slider/input to the existing dashboard UI so you can adjust the take-profit percentage without touching code or redeploying.

### Implementation

New file `src/take-profit.ts`:

```typescript
export interface TakeProfitConfig {
  enabled: boolean;
  targetPct: number;      // e.g. 20 = take profit at +20%
  applyToStrategies: string[];  // ['smartMoney'] — not arbitrage
}

export async function monitorPositionForTakeProfit(
  trade: ActiveTrade,
  config: TakeProfitConfig
): Promise<void> {
  if (!config.enabled) return;
  if (!config.applyToStrategies.includes(trade.strategy)) return;

  const currentOdds = await getMarketOdds(trade.marketId);
  const currentReturn = ((currentOdds - trade.entryOdds) / trade.entryOdds) * 100;

  if (currentReturn >= config.targetPct) {
    await closePosition(trade, `take_profit_${config.targetPct}pct`);
    console.log(`[TAKE PROFIT] ${trade.market} +${currentReturn.toFixed(1)}% — target was ${config.targetPct}%`);
  }
}
```

### Dashboard UI addition

Add to the existing dashboard React component a take-profit control panel:

```tsx
// In dashboard/src/components/TakeProfitPanel.tsx
function TakeProfitPanel({ config, onChange }) {
  return (
    <div className="panel">
      <h3>Take Profit</h3>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={e => onChange({ ...config, enabled: e.target.checked })}
        />
        Enable take-profit
      </label>
      <div>
        <label>Target return: {config.targetPct}%</label>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={config.targetPct}
          onChange={e => onChange({ ...config, targetPct: parseInt(e.target.value) })}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>5% (quick exit)</span>
          <span>50% (let it run)</span>
          <span>100% (near resolution)</span>
        </div>
      </div>
      <p style={{ color: '#6b6b80', fontSize: 12 }}>
        Applies to Smart Money trades only. Arbitrage holds to resolution.
      </p>
    </div>
  );
}
```

Config persisted to a local JSON file so it survives bot restarts:

```typescript
// src/config-store.ts
const CONFIG_PATH = './data/runtime-config.json';

export function loadRuntimeConfig(): RuntimeConfig {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {
    takeProfit: { enabled: true, targetPct: 20, applyToStrategies: ['smartMoney'] },
    aiAnalysis: { enabled: false, minConfidence: 'medium' },
    botPaused: false,
  };
}

export function saveRuntimeConfig(config: RuntimeConfig): void {
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

**Note on arbitrage:** Do NOT add take-profit to arbitrage trades. Arb positions must hold to resolution — that's when the mathematical guarantee pays out. Selling one leg early breaks the hedge.

---

## AI Pre-Trade Analysis Layer

An optional layer that evaluates a proposed trade before the bot enters it. The AI checks current context — news, external odds, recent developments — and returns a simple ENTER or SKIP signal.

Best suited for:
- Sports markets (injury news, form, Vegas line comparison)
- Politics markets (recent polling, news events)
- Less useful for pure arbitrage (mathematical, not contextual)

### How it works

```
Wallet makes a trade
  ↓
Bot identifies it as a copy candidate
  ↓
AI analysis runs (2-3 seconds)
  ↓
ENTER → bot copies the trade
SKIP  → bot logs it but doesn't enter
  ↓
Result tracked in attribution
(did AI-approved trades outperform AI-skipped ones?)
```

### Implementation

New file `src/ai-analysis.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AIAnalysisResult {
  decision: 'enter' | 'skip';
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function analyzeTradeWithAI(
  trade: ProposedTrade,
  enabled: boolean
): Promise<AIAnalysisResult> {
  // If disabled, always enter (don't block trades)
  if (!enabled) {
    return { decision: 'enter', reason: 'AI analysis disabled', confidence: 'high' };
  }

  const prompt = `
You are analyzing a prediction market trade on Polymarket.

Market: "${trade.marketTitle}"
A tracked wallet (${trade.walletWinRate}% win rate) just bought ${trade.side.toUpperCase()} at ${trade.entryOdds}¢
This implies a ${trade.entryOdds}% probability of the YES outcome.

Analyze whether this trade makes sense to copy. Consider:
- Does the implied probability seem reasonable given what you know?
- Is there any obvious reason this might be a bad entry?
- Is the market category (sports/politics/crypto/economics) one where wallet following adds value?

Respond in exactly this format:
DECISION: ENTER or SKIP
CONFIDENCE: HIGH, MEDIUM, or LOW  
REASON: One sentence explanation (max 20 words)
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const lines = text.trim().split('\n');

    const decisionLine = lines.find(l => l.startsWith('DECISION:')) ?? '';
    const confidenceLine = lines.find(l => l.startsWith('CONFIDENCE:')) ?? '';
    const reasonLine = lines.find(l => l.startsWith('REASON:')) ?? '';

    const decision = decisionLine.includes('ENTER') ? 'enter' : 'skip';
    const confidence = confidenceLine.includes('HIGH') ? 'high'
      : confidenceLine.includes('LOW') ? 'low' : 'medium';
    const reason = reasonLine.replace('REASON:', '').trim();

    return { decision, reason, confidence };

  } catch (err) {
    // On API error, default to enter — don't block trades due to AI failure
    console.warn('[AI ANALYSIS] Failed, defaulting to enter:', err);
    return { decision: 'enter', reason: 'AI analysis failed — defaulting to enter', confidence: 'low' };
  }
}
```

### Attribution tracking for AI decisions

Track whether AI-approved trades outperform AI-skipped ones — this is how you prove whether the layer adds value:

```sql
-- Add to bot_trades table
ai_decision TEXT,      -- 'enter' | 'skip' | 'disabled'
ai_confidence TEXT,    -- 'high' | 'medium' | 'low'
ai_reason TEXT         -- one sentence from AI
```

After 100 trades compare:
```
AI-approved trades:  win rate X%, avg return Y%
AI-skipped trades:   win rate X%, avg return Y%
                     (trades the bot would have taken but AI blocked)
```

If AI-approved trades outperform what AI-skipped trades would have been, the layer adds value. If not, disable it.

### Dashboard toggle

Add to dashboard alongside take-profit panel:

```tsx
function AIAnalysisPanel({ config, onChange }) {
  return (
    <div className="panel">
      <h3>AI Pre-Trade Analysis</h3>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={e => onChange({ ...config, enabled: e.target.checked })}
        />
        Enable AI analysis (Claude claude-sonnet-4-6)
      </label>
      {config.enabled && (
        <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 8 }}>
          Adds ~2-3 seconds latency per trade. May miss fast-moving opportunities.
        </p>
      )}
      <p style={{ color: '#6b6b80', fontSize: 12 }}>
        Analyzes each Smart Money trade before entry. SKIP decisions are logged
        but not entered — review them to evaluate accuracy.
      </p>
    </div>
  );
}
```

### Cost

Claude claude-sonnet-4-6 API: ~$0.003 per analysis
At 10 trades/day: ~$0.03/day, ~$0.90/month
Negligible at this scale.

Add to Railway env vars when enabling:
```
ANTHROPIC_API_KEY=sk-ant-xxxx...
```

### Important caveat on sports markets

AI analysis of sports markets is only as good as the context it has. Claude's training has a cutoff date and doesn't know tonight's injury report. For sports specifically the analysis will be limited to:

- General team quality and historical context
- Whether the implied probability seems in the right ballpark
- Obvious red flags (e.g. betting YES on a massive underdog at 45¢)

It will NOT know:
- Today's injury news
- Current team form
- Tonight's starting lineups

For sports to work well with AI analysis you'd need to feed in a live sports data source (ESPN API, The Odds API, etc.) as additional context in the prompt. That's a Phase 4 enhancement. For Phase 1 keep AI analysis off for sports markets or treat it as a rough sanity check only.

---

This is the one new file to add to the base bot. Everything else in Phase 1 uses MrFadiAi's existing code.

Create `src/digest.ts`:

```typescript
import { Resend } from 'resend';
import * as fs from 'fs';

const resend = new Resend(process.env.RESEND_API_KEY!);

interface TradeRecord {
  id: string;
  market: string;
  strategy: string;
  side: string;
  entryPrice: number;
  exitPrice?: number;
  pnlPct?: number;
  pnlUsd?: number;
  status: 'open' | 'closed';
  exitReason?: string;
  openedAt: string;
  closedAt?: string;
}

export async function sendDailyDigest(trades: TradeRecord[], balance: number, startBalance: number): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateLabel = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const closed = trades.filter(t => t.status === 'closed');
  const open = trades.filter(t => t.status === 'open');
  const wins = closed.filter(t => (t.pnlUsd ?? 0) > 0);
  const losses = closed.filter(t => (t.pnlUsd ?? 0) <= 0);
  const dayPnl = closed.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const totalPnl = balance - startBalance;
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;

  const closedRows = closed.map(t => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;">${t.market}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;">${t.strategy}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;color:${(t.pnlPct ?? 0) >= 0 ? '#22c55e' : '#ef4444'}">
        ${(t.pnlPct ?? 0) >= 0 ? '+' : ''}${(t.pnlPct ?? 0).toFixed(1)}%
      </td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;color:${(t.pnlUsd ?? 0) >= 0 ? '#22c55e' : '#ef4444'}">
        ${(t.pnlUsd ?? 0) >= 0 ? '+' : ''}$${Math.abs(t.pnlUsd ?? 0).toFixed(2)}
      </td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;color:#6b6b80;">${t.exitReason ?? '—'}</td>
    </tr>
  `).join('');

  const openRows = open.map(t => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;">${t.market}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;">${t.strategy}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;">$${t.entryPrice.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #2a2a38;color:#6b6b80;">Pending</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background:#0c0c11;color:#eeeef2;font-family:'DM Sans',sans-serif;padding:32px;max-width:640px;margin:0 auto;">

      <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Sentinel Bot — Daily Digest</h1>
      <p style="color:#6b6b80;font-size:14px;margin-bottom:32px;">${dateLabel}</p>

      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">Portfolio Summary</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><div style="font-size:11px;color:#6b6b80;">Current Balance</div><div style="font-size:22px;font-weight:700;font-family:monospace;">$${balance.toFixed(2)}</div></div>
          <div><div style="font-size:11px;color:#6b6b80;">Day P&L</div><div style="font-size:22px;font-weight:700;color:${dayPnl >= 0 ? '#22c55e' : '#ef4444'};font-family:monospace;">${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(2)}</div></div>
          <div><div style="font-size:11px;color:#6b6b80;">All-Time P&L</div><div style="font-size:16px;font-weight:600;color:${totalPnl >= 0 ? '#22c55e' : '#ef4444'};font-family:monospace;">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${((totalPnl / startBalance) * 100).toFixed(1)}%)</div></div>
          <div><div style="font-size:11px;color:#6b6b80;">Win Rate (lifetime)</div><div style="font-size:16px;font-weight:600;font-family:monospace;">${winRate}% (${wins.length}W / ${losses.length}L)</div></div>
        </div>
      </div>

      ${closed.length > 0 ? `
      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">Closed Positions Today (${closed.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="color:#6b6b80;font-size:11px;">
              <th style="text-align:left;padding-bottom:8px;">Market</th>
              <th style="text-align:left;padding-bottom:8px;">Strategy</th>
              <th style="text-align:left;padding-bottom:8px;">Return</th>
              <th style="text-align:left;padding-bottom:8px;">P&L</th>
              <th style="text-align:left;padding-bottom:8px;">Exit</th>
            </tr>
          </thead>
          <tbody>${closedRows}</tbody>
        </table>
      </div>
      ` : `
      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="color:#6b6b80;font-size:14px;margin:0;">No positions closed yesterday.</p>
      </div>
      `}

      ${open.length > 0 ? `
      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">Open Positions (${open.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="color:#6b6b80;font-size:11px;">
              <th style="text-align:left;padding-bottom:8px;">Market</th>
              <th style="text-align:left;padding-bottom:8px;">Strategy</th>
              <th style="text-align:left;padding-bottom:8px;">Entry</th>
              <th style="text-align:left;padding-bottom:8px;">Status</th>
            </tr>
          </thead>
          <tbody>${openRows}</tbody>
        </table>
      </div>
      ` : ''}

      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Mode</h2>
        <div style="display:inline-block;padding:4px 12px;border-radius:100px;background:${process.env.DRY_RUN === 'true' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};color:${process.env.DRY_RUN === 'true' ? '#22c55e' : '#ef4444'};font-size:12px;font-weight:600;">
          ${process.env.DRY_RUN === 'true' ? '🟢 DRY RUN' : '🔴 LIVE TRADING'}
        </div>
      </div>

      <p style="color:#4a4a5a;font-size:12px;text-align:center;margin-top:32px;">
        Sentinel Personal Bot · sentinalmarkets.com
      </p>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: 'noreply@sentinalmarkets.com',
    to: process.env.DIGEST_EMAIL!,
    subject: `Sentinel Bot — ${dateLabel} · ${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(2)} (${winRate}% win rate)`,
    html,
  });
}
```

Wire into the main bot via node-cron. Find the main entry point (`bot-with-dashboard.ts` or `index.ts`) and add:

```typescript
import cron from 'node-cron';
import { sendDailyDigest } from './src/digest';

// Send digest every morning at configured hour
cron.schedule(`0 ${process.env.DIGEST_HOUR ?? '7'} * * *`, async () => {
  const trades = await getAllTrades();     // use whatever trade retrieval exists in base bot
  const balance = await getCurrentBalance();
  const startBalance = parseFloat(process.env.CAPITAL_USD ?? '100');
  await sendDailyDigest(trades, balance, startBalance);
});
```

Install dependency:
```bash
npm install resend node-cron
npm install --save-dev @types/node-cron
```

---

## Auto-Pause at 100 Trades

Add this alongside the digest. Creates a checkpoint at every 100 completed trades so you evaluate before continuing.

Add to your main bot file or a new `src/milestone.ts`:

```typescript
let lastMilestoneChecked = 0;

export async function checkTradeMilestone(completedTradeCount: number): Promise<void> {
  const milestone = parseInt(process.env.TRADE_MILESTONE ?? '100');

  if (
    completedTradeCount > 0 &&
    completedTradeCount % milestone === 0 &&
    completedTradeCount !== lastMilestoneChecked
  ) {
    lastMilestoneChecked = completedTradeCount;
    await triggerMilestonePause(completedTradeCount);
  }
}

async function triggerMilestonePause(count: number): Promise<void> {
  console.log(`[MILESTONE] ${count} trades completed. Pausing for evaluation.`);

  // Set paused flag — check this before entering any new position
  process.env.BOT_PAUSED = 'true';

  // Send milestone email
  await sendMilestoneEmail(count);
}

export function isBotPaused(): boolean {
  return process.env.BOT_PAUSED === 'true';
}
```

Call `checkTradeMilestone()` every time a position closes in the base bot's trade completion handler.

Call `isBotPaused()` at the top of any new trade entry function — if true, skip.

**To resume:** Change `BOT_PAUSED=false` in Railway env vars. The bot checks this on its next cycle (within 30 seconds).

---

## Milestone Email

Separate from the daily digest — this fires immediately when the pause triggers:

```typescript
export async function sendMilestoneEmail(tradeCount: number): Promise<void> {
  // Pull stats from base bot's existing tracking
  const stats = await getLifetimeStats();

  await resend.emails.send({
    from: 'noreply@sentinalmarkets.com',
    to: process.env.DIGEST_EMAIL!,
    subject: `🔔 Sentinel Bot Paused — ${tradeCount} Trades Completed`,
    html: `
      <div style="background:#0c0c11;color:#eeeef2;font-family:sans-serif;padding:32px;max-width:560px;">
        <h1>Milestone Reached — ${tradeCount} Trades</h1>
        <p>The bot has paused new entries for evaluation. Open positions are still being managed.</p>

        <h2>Results So Far</h2>
        <p>Balance: $${stats.currentBalance.toFixed(2)} (started $${stats.startBalance.toFixed(2)})</p>
        <p>Total P&L: ${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)} (${stats.totalPnlPct.toFixed(1)}%)</p>
        <p>Win Rate: ${stats.winRate}% (${stats.wins}W / ${stats.losses}L)</p>
        <p>Best trade: ${stats.bestTrade}</p>
        <p>Worst trade: ${stats.worstTrade}</p>

        <h2>Questions to Ask Before Resuming</h2>
        <ul>
          <li>Is the win rate above 50%? If not, what's losing?</li>
          <li>Are specific strategies underperforming?</li>
          <li>Are losses concentrated in certain market categories?</li>
          <li>Is the position sizing appropriate?</li>
        </ul>

        <h2>To Resume</h2>
        <p>Go to Railway dashboard → Your bot service → Variables → Set BOT_PAUSED=false</p>
        <p>The bot resumes within 30 seconds.</p>

        <p style="color:#6b6b80;font-size:12px;">Mode: ${process.env.DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE'}</p>
      </div>
    `,
  });
}
```

---

## Railway Deployment (24/7)

### Why Railway over Docker

Docker gives you more control but requires managing a VPS, OS updates, container restarts, and port exposure yourself — same monthly cost (~$5) as Railway with significantly more maintenance. Railway auto-deploys from GitHub, handles restarts, and generates a public URL for the dashboard. Use Railway for this personal project.

### Setup

**1. Create a new Railway service**

In your existing Railway project (where Sentinel engine runs):
- New Service → GitHub Repo → select your private fork
- Keep it separate from the Sentinel engine service

**2. Add railway.json to your repo root**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd dashboard && npm run build && cd .. && npx tsx bot-with-dashboard.ts",
    "restartPolicyType": "always",
    "restartPolicyMaxRetries": 10
  }
}
```

**3. Set all environment variables in Railway dashboard**

```
POLYMARKET_PRIVATE_KEY=0xYourKeyHere
CAPITAL_USD=100
DRY_RUN=true
DAILY_MAX_LOSS_PCT=0.05
MONTHLY_MAX_LOSS_PCT=0.15
MAX_DRAWDOWN_PCT=0.25
TOTAL_MAX_LOSS_PCT=0.40
RESEND_API_KEY=re_xxxx...
DIGEST_EMAIL=your@email.com
DIGEST_HOUR=7
TZ=America/New_York
BOT_PAUSED=false
TRADE_MILESTONE=100
```

**4. Expose the dashboard**

Railway dashboard → your bot service → Settings → Networking → Generate Domain

This gives you a URL like `sentinel-bot.up.railway.app`. The dashboard at port 3001 is accessible from anywhere — your phone, work computer, anywhere.

Add basic auth so it's not publicly accessible:

```typescript
// Add to bot-with-dashboard.ts before starting the dashboard server
import basicAuth from 'express-basic-auth';
app.use(basicAuth({
  users: { 'erik': process.env.DASHBOARD_PASSWORD! },
  challenge: true,
}));
```

Add `DASHBOARD_PASSWORD=yourpassword` to Railway env vars.

```bash
npm install express-basic-auth
```

**5. Deploy**

Push to your private GitHub repo. Railway auto-builds and starts the bot. Check logs in Railway dashboard to confirm startup.

---

## VPS Deployment (DigitalOcean) — Use This Instead of Railway

Railway's available regions (US East, US West, Amsterdam, Singapore) are all geo-blocked by Polymarket as of early 2025 — the Netherlands banned Polymarket in March 2025, and the US has been blocked since launch. Use a DigitalOcean droplet in Frankfurt or London instead.

**Why DigitalOcean over Railway here:**
Railway doesn't offer Frankfurt or London regions. DigitalOcean does. Frankfurt (Germany) and London (UK) are both Polymarket-accessible. Cost is similar (~$6/month).

### Setup

**1. Create a droplet**

- Go to cloud.digitalocean.com → Create → Droplets
- **Region:** Frankfurt (fra1) or London (lon1)
- **OS:** Ubuntu 24.04 LTS
- **Plan:** Basic → Regular → $6/month (1 vCPU, 1GB RAM, 25GB SSD) — sufficient for the bot
- **Authentication:** SSH key (add your public key) or password
- Create the droplet, note the IP address

**2. SSH in and install Node.js**

```bash
ssh root@YOUR_DROPLET_IP

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 (process manager — keeps bot running after reboots)
npm install -g pm2

# Verify
node --version   # should be v20.x
npm --version
```

**3. Clone your repo and install dependencies**

```bash
cd /root
git clone https://github.com/ErikMichael97/Polymarket-bot.git
cd Polymarket-bot

npm install

cd dashboard
npm install
npm run build
cd ..
```

**4. Create your .env file on the droplet**

```bash
nano .env
```

Paste your full `.env` contents (private key, capital, DRY_RUN=true, etc.), save with Ctrl+X → Y → Enter.

**5. Open port 3001 in the firewall**

```bash
ufw allow 3001
ufw allow OpenSSH
ufw enable
```

**6. Start the bot with PM2**

```bash
pm2 start "npx tsx bot-with-dashboard.ts" --name sentinel-bot
pm2 save
pm2 startup   # run the command it prints to auto-start on reboot
```

**7. Check it's running**

```bash
pm2 logs sentinel-bot    # live log stream
pm2 status               # should show 'online'
```

Dashboard is now at `http://YOUR_DROPLET_IP:3001` — accessible from anywhere.

**8. Add the droplet IP to Vercel**

In Vercel → sentinal project → Settings → Environment Variables:
- Key: `NEXT_PUBLIC_BOT_URL`
- Value: `http://YOUR_DROPLET_IP:3001`

Redeploy Vercel. The sentinalmarkets.com/bot page will connect to the droplet.

> **Note on HTTPS:** The dashboard URL above is plain HTTP. For production (Phase 2+), set up nginx as a reverse proxy with a free Let's Encrypt SSL cert so the WebSocket connection is `wss://` instead of `ws://`. Not required for dry run but browsers may warn about mixed content when connecting from your HTTPS Vercel site. If you hit that issue, ping me and we'll add nginx.

### Useful PM2 commands

```bash
pm2 restart sentinel-bot   # restart after code changes
pm2 stop sentinel-bot      # pause the bot
pm2 logs sentinel-bot      # tail live logs
pm2 status                 # health overview
```

### Updating the bot

When you push changes to GitHub, pull them on the droplet and restart:

```bash
cd /root/Polymarket-bot
git pull
cd dashboard && npm run build && cd ..
pm2 restart sentinel-bot
```

---

## Phase 1 Checklist

Before moving to Phase 2 (real money) all of these should be true:

- [ ] Bot runs 24/7 on DigitalOcean droplet without crashing
- [ ] Dashboard accessible at droplet IP:3001
- [ ] Daily digest email arriving every morning
- [ ] 100 trades completed (milestone email received)
- [ ] Win rate above 50% in dry run
- [ ] No unexpected behavior in the logs
- [ ] You understand which trades won and why
- [ ] You understand which trades lost and why

Do not put real money in until every box is checked.

---

## Phase 2 — Small Real Money ($50)

When Phase 1 checklist is complete:

1. Fund a **dedicated Polymarket wallet** — not your main wallet. $50 + a few dollars MATIC for gas.
2. Change in Railway env vars:
   ```
   DRY_RUN=false
   CAPITAL_USD=50
   POLYMARKET_PRIVATE_KEY=0xYourDedicatedWalletKey
   ```
3. Railway restarts the bot within 30 seconds. No redeployment needed.
4. Reset your milestone counter — another 100 trades before evaluating real money results.

**Position sizes at $50 capital:**
```
Base trade: $50 × 2% = $1.00 per position
After 3 losses: ~$0.51 per position
After 5 wins: $1.50 per position (capped at $2.50)
```

Small but real. The emotional difference between dry run and live is significant even at these amounts.

---

## Phase 3 — Adding Sentinel Signals (future)

Only start this phase after Phase 2 produces at least 100 trades with positive results.

The Sentinel integration is an additional signal source layered on top of Smart Money. It doesn't replace Smart Money — it either confirms it or adds new entries the base bot wouldn't have caught.

**What to add:**

New file `src/sentinel-signals.ts`:

```typescript
export async function getSentinelSignals(): Promise<SentinelSignal[]> {
  const response = await fetch(
    'https://sentinalmarkets.com/api/v1/signals',
    {
      headers: {
        'Authorization': `Bearer ${process.env.SENTINEL_API_KEY}`,
      }
    }
  );
  const { signals } = await response.json();
  return signals.filter((s: SentinelSignal) => s.score >= 80);
}
```

Add `SENTINEL_API_KEY` to Railway env vars when ready.

Wire into the base bot's trade evaluation loop — if a market appears in both Smart Money signals AND Sentinel signals, treat it as higher conviction and optionally increase position size slightly.

---

## Phase 4 — Lag Detection (future)

Only after Phase 3 is running and producing data.

Correlated market lag detection — when one Polymarket market moves significantly, check related markets that haven't caught up yet.

Correlation groups to monitor:
- Fed Rate Cuts: related June/July/2025 markets
- US Election: President/Senate/House markets
- BTC Price: $100k/$120k/$150k threshold markets

Poll every 15 seconds (faster than standard 30-second signal poll — speed matters here).

Full spec for this phase is in the original SENTINEL_BOT_SPEC.md if needed.

---

## What NOT to Build in Phase 1

Do not spend time on these until Phase 2 is proven:

- Custom aggressiveness tiers (Safe/Medium/Aggressive) — use base bot strategies
- Custom position sizing logic — use their 2% dynamic sizing
- Custom risk management — use their 4-layer system
- Supabase persistence — base bot handles its own state
- sentinalmarkets.com/bot dashboard page — use Railway URL dashboard for now

The base bot is complete. Add complexity only when you have data proving more complexity is needed.

---

## Files to Add to Base Bot Repo

Five new files in Phase 1:

```
src/
  slice-detector.ts   Deduplication for high-frequency wallet slicing
  digest.ts           Daily email summary
  milestone.ts        Auto-pause at configurable trade count
  take-profit.ts      Configurable take-profit for Smart Money
  ai-analysis.ts      AI pre-trade analysis (disabled by default)
  config-store.ts     Runtime config persistence (JSON file)

dashboard/src/components/
  TakeProfitPanel.tsx   Dashboard slider for take-profit %
  AIAnalysisPanel.tsx   Dashboard toggle for AI analysis

data/
  runtime-config.json   Created automatically on first run

package additions:
  resend
  node-cron
  @anthropic-ai/sdk
  express-basic-auth
  @types/node-cron
```

---

## Quick Start Summary

```
1.  Fork https://github.com/MrFadiAi/Polymarket-bot → private repo
2.  Clone locally
3.  npm install
4.  cd dashboard && npm install && npm run build && cd ..
5.  Copy .env.example to .env, fill in private key + settings
6.  npm install resend node-cron @anthropic-ai/sdk express-basic-auth
7.  Add src/slice-detector.ts FIRST — wire into Smart Money handler
    before any other changes. This prevents copying sliced orders 15x.
8.  Add src/digest.ts, src/milestone.ts, src/take-profit.ts,
    src/ai-analysis.ts, src/config-store.ts
9.  Add dashboard panel components for take-profit and AI analysis
10. Wire all five into main bot file
11. Test locally: npx tsx bot-with-dashboard.ts
12. Confirm dashboard at localhost:3001
13. Enable Smart Money strategy only in dashboard
14. Set take-profit to 20% in dashboard panel
15. Leave AI analysis OFF initially
16. Let it run 24-48 hours locally — confirm slice detection firing
    in logs and digest email arrives next morning
17. Add railway.json, push to GitHub, connect to Railway
18. Set all env vars in Railway, generate public domain
19. Set TRADE_MILESTONE=100 for first evaluation,
    change to 500 after Phase 1 for longer-term data collection
20. Monitor via Railway URL dashboard
21. Wait for milestone email, evaluate, adjust, resume
22. Do not proceed to Phase 2 (real money) until milestone
    email shows win rate above 67%
```

---

## Disclaimer

Personal research tool. Automated trading involves real financial risk. Dry run first, always. Only fund a dedicated wallet with money you can afford to lose entirely. Never use your main Polymarket wallet. Past dry run performance does not guarantee live results.