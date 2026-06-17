import { useState } from 'react';
import type { BotState } from '../types';

interface SmartMoneyPanelProps {
  state: BotState | null;
  onCommand: (command: string, payload: Record<string, unknown>) => void;
}

export function SmartMoneyPanel({ state, onCommand }: SmartMoneyPanelProps) {
  const signals = state?.smartMoneySignals ?? [];
  const followedWallets = state?.followedWallets ?? [];
  const trades = state?.smartMoneyTrades ?? 0;

  const [walletInput, setWalletInput] = useState('');
  const [inputError, setInputError] = useState('');

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleAddWallet = () => {
    const trimmed = walletInput.trim();
    if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
      setInputError('Must be a valid 0x address (42 chars)');
      return;
    }
    setInputError('');
    onCommand('updateConfig', { key: 'addWallet', value: trimmed });
    setWalletInput('');
  };

  const handleRemoveWallet = (wallet: string) => {
    onCommand('updateConfig', { key: 'removeWallet', value: wallet });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="section-header mb-0">
          <div className="section-header-icon bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            👛
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">Strategy 1</span>
            <span>Smart Money Tracker</span>
          </div>
        </h2>
        <div className="flex items-center gap-2">
          <span className="badge badge-purple">
            {followedWallets.length} wallets
          </span>
          <span className="badge badge-blue">
            {trades} copies
          </span>
        </div>
      </div>

      <div className="panel-body">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-poly-dark/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold font-mono text-purple-400">{followedWallets.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Tracking</div>
          </div>
          <div className="bg-poly-dark/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold font-mono text-blue-400">{signals.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Signals</div>
          </div>
          <div className="bg-poly-dark/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold font-mono text-green-400">{trades}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Copied</div>
          </div>
        </div>

        {/* Recent Signals */}
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Recent Whale Activity</span>
          <span className="text-gray-600">{signals.length} signals</span>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {signals.length === 0 ? (
            <div className="bg-poly-dark/30 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">🐋</div>
              <div className="text-gray-400">Monitoring whale wallets...</div>
              <div className="text-xs text-gray-500 mt-1">Signals appear when tracked wallets trade</div>
            </div>
          ) : (
            signals.slice(0, 10).map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between p-3 bg-poly-dark/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 font-mono w-16">
                    {formatTime(signal.timestamp)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                    <code className="text-purple-400 text-xs font-mono">
                      {shortenAddress(signal.wallet)}
                    </code>
                  </div>
                  <span
                    className={`badge text-xs ${
                      signal.side === 'BUY' ? 'badge-green' : 'badge-red'
                    }`}
                  >
                    {signal.side}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm truncate max-w-[180px]" title={signal.market}>
                    {signal.market.length > 25 ? signal.market.slice(0, 25) + '...' : signal.market}
                  </span>
                  <div className="text-right">
                    <div className="text-white font-mono font-medium">
                      ${signal.size.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      @{signal.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tracked Wallets */}
        <div className="divider" />
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Tracked Wallets
        </div>

        {followedWallets.length > 0 ? (
          <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
            {followedWallets.map((wallet) => (
              <div
                key={wallet}
                className="flex items-center justify-between px-3 py-2 bg-poly-dark/50 rounded-lg border border-white/5"
              >
                <code className="text-xs text-gray-300 font-mono">{shortenAddress(wallet)}</code>
                <button
                  onClick={() => handleRemoveWallet(wallet)}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-600 mb-4 text-center py-3">
            No wallets followed yet — auto-detection running
          </div>
        )}

        {/* Add Wallet Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={walletInput}
              onChange={(e) => {
                setWalletInput(e.target.value);
                setInputError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWallet()}
              placeholder="0x... wallet address"
              className="flex-1 bg-poly-dark/70 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            <button
              onClick={handleAddWallet}
              disabled={!walletInput.trim()}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {inputError && (
            <div className="text-xs text-red-400">{inputError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
