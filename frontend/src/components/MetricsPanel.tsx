import { motion } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown, Target, Award, AlertTriangle } from 'lucide-react';
import { formatPrice, formatPnL, formatPercent } from '../utils/formatters';
import type { OverallMetrics, TodayMetrics } from '../types';

interface MetricsPanelProps {
  overall: OverallMetrics | null;
  today: TodayMetrics | null;
}

export function MetricsPanel({ overall, today }: MetricsPanelProps) {
  if (!overall) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border-color p-6 animate-pulse">
        <div className="h-6 bg-bg-tertiary rounded w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  const expectedValue = overall.expected_value;
  const isPositiveEV = expectedValue >= 0;

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-accent-blue" />
          <h3 className="text-sm font-medium text-text-primary">Performance Metrics</h3>
        </div>
      </div>

      {/* Expected Value Section */}
      <div className="p-4 border-b border-border-color">
        <div className="text-xs text-text-secondary mb-2">EXPECTED VALUE PER TRADE</div>
        <div className="text-xs text-text-secondary/70 mb-3 font-mono">
          E = (P_win × Avg_win) − (P_loss × Avg_loss)
        </div>

        {/* Big EV Display */}
        <motion.div
          className={`text-center py-4 px-6 rounded-lg ${
            isPositiveEV ? 'bg-accent-green/10 border border-accent-green/30' : 'bg-accent-red/10 border border-accent-red/30'
          }`}
          animate={{
            boxShadow: isPositiveEV
              ? ['0 0 10px rgba(63, 185, 80, 0.1)', '0 0 20px rgba(63, 185, 80, 0.2)', '0 0 10px rgba(63, 185, 80, 0.1)']
              : ['0 0 10px rgba(248, 81, 73, 0.1)', '0 0 20px rgba(248, 81, 73, 0.2)', '0 0 10px rgba(248, 81, 73, 0.1)']
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={`text-3xl font-bold ${isPositiveEV ? 'text-accent-green' : 'text-accent-red'}`}>
            {formatPnL(expectedValue)}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            ({formatPercent(expectedValue / 1000)}) per trade
          </div>
        </motion.div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <TrendingUp size={12} className="text-accent-green" />
              Win Rate
            </div>
            <div className="text-lg font-bold text-accent-green">{overall.win_rate.toFixed(1)}%</div>
            <div className="text-xs text-text-secondary">Avg Win: {formatPnL(overall.avg_win)}</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <TrendingDown size={12} className="text-accent-red" />
              Loss Rate
            </div>
            <div className="text-lg font-bold text-accent-red">{(100 - overall.win_rate).toFixed(1)}%</div>
            <div className="text-xs text-text-secondary">Avg Loss: {formatPnL(-overall.avg_loss)}</div>
          </div>
        </div>
      </div>

      {/* Today vs All Time Comparison */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Today */}
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-xs text-text-secondary mb-3 font-medium">TODAY</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Trades:</span>
                <span className="text-text-primary font-medium">{today?.trades || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">P&L:</span>
                <span className={`font-medium ${(today?.pnl || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {formatPnL(today?.pnl || 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Win Rate:</span>
                <span className="text-text-primary font-medium">
                  {today?.trades ? ((today.wins / today.trades) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Best:</span>
                <span className="text-accent-green font-medium">{formatPnL(today?.best || 0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Worst:</span>
                <span className="text-accent-red font-medium">{formatPnL(today?.worst || 0)}</span>
              </div>
            </div>
          </div>

          {/* All Time */}
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="text-xs text-text-secondary mb-3 font-medium">ALL TIME</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Trades:</span>
                <span className="text-text-primary font-medium">{overall.total_trades}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">P&L:</span>
                <span className={`font-medium ${overall.total_pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {formatPnL(overall.total_pnl)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Win Rate:</span>
                <span className="text-text-primary font-medium">{overall.win_rate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Best:</span>
                <span className="text-accent-green font-medium">{formatPnL(overall.best_trade)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Worst:</span>
                <span className="text-accent-red font-medium">{formatPnL(overall.worst_trade)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
