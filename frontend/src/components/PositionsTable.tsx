import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, X, Target, Shield, Clock } from 'lucide-react';
import { formatPrice, formatPnL, formatPercent, formatDuration } from '../utils/formatters';
import { calculatePositionProgress } from '../utils/calculations';
import type { Position } from '../types';

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border-color p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">Open Positions</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
            <Target className="text-text-secondary" size={24} />
          </div>
          <p className="text-text-secondary text-sm">No open positions</p>
          <p className="text-text-secondary/60 text-xs mt-1">Waiting for signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Open Positions</h3>
        <span className="px-2 py-0.5 bg-accent-blue/20 text-accent-blue text-xs rounded-full">
          {positions.length} active
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-text-secondary border-b border-border-color">
              <th className="text-left px-4 py-2 font-medium">ID</th>
              <th className="text-left px-4 py-2 font-medium">Side</th>
              <th className="text-left px-4 py-2 font-medium">Strategy</th>
              <th className="text-right px-4 py-2 font-medium">Entry</th>
              <th className="text-right px-4 py-2 font-medium">Current</th>
              <th className="text-right px-4 py-2 font-medium">P&L</th>
              <th className="text-center px-4 py-2 font-medium">Progress</th>
              <th className="text-right px-4 py-2 font-medium">Time</th>
              <th className="text-center px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {positions.map((position) => {
                const { slProgress, tpProgress, pnlPercent } = calculatePositionProgress(
                  position.entry_price,
                  position.current_price,
                  position.stop_loss,
                  position.take_profit,
                  position.direction
                );

                return (
                  <motion.tr
                    key={position.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="border-b border-border-color/50 table-row-hover"
                  >
                    {/* ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-secondary">
                          {position.id.slice(-8)}
                        </span>
                        {position.is_hedge && (
                          <Shield size={12} className="text-accent-purple" title="Hedge Position" />
                        )}
                      </div>
                    </td>

                    {/* Side */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        position.direction === 'LONG'
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}>
                        {position.direction === 'LONG' ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )}
                        {position.direction}
                      </span>
                    </td>

                    {/* Strategy */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStrategyColor(position.strategy)}`}>
                        {position.strategy}
                      </span>
                    </td>

                    {/* Entry Price */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-text-primary">{formatPrice(position.entry_price, 2)}</span>
                    </td>

                    {/* Current Price */}
                    <td className="px-4 py-3 text-right">
                      <motion.span
                        key={position.current_price}
                        initial={{ color: '#f0f6fc' }}
                        animate={{ color: position.pnl_usd >= 0 ? '#3fb950' : '#f85149' }}
                        className="text-sm font-medium"
                      >
                        {formatPrice(position.current_price, 2)}
                      </motion.span>
                    </td>

                    {/* P&L */}
                    <td className="px-4 py-3 text-right">
                      <div className={`text-sm font-medium ${position.pnl_usd >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {formatPnL(position.pnl_usd)}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {formatPercent(position.pnl_pct)}
                      </div>
                    </td>

                    {/* Progress Bar (SL to TP) */}
                    <td className="px-4 py-3">
                      <div className="w-24 mx-auto">
                        <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                          <span>SL</span>
                          <span>TP</span>
                        </div>
                        <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          {/* SL zone */}
                          <div className="absolute left-0 h-full w-1/3 bg-accent-red/30" />
                          {/* TP zone */}
                          <div className="absolute right-0 h-full w-1/3 bg-accent-green/30" />
                          {/* Current position indicator */}
                          <motion.div
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-accent-blue rounded-full shadow-lg z-10"
                            animate={{
                              left: `${Math.max(0, Math.min(100, 50 + tpProgress / 2))}%`,
                            }}
                            style={{ marginLeft: '-4px' }}
                          />
                          {/* Trailing stop indicator */}
                          {position.trailing_stop && (
                            <motion.div
                              className="absolute top-0 bottom-0 w-1 bg-accent-yellow"
                              animate={{
                                left: `${calculateTrailingPosition(position)}%`,
                              }}
                              title={`Trailing: ${formatPrice(position.trailing_stop, 2)}`}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-[9px] text-text-secondary mt-1">
                          <span>{formatPrice(position.stop_loss, 0)}</span>
                          <span>{formatPrice(position.take_profit, 0)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Time Open */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-text-secondary">
                        <Clock size={12} />
                        {formatDuration(position.minutes_open)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <motion.button
                        className="p-1.5 rounded-lg bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Close Position"
                      >
                        <X size={14} />
                      </motion.button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-bg-tertiary border-t border-border-color">
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-text-secondary">Total P&L: </span>
            <span className={getTotalPnL(positions) >= 0 ? 'text-accent-green' : 'text-accent-red'}>
              {formatPnL(getTotalPnL(positions))}
            </span>
          </div>
          <div>
            <span className="text-text-secondary">Avg Hold Time: </span>
            <span className="text-text-primary">{formatDuration(getAvgHoldTime(positions))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getStrategyColor(strategy: string): string {
  const colors: Record<string, string> = {
    MOMENTUM: 'bg-accent-blue/20 text-accent-blue',
    MEAN_REVERSION: 'bg-accent-purple/20 text-accent-purple',
    FUNDING_ARB: 'bg-accent-yellow/20 text-accent-yellow',
    LIQUIDATION_HUNT: 'bg-accent-red/20 text-accent-red',
    HEDGE: 'bg-text-secondary/20 text-text-secondary',
    ML_SIGNAL: 'bg-accent-green/20 text-accent-green',
  };
  return colors[strategy] || 'bg-bg-tertiary text-text-secondary';
}

function calculateTrailingPosition(position: Position): number {
  if (!position.trailing_stop) return 50;
  const range = position.take_profit - position.stop_loss;
  const fromSL = position.trailing_stop - position.stop_loss;
  return (fromSL / range) * 100;
}

function getTotalPnL(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.pnl_usd, 0);
}

function getAvgHoldTime(positions: Position[]): number {
  if (positions.length === 0) return 0;
  return positions.reduce((sum, p) => sum + p.minutes_open, 0) / positions.length;
}
