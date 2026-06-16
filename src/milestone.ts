import { Resend } from 'resend';
import { saveRuntimeConfig, loadRuntimeConfig } from './config-store.js';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

let lastMilestoneChecked = 0;

export interface MilestoneStats {
  tradesExecuted: number;
  totalPnL: number;
  startBalance: number;
  currentBalance: number;
  dryRun: boolean;
}

export async function checkTradeMilestone(stats: MilestoneStats): Promise<void> {
  const milestone = parseInt(process.env.TRADE_MILESTONE ?? '100');
  const count = stats.tradesExecuted;

  if (
    count > 0 &&
    count % milestone === 0 &&
    count !== lastMilestoneChecked
  ) {
    lastMilestoneChecked = count;
    await triggerMilestonePause(count, stats);
  }
}

async function triggerMilestonePause(count: number, stats: MilestoneStats): Promise<void> {
  console.log(`[MILESTONE] ${count} trades completed. Pausing for evaluation.`);

  const runtimeConfig = loadRuntimeConfig();
  saveRuntimeConfig({ ...runtimeConfig, botPaused: true });

  await sendMilestoneEmail(count, stats);
}

export function isMilestonePaused(): boolean {
  return loadRuntimeConfig().botPaused;
}

async function sendMilestoneEmail(count: number, stats: MilestoneStats): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.DIGEST_EMAIL) return;

  const totalPnlPct = stats.startBalance > 0
    ? ((stats.totalPnL / stats.startBalance) * 100).toFixed(1)
    : '0.0';

  await getResend().emails.send({
    from: 'noreply@sentinalmarkets.com',
    to: process.env.DIGEST_EMAIL,
    subject: `Sentinel Bot Paused — ${count} Trades Completed`,
    html: `
      <div style="background:#0c0c11;color:#eeeef2;font-family:sans-serif;padding:32px;max-width:560px;">
        <h1 style="font-size:20px;font-weight:700;">Milestone Reached — ${count} Trades</h1>
        <p style="color:#6b6b80;">The bot has paused new entries for evaluation. Open positions are still being managed.</p>

        <h2 style="font-size:15px;font-weight:600;margin-top:24px;">Results So Far</h2>
        <p>Balance: <strong>$${stats.currentBalance.toFixed(2)}</strong> (started $${stats.startBalance.toFixed(2)})</p>
        <p>Total P&L: <strong style="color:${stats.totalPnL >= 0 ? '#22c55e' : '#ef4444'};">${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)} (${totalPnlPct}%)</strong></p>
        <p>Trades executed: <strong>${count}</strong></p>

        <h2 style="font-size:15px;font-weight:600;margin-top:24px;">Questions to Ask Before Resuming</h2>
        <ul style="color:#a0a0b0;">
          <li>Is the win rate above 50%? If not, what's losing?</li>
          <li>Are specific strategies underperforming?</li>
          <li>Are losses concentrated in certain market categories?</li>
          <li>Is position sizing appropriate for your capital?</li>
        </ul>

        <h2 style="font-size:15px;font-weight:600;margin-top:24px;">To Resume</h2>
        <p>Open the dashboard and click <strong>Resume Bot</strong> in the Strategy Controls panel.</p>

        <p style="color:#6b6b80;font-size:12px;margin-top:32px;">Mode: ${stats.dryRun ? 'DRY RUN' : 'LIVE'}</p>
      </div>
    `,
  });
}
