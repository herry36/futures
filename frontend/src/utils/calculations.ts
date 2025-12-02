/**
 * Utility functions for calculations
 */

export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectedValue: number;
  profitFactor: number;
  maxDrawdown: number;
}

export function calculateExpectedValue(
  winRate: number,
  avgWin: number,
  avgLoss: number
): number {
  // E = (P_win × Avg_win) − (P_loss × Avg_loss)
  return (winRate * avgWin) - ((1 - winRate) * Math.abs(avgLoss));
}

export function calculateProfitFactor(
  totalWins: number,
  totalLosses: number
): number {
  if (totalLosses === 0) return totalWins > 0 ? Infinity : 0;
  return Math.abs(totalWins / totalLosses);
}

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return wins / total;
}

export function calculateDrawdown(
  equityCurve: number[]
): { current: number; max: number } {
  if (equityCurve.length === 0) return { current: 0, max: 0 };

  let peak = equityCurve[0];
  let maxDrawdown = 0;
  let currentDrawdown = 0;

  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = (peak - equity) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    currentDrawdown = drawdown;
  }

  return { current: currentDrawdown, max: maxDrawdown };
}

export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (mean - riskFreeRate) / stdDev;
}

export function calculatePositionProgress(
  entryPrice: number,
  currentPrice: number,
  stopLoss: number,
  takeProfit: number,
  direction: 'LONG' | 'SHORT'
): { slProgress: number; tpProgress: number; pnlPercent: number } {
  let pnlPercent: number;
  let slProgress: number;
  let tpProgress: number;

  if (direction === 'LONG') {
    pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const totalRange = takeProfit - stopLoss;
    const currentFromSL = currentPrice - stopLoss;
    slProgress = Math.max(0, Math.min(100, (currentFromSL / (entryPrice - stopLoss)) * 100));
    tpProgress = Math.max(0, Math.min(100, ((currentPrice - entryPrice) / (takeProfit - entryPrice)) * 100));
  } else {
    pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
    slProgress = Math.max(0, Math.min(100, ((stopLoss - currentPrice) / (stopLoss - entryPrice)) * 100));
    tpProgress = Math.max(0, Math.min(100, ((entryPrice - currentPrice) / (entryPrice - takeProfit)) * 100));
  }

  return { slProgress, tpProgress, pnlPercent };
}

export function calculateBookImbalanceColor(imbalance: number): string {
  // Imbalance ranges from -1 to 1
  // Positive = more bids (bullish)
  // Negative = more asks (bearish)
  if (imbalance > 0.3) return 'text-accent-green';
  if (imbalance < -0.3) return 'text-accent-red';
  return 'text-text-secondary';
}

export function calculateConfidenceLevel(confidence: number): {
  level: 'low' | 'medium' | 'high' | 'very-high';
  color: string;
} {
  if (confidence >= 80) return { level: 'very-high', color: 'bg-accent-green' };
  if (confidence >= 60) return { level: 'high', color: 'bg-accent-blue' };
  if (confidence >= 40) return { level: 'medium', color: 'bg-accent-yellow' };
  return { level: 'low', color: 'bg-text-secondary' };
}

export function getNextFundingTime(): Date {
  // Funding occurs every 8 hours at 00:00, 08:00, 16:00 UTC
  const now = new Date();
  const utcHour = now.getUTCHours();

  let nextFundingHour: number;
  if (utcHour < 8) nextFundingHour = 8;
  else if (utcHour < 16) nextFundingHour = 16;
  else nextFundingHour = 24; // Next day 00:00

  const nextFunding = new Date(now);
  nextFunding.setUTCHours(nextFundingHour % 24, 0, 0, 0);

  if (nextFundingHour === 24) {
    nextFunding.setUTCDate(nextFunding.getUTCDate() + 1);
  }

  return nextFunding;
}

export function getSecondsUntilFunding(): number {
  const nextFunding = getNextFundingTime();
  const now = new Date();
  return Math.max(0, Math.floor((nextFunding.getTime() - now.getTime()) / 1000));
}
