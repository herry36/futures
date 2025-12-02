import { useEffect, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from './hooks/useWebSocket';
import { useTraderData } from './hooks/useTraderData';
import { LiveChart } from './components/LiveChart';
import { formatPrice, formatPnL, formatPercent, formatVolume, formatTime, formatCountdown } from './utils/formatters';
import { getSecondsUntilFunding } from './utils/calculations';
import {
  Wifi, WifiOff, TrendingUp, TrendingDown, Activity, Clock,
  BarChart3, Target, Brain, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, XCircle, X, Zap, Layers
} from 'lucide-react';

function App() {
  const {
    connectionStatus,
    priceData,
    orderBookData,
    positions,
    signals,
    mlPrediction,
    pnlData,
    lastTradeOpened,
    lastTradeClosed,
    reconnect
  } = useWebSocket();

  const { metrics, trades, retrain } = useTraderData();

  const [time, setTime] = useState(new Date());
  const [fundingCountdown, setFundingCountdown] = useState(getSecondsUntilFunding());
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [toasts, setToasts] = useState<Array<{id: string; type: string; title: string; message: string}>>([]);
  const prevPriceRef = useRef<number | null>(null);

  // Clock and funding countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      setFundingCountdown(getSecondsUntilFunding());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Price flash effect
  useEffect(() => {
    if (priceData?.last_price && prevPriceRef.current !== null) {
      if (priceData.last_price > prevPriceRef.current) {
        setPriceFlash('up');
      } else if (priceData.last_price < prevPriceRef.current) {
        setPriceFlash('down');
      }
      setTimeout(() => setPriceFlash(null), 400);
    }
    if (priceData?.last_price) {
      prevPriceRef.current = priceData.last_price;
    }
  }, [priceData?.last_price]);

  // Trade notifications
  useEffect(() => {
    if (lastTradeOpened) {
      addToast('info', `${lastTradeOpened.direction} Opened`, `${lastTradeOpened.strategy} @ $${lastTradeOpened.entry_price?.toLocaleString()}`);
    }
  }, [lastTradeOpened]);

  useEffect(() => {
    if (lastTradeClosed) {
      const isWin = (lastTradeClosed.pnl_usd || 0) >= 0;
      addToast(isWin ? 'success' : 'error', `${isWin ? 'WIN' : 'LOSS'}`, `P&L: $${lastTradeClosed.pnl_usd?.toFixed(2)}`);
    }
  }, [lastTradeClosed]);

  const addToast = (type: string, title: string, message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const price = priceData?.last_price || 0;
  const priceChange = priceData?.price_change_pct || 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="min-h-screen bg-kc-bg text-kc-text">
      {/* Top Header Bar */}
      <header className="bg-kc-bg-light border-b border-kc-border px-4 py-2">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-kc-green to-kc-cyan flex items-center justify-center">
                <Zap className="w-6 h-6 text-kc-bg" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-kc-green animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-kc-text tracking-tight">BTC SCALPER</h1>
              <p className="text-[10px] text-kc-text-secondary -mt-0.5">AI TRADING SYSTEM</p>
            </div>
          </div>

          {/* Live Indicator & Connection */}
          <div className="flex items-center gap-4">
            <motion.button
              onClick={reconnect}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
                connectionStatus === 'connected'
                  ? 'bg-kc-green/10 text-kc-green border border-kc-green/30'
                  : 'bg-kc-red/10 text-kc-red border border-kc-red/30'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-kc-green animate-pulse" />
                  <Wifi size={14} />
                  <span>LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-kc-red" />
                  <WifiOff size={14} />
                  <span>OFFLINE</span>
                </>
              )}
            </motion.button>

            <div className="text-right">
              <div className="text-sm font-mono text-kc-text">{time.toISOString().slice(11, 19)} UTC</div>
              <div className="text-[10px] text-kc-text-secondary">{time.toISOString().slice(0, 10)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3">
        <div className="max-w-[1920px] mx-auto space-y-3">

          {/* Top Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Main Price */}
            <motion.div
              className={`col-span-2 card p-4 ${priceFlash === 'up' ? 'flash-up' : priceFlash === 'down' ? 'flash-down' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-kc-text-secondary text-xs mb-1">BTC-PERPETUAL</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold font-mono">${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className={`flex items-center gap-1 text-lg font-medium ${isPositive ? 'text-kc-green' : 'text-kc-red'}`}>
                      {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      {formatPercent(priceChange)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-kc-text-secondary">Mark: ${priceData?.mark_price?.toLocaleString() || '—'}</div>
                  <div className="text-xs text-kc-text-secondary">Index: ${priceData?.index_price?.toLocaleString() || '—'}</div>
                </div>
              </div>
            </motion.div>

            {/* Funding Rate */}
            <div className="card p-4">
              <div className="text-kc-text-secondary text-xs mb-1 flex items-center gap-1">
                <Clock size={12} />
                Funding (8h)
              </div>
              <div className={`text-xl font-bold font-mono ${(priceData?.funding_rate || 0) >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                {((priceData?.funding_rate || 0) * 100).toFixed(4)}%
              </div>
              <div className="text-xs text-kc-text-secondary mt-1">Next: {formatCountdown(fundingCountdown)}</div>
            </div>

            {/* Open Interest */}
            <div className="card p-4">
              <div className="text-kc-text-secondary text-xs mb-1 flex items-center gap-1">
                <Layers size={12} />
                Open Interest
              </div>
              <div className="text-xl font-bold font-mono text-kc-text">
                {formatVolume((priceData?.open_interest || 0) * price)}
              </div>
              <div className="text-xs text-kc-text-secondary mt-1">{(priceData?.open_interest || 0).toFixed(2)} BTC</div>
            </div>

            {/* Session P&L */}
            <div className="card p-4">
              <div className="text-kc-text-secondary text-xs mb-1 flex items-center gap-1">
                <Activity size={12} />
                Session P&L
              </div>
              <div className={`text-xl font-bold font-mono ${(pnlData?.session_pnl || 0) >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                {formatPnL(pnlData?.session_pnl || 0)}
              </div>
              <div className="text-xs text-kc-text-secondary mt-1">
                {pnlData?.trades_today || 0} trades | {(pnlData?.winrate || 0).toFixed(0)}% win
              </div>
            </div>

            {/* ML Status */}
            <div className="card p-4">
              <div className="text-kc-text-secondary text-xs mb-1 flex items-center gap-1">
                <Brain size={12} />
                AI Engine
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${mlPrediction?.direction ? 'bg-kc-green animate-pulse' : 'bg-kc-text-muted'}`} />
                <span className={`text-lg font-bold ${
                  mlPrediction?.direction === 'LONG' ? 'text-kc-green' :
                  mlPrediction?.direction === 'SHORT' ? 'text-kc-red' : 'text-kc-text-secondary'
                }`}>
                  {mlPrediction?.direction || 'NEUTRAL'}
                </span>
              </div>
              <div className="text-xs text-kc-text-secondary mt-1">
                Confidence: {(mlPrediction?.confidence || 0).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

            {/* Left Column - Positions & Order Book */}
            <div className="lg:col-span-3 space-y-3">

              {/* Order Book */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-kc-border flex items-center justify-between">
                  <span className="text-sm font-medium">Order Book</span>
                  <span className={`text-xs font-medium ${(orderBookData?.book_imbalance || 0) > 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                    {((orderBookData?.book_imbalance || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2 space-y-0.5">
                  {/* Asks */}
                  {[...Array(8)].map((_, i) => {
                    const askPrice = price + (8 - i) * 2;
                    const size = Math.random() * 5 + 1;
                    const percent = (size / 10) * 100;
                    return (
                      <div key={`ask-${i}`} className="relative flex items-center justify-between text-xs py-1 px-2">
                        <div className="absolute right-0 top-0 bottom-0 bg-kc-red/10" style={{ width: `${percent}%` }} />
                        <span className="relative text-kc-red font-mono">{askPrice.toFixed(2)}</span>
                        <span className="relative text-kc-text-secondary font-mono">{size.toFixed(4)}</span>
                      </div>
                    );
                  })}

                  {/* Spread */}
                  <div className="flex items-center justify-center py-2 my-1 bg-kc-bg-lighter border-y border-kc-border">
                    <span className="text-kc-cyan text-xs font-mono">${(priceData?.spread || 0.5).toFixed(2)} Spread</span>
                  </div>

                  {/* Bids */}
                  {[...Array(8)].map((_, i) => {
                    const bidPrice = price - (i + 1) * 2;
                    const size = Math.random() * 5 + 1;
                    const percent = (size / 10) * 100;
                    return (
                      <div key={`bid-${i}`} className="relative flex items-center justify-between text-xs py-1 px-2">
                        <div className="absolute right-0 top-0 bottom-0 bg-kc-green/10" style={{ width: `${percent}%` }} />
                        <span className="relative text-kc-green font-mono">{bidPrice.toFixed(2)}</span>
                        <span className="relative text-kc-text-secondary font-mono">{size.toFixed(4)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Center Column - Live Chart */}
            <div className="lg:col-span-6">
              <LiveChart price={price} positions={positions} />
            </div>

            {/* Right Column - Signals & Stats */}
            <div className="lg:col-span-3 space-y-3">

              {/* ML Signals */}
              <div className="card">
                <div className="px-4 py-3 border-b border-kc-border flex items-center gap-2">
                  <Brain size={14} className="text-kc-cyan" />
                  <span className="text-sm font-medium">AI Signals</span>
                </div>
                <div className="p-4 space-y-3">
                  {['MOMENTUM', 'MEAN_REV', 'FUNDING', 'LIQUIDATION'].map((strategy, i) => {
                    const signal = signals.find(s => s.strategy.includes(strategy.split('_')[0]));
                    const confidence = signal?.confidence || Math.random() * 50 + 10;
                    const direction = signal?.direction;
                    return (
                      <div key={strategy}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-kc-text-secondary">{strategy}</span>
                          <span className={`text-xs font-medium ${
                            direction === 'LONG' ? 'text-kc-green' :
                            direction === 'SHORT' ? 'text-kc-red' : 'text-kc-text-muted'
                          }`}>
                            {direction || '—'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-kc-bg-lighter rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              direction === 'LONG' ? 'bg-kc-green' :
                              direction === 'SHORT' ? 'bg-kc-red' : 'bg-kc-text-muted'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${confidence}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Ensemble Result */}
                  <div className="pt-3 mt-3 border-t border-kc-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-kc-cyan">ENSEMBLE</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        mlPrediction?.direction === 'LONG' ? 'bg-kc-green/20 text-kc-green' :
                        mlPrediction?.direction === 'SHORT' ? 'bg-kc-red/20 text-kc-red' :
                        'bg-kc-bg-lighter text-kc-text-secondary'
                      }`}>
                        {mlPrediction?.direction || 'NEUTRAL'}
                      </span>
                    </div>
                    <div className="h-2 bg-kc-bg-lighter rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-kc-cyan to-kc-green"
                        initial={{ width: 0 }}
                        animate={{ width: `${mlPrediction?.confidence || 0}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="text-center mt-1 text-xs text-kc-text-secondary">
                      {(mlPrediction?.confidence || 0).toFixed(1)}% Confidence
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="card">
                <div className="px-4 py-3 border-b border-kc-border">
                  <span className="text-sm font-medium">Performance</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-kc-text-secondary">Win Rate</span>
                    <span className="text-sm font-mono text-kc-green">{(metrics?.overall?.win_rate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-kc-text-secondary">Total Trades</span>
                    <span className="text-sm font-mono text-kc-text">{metrics?.overall?.total_trades || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-kc-text-secondary">Avg Win</span>
                    <span className="text-sm font-mono text-kc-green">{formatPnL(metrics?.overall?.avg_win || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-kc-text-secondary">Avg Loss</span>
                    <span className="text-sm font-mono text-kc-red">{formatPnL(-(metrics?.overall?.avg_loss || 0))}</span>
                  </div>
                  <div className="pt-3 mt-3 border-t border-kc-border">
                    <div className="text-xs text-kc-text-secondary mb-1">Expected Value</div>
                    <div className={`text-2xl font-bold font-mono ${(metrics?.overall?.expected_value || 0) >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                      {formatPnL(metrics?.overall?.expected_value || 0)}
                    </div>
                    <div className="text-[10px] text-kc-text-muted">per trade</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="card">
            <div className="px-4 py-3 border-b border-kc-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-kc-cyan" />
                <span className="text-sm font-medium">Open Positions</span>
                <span className="px-2 py-0.5 rounded-full bg-kc-cyan/10 text-kc-cyan text-xs">{positions.length}</span>
              </div>
            </div>

            {positions.length === 0 ? (
              <div className="py-12 text-center">
                <Target size={32} className="text-kc-text-muted mx-auto mb-2" />
                <p className="text-kc-text-secondary text-sm">No open positions</p>
                <p className="text-kc-text-muted text-xs">Waiting for trading signals...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-kc-text-secondary border-b border-kc-border">
                      <th className="text-left px-4 py-3 font-medium">ID</th>
                      <th className="text-left px-4 py-3 font-medium">Side</th>
                      <th className="text-left px-4 py-3 font-medium">Strategy</th>
                      <th className="text-right px-4 py-3 font-medium">Entry</th>
                      <th className="text-right px-4 py-3 font-medium">Current</th>
                      <th className="text-right px-4 py-3 font-medium">P&L</th>
                      <th className="text-right px-4 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr key={pos.id} className="table-row">
                        <td className="px-4 py-3 text-xs font-mono text-kc-text-secondary">{pos.id.slice(-8)}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${pos.direction === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                            {pos.direction === 'LONG' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {pos.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-kc-text-secondary">{pos.strategy}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono">${pos.entry_price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono">${pos.current_price.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right text-sm font-mono font-medium ${pos.pnl_usd >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                          {formatPnL(pos.pnl_usd)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-kc-text-secondary">{pos.minutes_open.toFixed(0)}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="card">
            <div className="px-4 py-3 border-b border-kc-border">
              <span className="text-sm font-medium">Recent Trades</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-kc-text-secondary border-b border-kc-border">
                    <th className="text-left px-4 py-3 font-medium">Time</th>
                    <th className="text-left px-4 py-3 font-medium">Side</th>
                    <th className="text-left px-4 py-3 font-medium">Strategy</th>
                    <th className="text-right px-4 py-3 font-medium">Entry</th>
                    <th className="text-right px-4 py-3 font-medium">Exit</th>
                    <th className="text-right px-4 py-3 font-medium">P&L</th>
                    <th className="text-center px-4 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 10).map((trade, i) => (
                    <tr key={trade.id || i} className="table-row">
                      <td className="px-4 py-3 text-xs text-kc-text-secondary">{new Date(trade.exit_time).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${trade.direction === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-kc-text-secondary">{trade.strategy}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">${trade.entry_price?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono">${trade.exit_price?.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right text-sm font-mono font-medium ${trade.pnl_usd >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>
                        {formatPnL(trade.pnl_usd)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${trade.result === 'WIN' ? 'badge-long' : 'badge-short'}`}>
                          {trade.result === 'WIN' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {trade.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-kc-bg-light border-t border-kc-border px-4 py-2 mt-auto">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto text-xs text-kc-text-secondary">
          <div className="flex items-center gap-2">
            <span>BTC Futures Scalper v2.0</span>
            <span className="text-kc-text-muted">|</span>
            <span>XGBoost + PyTorch Ensemble</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Total P&L: <span className={`font-mono font-medium ${(pnlData?.total_pnl || 0) >= 0 ? 'text-kc-green' : 'text-kc-red'}`}>${(pnlData?.total_pnl || 0).toFixed(2)}</span></span>
            <span>Trades: <span className="font-mono text-kc-text">{metrics?.overall?.total_trades || 0}</span></span>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`px-4 py-3 rounded-lg border ${
                toast.type === 'success' ? 'bg-kc-green/10 border-kc-green/30 text-kc-green' :
                toast.type === 'error' ? 'bg-kc-red/10 border-kc-red/30 text-kc-red' :
                'bg-kc-cyan/10 border-kc-cyan/30 text-kc-cyan'
              }`}
            >
              <div className="text-sm font-medium">{toast.title}</div>
              <div className="text-xs opacity-80">{toast.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
