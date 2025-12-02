import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Activity, BarChart3 } from 'lucide-react';
import { formatPrice, formatPercent, formatVolume, formatFundingRate, formatCountdown } from '../utils/formatters';
import { getSecondsUntilFunding } from '../utils/calculations';
import type { PriceData } from '../types';

interface PricePanelProps {
  priceData: PriceData | null;
}

export function PricePanel({ priceData }: PricePanelProps) {
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [fundingCountdown, setFundingCountdown] = useState(getSecondsUntilFunding());
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const prevPriceRef = useRef<number | null>(null);

  // Update price flash effect
  useEffect(() => {
    if (priceData?.last_price && prevPriceRef.current !== null) {
      if (priceData.last_price > prevPriceRef.current) {
        setPriceFlash('up');
      } else if (priceData.last_price < prevPriceRef.current) {
        setPriceFlash('down');
      }
      setTimeout(() => setPriceFlash(null), 500);
    }
    if (priceData?.last_price) {
      prevPriceRef.current = priceData.last_price;
      setPriceHistory(prev => [...prev.slice(-59), priceData.last_price]);
    }
  }, [priceData?.last_price]);

  // Funding countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setFundingCountdown(getSecondsUntilFunding());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!priceData) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border-color p-6 animate-pulse">
        <div className="h-8 bg-bg-tertiary rounded w-48 mb-4" />
        <div className="h-12 bg-bg-tertiary rounded w-64 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  const priceChange = priceData.price_change_pct;
  const isPositive = priceChange >= 0;

  // Mini sparkline
  const renderSparkline = () => {
    if (priceHistory.length < 2) return null;

    const min = Math.min(...priceHistory);
    const max = Math.max(...priceHistory);
    const range = max - min || 1;
    const width = 120;
    const height = 30;

    const points = priceHistory.map((price, i) => {
      const x = (i / (priceHistory.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#3fb950' : '#f85149'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-sm font-medium">BTC-PERPETUAL</span>
          <span className="px-2 py-0.5 bg-accent-blue/20 text-accent-blue text-xs rounded-full">DERIBIT</span>
        </div>
        <div className="flex items-center gap-2">
          {renderSparkline()}
        </div>
      </div>

      {/* Main Price */}
      <motion.div
        className={`mb-6 ${priceFlash === 'up' ? 'animate-flash-green' : priceFlash === 'down' ? 'animate-flash-red' : ''}`}
        key={priceData.last_price}
      >
        <div className="flex items-baseline gap-4">
          <span className="text-4xl font-bold text-text-primary">
            {formatPrice(priceData.last_price, 2)}
          </span>
          <motion.div
            className={`flex items-center gap-1 text-lg font-medium ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.3 }}
          >
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {formatPercent(priceChange)}
          </motion.div>
        </div>
      </motion.div>

      {/* Secondary Prices */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-border-color">
        <div>
          <span className="text-text-secondary text-xs">Mark Price</span>
          <div className="text-text-primary font-medium">{formatPrice(priceData.mark_price, 2)}</div>
        </div>
        <div>
          <span className="text-text-secondary text-xs">Index Price</span>
          <div className="text-text-primary font-medium">{formatPrice(priceData.index_price, 2)}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Funding Rate */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center gap-1 text-text-secondary text-xs mb-1">
            <Clock size={12} />
            Funding (8h)
          </div>
          <div className={`font-medium ${priceData.funding_rate >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {formatFundingRate(priceData.funding_rate)}
          </div>
          <div className="text-text-secondary text-xs mt-1">
            Next: {formatCountdown(fundingCountdown)}
          </div>
        </div>

        {/* Basis */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center gap-1 text-text-secondary text-xs mb-1">
            <Activity size={12} />
            Basis
          </div>
          <div className={`font-medium ${priceData.basis >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {priceData.basis >= 0 ? '+' : ''}{formatPrice(priceData.basis, 2)}
          </div>
          <div className="text-text-secondary text-xs mt-1">
            {formatPercent(priceData.basis_pct, 4)}
          </div>
        </div>

        {/* 24h Volume */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center gap-1 text-text-secondary text-xs mb-1">
            <BarChart3 size={12} />
            24h Volume
          </div>
          <div className="text-text-primary font-medium">
            {formatVolume(priceData.volume_usd)}
          </div>
          <div className="text-text-secondary text-xs mt-1">
            {priceData.volume_24h.toFixed(2)} BTC
          </div>
        </div>

        {/* Open Interest */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center gap-1 text-text-secondary text-xs mb-1">
            <Activity size={12} />
            Open Interest
          </div>
          <div className="text-text-primary font-medium">
            {formatVolume(priceData.open_interest * priceData.last_price)}
          </div>
          <div className="text-text-secondary text-xs mt-1">
            {priceData.open_interest.toFixed(2)} BTC
          </div>
        </div>
      </div>

      {/* 24h Range */}
      <div className="mt-4 pt-4 border-t border-border-color">
        <div className="flex justify-between text-xs text-text-secondary mb-2">
          <span>24h Low: {formatPrice(priceData.low_24h, 2)}</span>
          <span>24h High: {formatPrice(priceData.high_24h, 2)}</span>
        </div>
        <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-accent-red via-accent-yellow to-accent-green rounded-full"
            style={{ width: '100%' }}
          />
          <motion.div
            className="absolute w-2 h-2 bg-white rounded-full shadow-lg"
            style={{
              left: `${((priceData.last_price - priceData.low_24h) / (priceData.high_24h - priceData.low_24h)) * 100}%`,
              transform: 'translateX(-50%)'
            }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}
