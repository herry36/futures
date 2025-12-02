import { useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PricePanel } from './components/PricePanel';
import { TradingChart } from './components/TradingChart';
import { OrderBook } from './components/OrderBook';
import { PositionsTable } from './components/PositionsTable';
import { SignalsPanel } from './components/SignalsPanel';
import { EquityCurve } from './components/EquityCurve';
import { MetricsPanel } from './components/MetricsPanel';
import { TradesHistory } from './components/TradesHistory';
import { MLStatusPanel } from './components/MLStatus';
import { ToastContainer, useToasts } from './components/Toast';
import { useWebSocket } from './hooks/useWebSocket';
import { useTraderData } from './hooks/useTraderData';

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

  const {
    metrics,
    trades,
    totalTrades,
    refetchTrades,
    retrain
  } = useTraderData();

  const { toasts, addToast, removeToast } = useToasts();

  // Show toast notifications for trade events
  useEffect(() => {
    if (lastTradeOpened) {
      addToast({
        type: 'info',
        title: `${lastTradeOpened.direction} Position Opened`,
        message: `${lastTradeOpened.strategy} @ $${lastTradeOpened.entry_price?.toLocaleString()}`,
        duration: 5000
      });
    }
  }, [lastTradeOpened]);

  useEffect(() => {
    if (lastTradeClosed) {
      const isWin = (lastTradeClosed.pnl_usd || 0) >= 0;
      addToast({
        type: isWin ? 'success' : 'error',
        title: `Position Closed - ${isWin ? 'WIN' : 'LOSS'}`,
        message: `${lastTradeClosed.direction} ${lastTradeClosed.reason} | P&L: $${lastTradeClosed.pnl_usd?.toFixed(2)}`,
        duration: 7000
      });
    }
  }, [lastTradeClosed]);

  // Show strong signal notification
  useEffect(() => {
    if (mlPrediction && mlPrediction.confidence > 80 && mlPrediction.direction) {
      addToast({
        type: 'warning',
        title: `Strong ML Signal: ${mlPrediction.direction}`,
        message: `Confidence: ${mlPrediction.confidence.toFixed(1)}%`,
        duration: 10000
      });
    }
  }, [mlPrediction?.direction, mlPrediction?.confidence]);

  const handleFilterTrades = useCallback((options: { strategy?: string; result?: string }) => {
    refetchTrades({ ...options, limit: 50 });
  }, [refetchTrades]);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <Header connectionStatus={connectionStatus} onReconnect={reconnect} />

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-[1920px] mx-auto">
          {/* Top Row - Price & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
            {/* Price Panel - takes 4 cols */}
            <div className="lg:col-span-4">
              <PricePanel priceData={priceData} />
            </div>

            {/* Trading Chart - takes 8 cols */}
            <div className="lg:col-span-8 h-[400px]">
              <TradingChart priceData={priceData} positions={positions} />
            </div>
          </div>

          {/* Middle Row - Positions & OrderBook & Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
            {/* Positions Table - takes 6 cols */}
            <div className="lg:col-span-6">
              <PositionsTable positions={positions} />
            </div>

            {/* Order Book - takes 3 cols */}
            <div className="lg:col-span-3 h-[400px]">
              <OrderBook orderBookData={orderBookData} priceData={priceData} />
            </div>

            {/* Signals Panel - takes 3 cols */}
            <div className="lg:col-span-3">
              <SignalsPanel signals={signals} mlPrediction={mlPrediction} />
            </div>
          </div>

          {/* Bottom Row - Metrics & ML Status & Equity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
            {/* Metrics Panel - takes 4 cols */}
            <div className="lg:col-span-4">
              <MetricsPanel
                overall={metrics?.overall || null}
                today={metrics?.today || null}
              />
            </div>

            {/* Equity Curve - takes 5 cols */}
            <div className="lg:col-span-5">
              <EquityCurve equityData={metrics?.equity_curve || []} />
            </div>

            {/* ML Status - takes 3 cols */}
            <div className="lg:col-span-3">
              <MLStatusPanel mlStatus={metrics?.ml || null} onRetrain={retrain} />
            </div>
          </div>

          {/* Trades History - Full Width */}
          <div className="mb-4">
            <TradesHistory
              trades={trades}
              totalTrades={totalTrades}
              onFilter={handleFilterTrades}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-bg-secondary border-t border-border-color px-4 py-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>BTC Futures Scalper v1.0 | XGBoost + PyTorch Ensemble</span>
          <div className="flex items-center gap-4">
            <span>
              Session P&L:{' '}
              <span className={pnlData && pnlData.session_pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                ${pnlData?.session_pnl?.toFixed(2) || '0.00'}
              </span>
            </span>
            <span>
              Trades: <span className="text-text-primary">{pnlData?.trades_today || 0}</span>
            </span>
            <span>
              Win Rate:{' '}
              <span className="text-text-primary">{pnlData?.winrate?.toFixed(1) || 0}%</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
