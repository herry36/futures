import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle } from 'lucide-react';
import { calculateConfidenceLevel } from '../utils/calculations';
import type { Signal, MLPrediction } from '../types';

interface SignalsPanelProps {
  signals: Signal[];
  mlPrediction: MLPrediction | null;
}

const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  MOMENTUM: <TrendingUp size={14} />,
  MEAN_REVERSION: <TrendingDown size={14} />,
  FUNDING_ARB: <span className="text-xs">%</span>,
  LIQUIDATION_HUNT: <span className="text-xs">$</span>,
  ML_SIGNAL: <Brain size={14} />,
};

export function SignalsPanel({ signals, mlPrediction }: SignalsPanelProps) {
  // Get unique signals by strategy
  const strategySignals = new Map<string, Signal>();
  signals.forEach(s => {
    if (!strategySignals.has(s.strategy) || s.confidence > strategySignals.get(s.strategy)!.confidence) {
      strategySignals.set(s.strategy, s);
    }
  });

  // All possible strategies
  const allStrategies = ['MOMENTUM', 'MEAN_REVERSION', 'FUNDING_ARB', 'LIQUIDATION_HUNT', 'ML_SIGNAL'];

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent-purple" />
          <h3 className="text-sm font-medium text-text-primary">ML Signals</h3>
        </div>
      </div>

      {/* Signals List */}
      <div className="p-4 space-y-3">
        {allStrategies.map((strategy) => {
          const signal = strategySignals.get(strategy);
          const hasSignal = signal && signal.direction;
          const confidence = signal?.confidence || 0;
          const { level, color } = calculateConfidenceLevel(confidence);

          return (
            <motion.div
              key={strategy}
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">{STRATEGY_ICONS[strategy]}</span>
                  <span className="text-xs font-medium text-text-primary">{strategy.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasSignal ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      signal.direction === 'LONG'
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-red/20 text-accent-red'
                    }`}>
                      {signal.direction}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-text-secondary">
                      <Minus size={12} />
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${hasSignal ? color : 'bg-text-secondary/30'} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                {/* Confidence markers */}
                <div className="absolute inset-0 flex justify-between px-px">
                  {[25, 50, 75].map((mark) => (
                    <div
                      key={mark}
                      className="w-px h-full bg-bg-primary/50"
                      style={{ marginLeft: `${mark}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Confidence percentage */}
              <div className="flex justify-end mt-0.5">
                <span className="text-[10px] text-text-secondary">{confidence.toFixed(0)}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Ensemble Result */}
      <div className="px-4 py-4 border-t border-border-color bg-bg-tertiary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent-purple" />
            <span className="text-sm font-medium text-text-primary">ENSEMBLE</span>
          </div>
          {mlPrediction?.direction ? (
            <motion.span
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                mlPrediction.direction === 'LONG'
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'bg-accent-red/20 text-accent-red'
              }`}
              animate={{
                scale: mlPrediction.confidence > 70 ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 0.5, repeat: mlPrediction.confidence > 70 ? Infinity : 0 }}
            >
              {mlPrediction.direction === 'LONG' ? <TrendingUp size={14} className="inline mr-1" /> : <TrendingDown size={14} className="inline mr-1" />}
              {mlPrediction.direction}
            </motion.span>
          ) : (
            <span className="px-3 py-1 rounded-lg text-sm font-medium bg-bg-primary text-text-secondary">
              NEUTRAL
            </span>
          )}
        </div>

        {/* Ensemble Confidence Bar */}
        <div className="relative h-3 bg-bg-primary rounded-full overflow-hidden mb-2">
          <motion.div
            className={`h-full rounded-full ${
              mlPrediction && mlPrediction.confidence > 70
                ? 'bg-gradient-to-r from-accent-green/80 to-accent-green'
                : mlPrediction && mlPrediction.confidence > 50
                ? 'bg-gradient-to-r from-accent-blue/80 to-accent-blue'
                : 'bg-gradient-to-r from-text-secondary/50 to-text-secondary'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${mlPrediction?.confidence || 0}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">Confidence: {mlPrediction?.confidence?.toFixed(1) || 0}%</span>
        </div>

        {/* XGB/PyTorch Agreement */}
        <div className="mt-3 pt-3 border-t border-border-color/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">XGB: 60%</span>
            <span className="text-text-secondary">|</span>
            <span className="text-text-secondary">PT: 40%</span>
            <span className="text-text-secondary">|</span>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">Agreement:</span>
              {mlPrediction?.confidence && mlPrediction.confidence > 60 ? (
                <CheckCircle size={12} className="text-accent-green" />
              ) : (
                <XCircle size={12} className="text-accent-red" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
