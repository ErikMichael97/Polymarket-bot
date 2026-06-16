import fs from 'fs';

const CONFIG_PATH = './data/runtime-config.json';

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

export function loadRuntimeConfig(): RuntimeConfig {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveRuntimeConfig(config: RuntimeConfig): void {
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
