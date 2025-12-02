import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Filter, Download, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { formatPrice, formatPnL, formatPercent, formatDate } from '../utils/formatters';
import type { Trade } from '../types';

interface TradesHistoryProps {
  trades: Trade[];
  totalTrades: number;
  onPageChange?: (page: number) => void;
  onFilter?: (options: { strategy?: string; result?: string }) => void;
}

export function TradesHistory({ trades, totalTrades, onPageChange, onFilter }: TradesHistoryProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<number | null>(null);
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(totalTrades / pageSize);

  const handleFilterChange = (type: 'strategy' | 'result', value: string) => {
    if (type === 'strategy') {
      setFilterStrategy(value);
    } else {
      setFilterResult(value);
    }
    onFilter?.({
      strategy: type === 'strategy' ? (value === 'ALL' ? undefined : value) : (filterStrategy === 'ALL' ? undefined : filterStrategy),
      result: type === 'result' ? (value === 'ALL' ? undefined : value) : (filterResult === 'ALL' ? undefined : filterResult)
    });
  };

  const exportCSV = () => {
    const headers = ['Time', 'Side', 'Strategy', 'Entry', 'Exit', 'P&L', 'Result'];
    const rows = trades.map(t => [
      t.exit_time,
      t.direction,
      t.strategy,
      t.entry_price,
      t.exit_price,
      t.pnl_usd,
      t.result
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Trade History</h3>
          <div className="flex items-center gap-2">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-text-secondary" />
              <select
                value={filterStrategy}
                onChange={(e) => handleFilterChange('strategy', e.target.value)}
                className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-2 py-1 border border-border-color focus:outline-none focus:border-accent-blue"
              >
                <option value="ALL">All Strategies</option>
                <option value="MOMENTUM">Momentum</option>
                <option value="MEAN_REVERSION">Mean Reversion</option>
                <option value="FUNDING_ARB">Funding Arb</option>
                <option value="LIQUIDATION_HUNT">Liquidation</option>
                <option value="HEDGE">Hedge</option>
                <option value="ML_SIGNAL">ML Signal</option>
              </select>
              <select
                value={filterResult}
                onChange={(e) => handleFilterChange('result', e.target.value)}
                className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-2 py-1 border border-border-color focus:outline-none focus:border-accent-blue"
              >
                <option value="ALL">All Results</option>
                <option value="WIN">Wins Only</option>
                <option value="LOSS">Losses Only</option>
              </select>
            </div>

            {/* Export */}
            <motion.button
              onClick={exportCSV}
              className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary text-text-secondary text-xs rounded-lg hover:text-text-primary transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download size={12} />
              CSV
            </motion.button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-text-secondary border-b border-border-color">
              <th className="text-left px-4 py-2 font-medium">Time</th>
              <th className="text-left px-4 py-2 font-medium">Side</th>
              <th className="text-left px-4 py-2 font-medium">Strategy</th>
              <th className="text-right px-4 py-2 font-medium">Entry</th>
              <th className="text-right px-4 py-2 font-medium">Exit</th>
              <th className="text-right px-4 py-2 font-medium">P&L</th>
              <th className="text-center px-4 py-2 font-medium">Result</th>
              <th className="text-center px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {trades.slice(0, 10).map((trade, index) => (
                <motion.tr
                  key={trade.id || index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-border-color/50 table-row-hover cursor-pointer"
                  onClick={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                >
                  {/* Time */}
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {formatDate(trade.exit_time)}
                  </td>

                  {/* Side */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      trade.direction === 'LONG' ? 'text-accent-green' : 'text-accent-red'
                    }`}>
                      {trade.direction === 'LONG' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {trade.direction}
                    </span>
                  </td>

                  {/* Strategy */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-secondary">{trade.strategy}</span>
                  </td>

                  {/* Entry */}
                  <td className="px-4 py-3 text-right text-xs text-text-primary">
                    {formatPrice(trade.entry_price, 2)}
                  </td>

                  {/* Exit */}
                  <td className="px-4 py-3 text-right text-xs text-text-primary">
                    {formatPrice(trade.exit_price, 2)}
                  </td>

                  {/* P&L */}
                  <td className="px-4 py-3 text-right">
                    <div className={`text-xs font-medium ${trade.pnl_usd >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatPnL(trade.pnl_usd)}
                    </div>
                  </td>

                  {/* Result */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      trade.result === 'WIN'
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-red/20 text-accent-red'
                    }`}>
                      {trade.result === 'WIN' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {trade.result}
                    </span>
                  </td>

                  {/* Expand Icon */}
                  <td className="px-4 py-3 text-center">
                    {expandedTradeId === trade.id ? (
                      <ChevronUp size={14} className="text-text-secondary" />
                    ) : (
                      <ChevronDown size={14} className="text-text-secondary" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Expanded Trade Details */}
      <AnimatePresence>
        {expandedTradeId && trades.find(t => t.id === expandedTradeId) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border-color bg-bg-tertiary px-4 py-3 overflow-hidden"
          >
            {(() => {
              const trade = trades.find(t => t.id === expandedTradeId)!;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-text-secondary">Exit Reason:</span>
                    <div className="text-text-primary">{trade.exit_reason}</div>
                  </div>
                  <div>
                    <span className="text-text-secondary">ML Confidence:</span>
                    <div className="text-text-primary">{(trade.ml_confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Book Imbalance:</span>
                    <div className="text-text-primary">{(trade.book_imbalance * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Momentum 5m:</span>
                    <div className="text-text-primary">{formatPercent(trade.momentum_5m)}</div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-border-color flex items-center justify-between bg-bg-tertiary">
        <span className="text-xs text-text-secondary">
          Showing {Math.min(10, trades.length)} of {totalTrades} trades
        </span>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => {
              setCurrentPage(Math.max(1, currentPage - 1));
              onPageChange?.(currentPage - 1);
            }}
            disabled={currentPage === 1}
            className="px-3 py-1 text-xs bg-bg-primary text-text-secondary rounded-lg hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Prev
          </motion.button>
          <span className="text-xs text-text-secondary">
            Page {currentPage} of {totalPages || 1}
          </span>
          <motion.button
            onClick={() => {
              setCurrentPage(Math.min(totalPages, currentPage + 1));
              onPageChange?.(currentPage + 1);
            }}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-xs bg-bg-primary text-text-secondary rounded-lg hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next
          </motion.button>
        </div>
      </div>
    </div>
  );
}
