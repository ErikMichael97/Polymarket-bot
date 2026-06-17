import { useState } from 'react';
import type { BotConfig } from '../types';

interface TakeProfitPanelProps {
  config: BotConfig | null;
  onUpdateConfig: (key: string, value: unknown) => void;
}

export function TakeProfitPanel({ config, onUpdateConfig }: TakeProfitPanelProps) {
  const [targetPct, setTargetPct] = useState<number>(config?.takeProfit?.targetPct ?? 20);
  const [enabled, setEnabled] = useState<boolean>(config?.takeProfit?.enabled ?? true);
  const [tradeSize, setTradeSize] = useState<number>(
    Math.round((config?.capital?.maxPerTradePct ?? 0.02) * 100)
  );
  const [minCopyValue, setMinCopyValue] = useState<string>(
    String(config?.smartMoney?.minCopyValueUsd ?? 1000)
  );
  const botPaused = config?.botPaused ?? false;
  const capital = config?.capital?.totalUsd ?? 1000;

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

  const handleTradeSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    setTradeSize(pct);
    onUpdateConfig('tradeSize', pct / 100);
  };

  const handleMinCopyValueCommit = () => {
    const val = parseFloat(minCopyValue);
    if (!isNaN(val) && val >= 0) {
      onUpdateConfig('minCopyValue', val);
    } else {
      setMinCopyValue(String(config?.smartMoney?.minCopyValueUsd ?? 1000));
    }
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
          Controls
        </h3>
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${enabled ? 'bg-green-500' : 'bg-gray-700'}`}
          title="Toggle take-profit"
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

        {/* Min Copy Value */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Min copy value</span>
            <span className="text-xs text-gray-600">Only copy trades ≥ this</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-mono">$</span>
            <input
              type="number"
              min="0"
              step="100"
              value={minCopyValue}
              onChange={(e) => setMinCopyValue(e.target.value)}
              onBlur={handleMinCopyValueCommit}
              onKeyDown={(e) => e.key === 'Enter' && handleMinCopyValueCommit()}
              className="flex-1 bg-poly-dark border border-white/10 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500/50"
              placeholder="1000"
            />
          </div>
          <div className="text-xs text-gray-600 mt-1">Press Enter or click away to apply</div>
        </div>

        {/* Trade Size Slider */}
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Trade size</span>
            <span className="text-white font-mono font-medium">
              {tradeSize}% <span className="text-gray-500 text-xs">(${(capital * tradeSize / 100).toFixed(2)})</span>
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={tradeSize}
            onChange={handleTradeSizeChange}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0.5%</span>
            <span>2.5%</span>
            <span>5%</span>
          </div>
        </div>

        {/* Take Profit Slider */}
        <div className="border-t border-white/5 pt-3">
          <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Take profit target</span>
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
              <span>5%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          Take profit applies to Smart Money only.
        </div>
      </div>
    </div>
  );
}
