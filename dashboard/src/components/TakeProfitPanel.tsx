import { useState } from 'react';
import type { BotConfig } from '../types';

interface TakeProfitPanelProps {
  config: BotConfig | null;
  onUpdateConfig: (key: string, value: unknown) => void;
}

export function TakeProfitPanel({ config, onUpdateConfig }: TakeProfitPanelProps) {
  const [targetPct, setTargetPct] = useState<number>(config?.takeProfit?.targetPct ?? 20);
  const [enabled, setEnabled] = useState<boolean>(config?.takeProfit?.enabled ?? true);
  const botPaused = config?.botPaused ?? false;

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    onUpdateConfig('takeProfit', { enabled: newEnabled, pct: targetPct });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value);
    setTargetPct(pct);
    onUpdateConfig('takeProfit', { enabled, pct });
  };

  const handleResume = () => {
    if (window.confirm(`Resume bot after milestone pause?\n\nMake sure you've reviewed the results before continuing.`)) {
      onUpdateConfig('botPaused', false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="section-header mb-0">
          <div className="section-header-icon bg-gradient-to-br from-green-500/20 to-emerald-500/20">🎯</div>
          Take Profit
        </h3>
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${enabled ? 'bg-green-500' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="panel-body space-y-4">
        {botPaused && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="text-amber-400 text-sm font-medium mb-1">Milestone Pause Active</div>
            <div className="text-amber-300/70 text-xs mb-3">Bot has paused after reaching a trade milestone. Review results before resuming.</div>
            <button
              onClick={handleResume}
              className="w-full py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors"
            >
              Resume Bot
            </button>
          </div>
        )}

        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Target return</span>
            <span className="text-white font-mono font-medium">+{targetPct}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={targetPct}
            onChange={handleSliderChange}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>5% (quick exit)</span>
            <span>50%</span>
            <span>100% (hold)</span>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          Smart Money only. Arbitrage always holds to resolution.
        </div>
      </div>
    </div>
  );
}
