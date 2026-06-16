import { Resend } from 'resend';
import { getSliceStats } from './slice-detector.js';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export interface DigestStats {
  currentBalance: number;
  startBalance: number;
  dailyPnL: number;
  totalPnL: number;
  tradesExecuted: number;
  followedWallets: number;
  dryRun: boolean;
}

export async function sendDailyDigest(stats: DigestStats): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.DIGEST_EMAIL) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateLabel = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const totalPnlPct = stats.startBalance > 0
    ? ((stats.totalPnL / stats.startBalance) * 100).toFixed(1)
    : '0.0';
  const slices = getSliceStats();

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background:#0c0c11;color:#eeeef2;font-family:'DM Sans',sans-serif;padding:32px;max-width:640px;margin:0 auto;">

      <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Sentinel Bot — Daily Digest</h1>
      <p style="color:#6b6b80;font-size:14px;margin-bottom:32px;">${dateLabel}</p>

      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">Portfolio Summary</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:11px;color:#6b6b80;">Current Balance</div>
            <div style="font-size:22px;font-weight:700;font-family:monospace;">$${stats.currentBalance.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b6b80;">Day P&L</div>
            <div style="font-size:22px;font-weight:700;color:${stats.dailyPnL >= 0 ? '#22c55e' : '#ef4444'};font-family:monospace;">
              ${stats.dailyPnL >= 0 ? '+' : ''}$${stats.dailyPnL.toFixed(2)}
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b6b80;">All-Time P&L</div>
            <div style="font-size:16px;font-weight:600;color:${stats.totalPnL >= 0 ? '#22c55e' : '#ef4444'};font-family:monospace;">
              ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)} (${stats.totalPnL >= 0 ? '+' : ''}${totalPnlPct}%)
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:#6b6b80;">Total Trades</div>
            <div style="font-size:16px;font-weight:600;font-family:monospace;">${stats.tradesExecuted}</div>
          </div>
        </div>
      </div>

      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Smart Money</h2>
        <p style="margin:0;font-size:14px;">Following <strong>${stats.followedWallets}</strong> qualified wallets</p>
        <p style="margin:8px 0 0;font-size:13px;color:#6b6b80;">
          Order slices skipped: <strong style="color:#eeeef2;">${slices.totalDetected}</strong>
          &nbsp;·&nbsp; Active dedup windows: <strong style="color:#eeeef2;">${slices.activeWindows}</strong>
        </p>
      </div>

      <div style="background:#13131a;border:1px solid #2a2a38;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="font-size:13px;color:#6b6b80;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Mode</h2>
        <div style="display:inline-block;padding:4px 12px;border-radius:100px;background:${stats.dryRun ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};color:${stats.dryRun ? '#22c55e' : '#ef4444'};font-size:12px;font-weight:600;">
          ${stats.dryRun ? 'DRY RUN (Simulation)' : 'LIVE TRADING'}
        </div>
      </div>

      <p style="color:#4a4a5a;font-size:12px;text-align:center;margin-top:32px;">
        Sentinel Personal Bot · sentinalmarkets.com
      </p>
    </body>
    </html>
  `;

  await getResend().emails.send({
    from: 'noreply@sentinalmarkets.com',
    to: process.env.DIGEST_EMAIL,
    subject: `Sentinel Bot — ${dateLabel} · ${stats.dailyPnL >= 0 ? '+' : ''}$${stats.dailyPnL.toFixed(2)} · ${stats.tradesExecuted} trades`,
    html,
  });
}
