/**
 * Type definitions for BTC Futures Dashboard
 */

export interface PriceData {
  timestamp: string;
  last_price: number;
  mark_price: number;
  index_price: number;
  bid: number;
  ask: number;
  spread: number;
  funding_rate: number;
  funding_8h: number;
  basis: number;
  basis_pct: number;
  volume_24h: number;
  volume_usd: number;
  open_interest: number;
  price_change_pct: number;
  high_24h: number;
  low_24h: number;
}

export interface OrderBookData {
  bid_depth: number;
  ask_depth: number;
  book_imbalance: number;
  trade_imbalance: number;
  large_buys: number;
  large_sells: number;
  bids?: [number, number][];
  asks?: [number, number][];
  spread?: number;
}

export interface Position {
  id: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  entry_price: number;
  current_price: number;
  pnl_usd: number;
  pnl_pct: number;
  stop_loss: number;
  take_profit: number;
  trailing_stop: number | null;
  minutes_open: number;
  is_hedge: boolean;
}

export interface Signal {
  strategy: string;
  direction: 'LONG' | 'SHORT' | null;
  confidence: number;
  reason: string;
}

export interface MLPrediction {
  direction: 'LONG' | 'SHORT' | null;
  confidence: number;
  reason: string;
}

export interface Trade {
  id: number;
  position_id: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  size_usd: number;
  pnl_usd: number;
  pnl_pct: number;
  result: 'WIN' | 'LOSS';
  exit_reason: string;
  was_hedge: boolean;
  funding_rate: number;
  book_imbalance: number;
  trade_imbalance: number;
  momentum_5m: number;
  oi_change: number;
  ml_confidence: number;
  ml_prediction: string;
}

export interface PnLData {
  session_pnl: number;
  total_pnl: number;
  trades_today: number;
  wins_today: number;
  losses_today: number;
  winrate: number;
}

export interface DailyPnL {
  date: string;
  total_pnl_usd: number;
  trades_count: number;
  wins: number;
  losses: number;
}

export interface OverallMetrics {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  expected_value: number;
  best_trade: number;
  worst_trade: number;
}

export interface TodayMetrics {
  trades: number;
  wins: number;
  pnl: number;
  best: number;
  worst: number;
}

export interface MLStatus {
  xgb_active: boolean;
  pytorch_active: boolean;
  xgb_accuracy: number;
  pytorch_accuracy: number;
  ensemble_accuracy: number;
  last_training: string | null;
  total_trades: number;
}

export interface StrategyStats {
  strategy: string;
  trades: number;
  wins: number;
  pnl: number;
}

export interface Metrics {
  overall: OverallMetrics;
  today: TodayMetrics;
  ml: MLStatus;
  strategies: StrategyStats[];
  equity_curve: DailyPnL[];
}

export interface TraderStatus {
  status: 'ACTIVE' | 'LEARNING';
  ml_active: boolean;
  price: number;
  funding_rate: number;
  book_imbalance: number;
  trade_imbalance: number;
  positions_open: number;
  positions: Position[];
  session_pnl_usd: number;
  total_pnl_usd: number;
  total_wins_usd: number;
  total_losses_usd: number;
  net_pnl_usd: number;
  trades_today: number;
  wins_today: number;
  losses_today: number;
  winrate_today: number;
  min_trades_ml: number;
  strategies: string[];
  recent_trades: { result: string; pnl_usd: number }[];
  xgb_accuracy: number;
  pytorch_accuracy: number;
}

export interface TradeEvent {
  position_id: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  entry_price?: number;
  exit_price?: number;
  pnl_usd?: number;
  pnl_pct?: number;
  result?: 'WIN' | 'LOSS';
  reason?: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
}
