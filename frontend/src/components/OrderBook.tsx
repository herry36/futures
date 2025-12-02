import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatPrice, formatNumber } from '../utils/formatters';
import type { OrderBookData, PriceData } from '../types';

interface OrderBookProps {
  orderBookData: OrderBookData | null;
  priceData: PriceData | null;
}

export function OrderBook({ orderBookData, priceData }: OrderBookProps) {
  // Generate display data
  const { bids, asks, maxDepth } = useMemo(() => {
    if (!priceData?.last_price) {
      return { bids: [], asks: [], maxDepth: 0 };
    }

    const basePrice = priceData.last_price;
    const bidDepth = orderBookData?.bid_depth || 100;
    const askDepth = orderBookData?.ask_depth || 100;
    const imbalance = orderBookData?.book_imbalance || 0;

    // Generate synthetic orderbook levels
    const bids: { price: number; size: number; total: number }[] = [];
    const asks: { price: number; size: number; total: number }[] = [];

    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < 10; i++) {
      const bidPrice = basePrice - (i + 1) * 2;
      const askPrice = basePrice + (i + 1) * 2;

      // Size influenced by imbalance
      const bidSize = (bidDepth / 10) * (1 + Math.random() * 0.5) * (1 + imbalance * 0.5);
      const askSize = (askDepth / 10) * (1 + Math.random() * 0.5) * (1 - imbalance * 0.5);

      bidTotal += bidSize;
      askTotal += askSize;

      bids.push({ price: bidPrice, size: bidSize, total: bidTotal });
      asks.unshift({ price: askPrice, size: askSize, total: askTotal });
    }

    const maxDepth = Math.max(bidTotal, askTotal);
    return { bids, asks: asks.reverse(), maxDepth };
  }, [orderBookData, priceData]);

  if (!priceData?.last_price) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border-color p-4 h-full">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-bg-tertiary rounded w-24" />
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-6 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  const imbalance = orderBookData?.book_imbalance || 0;
  const spread = priceData.spread || (priceData.ask - priceData.bid);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Order Book</h3>
          <motion.div
            className={`flex items-center gap-1 text-xs font-medium ${
              imbalance > 0.1 ? 'text-accent-green' : imbalance < -0.1 ? 'text-accent-red' : 'text-text-secondary'
            }`}
            animate={{ scale: Math.abs(imbalance) > 0.2 ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.5, repeat: Math.abs(imbalance) > 0.2 ? Infinity : 0 }}
          >
            {imbalance > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {(imbalance * 100).toFixed(1)}%
          </motion.div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-text-secondary border-b border-border-color">
        <span>Price</span>
        <span className="text-right">Size (BTC)</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sells) */}
      <div className="flex-1 overflow-hidden">
        <div className="space-y-0.5 px-2 py-1">
          {asks.map((ask, i) => (
            <motion.div
              key={`ask-${i}`}
              className="relative grid grid-cols-3 gap-2 px-2 py-1 text-xs rounded"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              {/* Depth bar */}
              <div
                className="absolute inset-y-0 right-0 bg-accent-red/20 rounded"
                style={{ width: `${(ask.total / maxDepth) * 100}%` }}
              />
              <span className="relative text-accent-red font-medium">{formatPrice(ask.price, 2)}</span>
              <span className="relative text-right text-text-secondary">{formatNumber(ask.size, 4)}</span>
              <span className="relative text-right text-text-secondary">{formatNumber(ask.total, 2)}</span>
            </motion.div>
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-2 py-2 my-1 bg-bg-tertiary border-y border-border-color">
          <span className="text-text-secondary text-xs">Spread:</span>
          <span className="text-accent-blue text-xs font-medium">{formatPrice(spread, 2)}</span>
          <span className="text-text-secondary text-xs">({((spread / priceData.last_price) * 100).toFixed(4)}%)</span>
        </div>

        {/* Bids (Buys) */}
        <div className="space-y-0.5 px-2 py-1">
          {bids.map((bid, i) => (
            <motion.div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 gap-2 px-2 py-1 text-xs rounded"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              {/* Depth bar */}
              <div
                className="absolute inset-y-0 right-0 bg-accent-green/20 rounded"
                style={{ width: `${(bid.total / maxDepth) * 100}%` }}
              />
              <span className="relative text-accent-green font-medium">{formatPrice(bid.price, 2)}</span>
              <span className="relative text-right text-text-secondary">{formatNumber(bid.size, 4)}</span>
              <span className="relative text-right text-text-secondary">{formatNumber(bid.total, 2)}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer - Imbalance Indicator */}
      <div className="px-4 py-3 border-t border-border-color bg-bg-tertiary">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-text-secondary">Book Imbalance</span>
          <span className={imbalance > 0 ? 'text-accent-green' : 'text-accent-red'}>
            {imbalance > 0 ? 'Bullish' : 'Bearish'}
          </span>
        </div>
        <div className="relative h-2 bg-bg-primary rounded-full overflow-hidden">
          <motion.div
            className={`absolute h-full ${imbalance > 0 ? 'bg-accent-green' : 'bg-accent-red'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.abs(imbalance) * 50 + 50}%` }}
            style={{
              left: imbalance > 0 ? '50%' : undefined,
              right: imbalance < 0 ? '50%' : undefined,
            }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text-secondary" />
        </div>
      </div>
    </div>
  );
}
