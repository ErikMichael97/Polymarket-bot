import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Absolute path so this works regardless of PM2 working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const CONFIG_PATH = join(DATA_DIR, 'runtime-config.json');

export interface RuntimeConfig {
  takeProfit: {
    enabled: boolean;
    targetPct: number;
    applyToStrategies: string[];
  };
  botPaused: boolean;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  takeProfit: { enabled: true, targetPct: 20, applyToStrategies: ['smartMoney'] },
  botPaused: false,
};

// In-memory cache — updated immediately on save so canTrade() sees changes without file I/O
let _cache: RuntimeConfig | null = null;

export function loadRuntimeConfig(): RuntimeConfig {
  if (_cache) return _cache;
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      _cache = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
      return _cache;
    } catch {
      _cache = { ...DEFAULT_CONFIG };
      return _cache;
    }
  }
  _cache = { ...DEFAULT_CONFIG };
  return _cache;
}

export function saveRuntimeConfig(config: RuntimeConfig): void {
  _cache = config; // update in-memory immediately — next canTrade() call sees this
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
