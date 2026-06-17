import type { BotState } from '../types';

interface PaperPositionsCardProps {
  state: BotState | null;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function PaperPositionsCard({ state }: PaperPositionsCardProps) {
  const positions = state?.paperPositions ?? [];
  const totalDeployed = positions.reduce((sum, p) => sum + p.cost, 0);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="section-header mb-0">
          <div className="section-header-icon bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            📋
          </div>
          Open Positions
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Deployed:</span>
          <span className="font-mono text-sm text-blue-400">${totalDeployed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <div className="panel-body">
        {positions.length === 0 ? (
          <div className="text-center py-6 text-gray-600 text-sm">
            No positions yet — copied trades above the min value threshold will appear here
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-2 pr-3">Market</th>
                  <th className="text-left pb-2 pr-3">Side</th>
                  <th className="text-right pb-2 pr-3">Shares</th>
                  <th className="text-right pb-2 pr-3">Entry</th>
                  <th className="text-right pb-2 pr-3">Cost</th>
                  <th className="text-right pb-2">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 pr-3 text-gray-300 max-w-[180px]">
                      <div className="truncate" title={pos.market}>{pos.market}</div>
                      <div className="text-xs text-gray-600 truncate">{pos.wallet.slice(0, 6)}...{pos.wallet.slice(-4)}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pos.side === 'BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-gray-300">
                      {pos.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-gray-400">
                      ${pos.entryPrice.toFixed(3)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-white font-medium">
                      ${pos.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 text-right text-xs text-gray-600">
                      {timeAgo(pos.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
