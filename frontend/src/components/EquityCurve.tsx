import { useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { formatPrice, formatPercent } from '../utils/formatters';
import type { DailyPnL } from '../types';

interface EquityCurveProps {
  equityData: DailyPnL[];
  startingBalance?: number;
}

type PeriodType = '7D' | '30D' | 'ALL';

export function EquityCurve({ equityData, startingBalance = 10000 }: EquityCurveProps) {
  const [period, setPeriod] = useState<PeriodType>('7D');

  // Filter data based on period
  const filteredData = (() => {
    if (period === 'ALL') return equityData;
    const days = period === '7D' ? 7 : 30;
    return equityData.slice(-days);
  })();

  // Calculate cumulative equity
  let cumulative = startingBalance;
  const chartData = filteredData.map((day, index) => {
    cumulative += day.total_pnl_usd;
    return {
      date: day.date,
      equity: cumulative,
      pnl: day.total_pnl_usd,
      trades: day.trades_count,
      wins: day.wins,
      drawdown: 0, // Calculate below
    };
  });

  // Calculate drawdown
  let peak = startingBalance;
  chartData.forEach((point) => {
    if (point.equity > peak) peak = point.equity;
    point.drawdown = ((peak - point.equity) / peak) * 100;
  });

  // Stats
  const currentEquity = chartData.length > 0 ? chartData[chartData.length - 1].equity : startingBalance;
  const totalPnL = currentEquity - startingBalance;
  const totalReturn = ((currentEquity - startingBalance) / startingBalance) * 100;
  const maxDrawdown = Math.max(...chartData.map(d => d.drawdown), 0);
  const totalTrades = filteredData.reduce((sum, d) => sum + d.trades_count, 0);

  // Calculate Sharpe (simplified)
  const returns = chartData.map(d => d.pnl / startingBalance);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  ) || 1;
  const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(365);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Equity Curve</h3>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['7D', '30D', 'ALL'] as const).map((p) => (
            <motion.button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {p}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 p-4">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3fb950" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f85149" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8b949e', fontSize: 10 }}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8b949e', fontSize: 10 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-bg-tertiary border border-border-color rounded-lg p-3 shadow-lg">
                        <p className="text-xs text-text-secondary">{data.date}</p>
                        <p className="text-sm font-medium text-text-primary">
                          Equity: {formatPrice(data.equity, 2)}
                        </p>
                        <p className={`text-xs ${data.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          P&L: {formatPrice(data.pnl, 2)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Trades: {data.trades} | Wins: {data.wins}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={startingBalance} stroke="#30363d" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#3fb950"
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-text-secondary text-sm">
            No equity data available
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-3 border-t border-border-color bg-bg-tertiary">
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-text-secondary block">Starting</span>
            <span className="text-text-primary font-medium">{formatPrice(startingBalance, 0)}</span>
          </div>
          <div>
            <span className="text-text-secondary block">Current</span>
            <span className={`font-medium ${totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {formatPrice(currentEquity, 0)}
            </span>
          </div>
          <div>
            <span className="text-text-secondary block">Return</span>
            <span className={`font-medium ${totalReturn >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {formatPercent(totalReturn)}
            </span>
          </div>
          <div>
            <span className="text-text-secondary block">Max DD</span>
            <span className="text-accent-red font-medium">-{maxDrawdown.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex justify-between mt-3 pt-3 border-t border-border-color/50 text-xs">
          <span className="text-text-secondary">Sharpe: <span className="text-text-primary">{sharpeRatio.toFixed(2)}</span></span>
          <span className="text-text-secondary">Trades: <span className="text-text-primary">{totalTrades}</span></span>
        </div>
      </div>
    </div>
  );
}
