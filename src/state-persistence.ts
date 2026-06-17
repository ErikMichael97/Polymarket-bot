import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const STATE_FILE = join(DATA_DIR, 'bot-state.json');

export interface PersistedState {
  savedAt: string;
  tradesExecuted: number;
  totalPnL: number;
  dailyPnL: number;
  monthlyPnL: number;
  wins: number;
  losses: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  smartMoneyTrades: number;
  arbTrades: number;
  dipArbTrades: number;
  directTrades: number;
  arbProfit: number;
  peakCapital: number;
  currentCapital: number;
  currentDrawdown: number;
  permanentlyHalted: boolean;
  monthStartTime: number;
  lastDailyReset: number;
  paperBalance: number | null;
  paperInitialBalance: number | null;
  paperPnL: number | null;
  paperTrades: number | null;
  paperPositions: unknown[];
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function saveState(s: PersistedState): void {
  try {
    ensureDataDir();
    writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('[StatePersist] Failed to save state:', err);
  }
}

export function loadPersistedState(): PersistedState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    const raw = readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedState;
    console.log(`[StatePersist] Restored state from ${parsed.savedAt} (${parsed.tradesExecuted} trades, P&L $${parsed.totalPnL.toFixed(2)})`);
    return parsed;
  } catch (err) {
    console.error('[StatePersist] Failed to load state (starting fresh):', err);
    return null;
  }
}

export function deletePersistedState(): void {
  try {
    if (existsSync(STATE_FILE)) {
      writeFileSync(STATE_FILE, JSON.stringify({ deleted: true }));
    }
  } catch {}
}
