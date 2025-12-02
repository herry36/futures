import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, RefreshCw, CheckCircle, XCircle, Clock, Database } from 'lucide-react';
import { formatTimeAgo } from '../utils/formatters';
import type { MLStatus as MLStatusType } from '../types';

interface MLStatusPanelProps {
  mlStatus: MLStatusType | null;
  onRetrain: () => void;
}

export function MLStatusPanel({ mlStatus, onRetrain }: MLStatusPanelProps) {
  const [isRetraining, setIsRetraining] = useState(false);

  const handleRetrain = async () => {
    setIsRetraining(true);
    await onRetrain();
    // Keep spinning for a few seconds to indicate training is in progress
    setTimeout(() => setIsRetraining(false), 5000);
  };

  if (!mlStatus) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border-color p-4 animate-pulse">
        <div className="h-4 bg-bg-tertiary rounded w-24 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  const isActive = mlStatus.xgb_active || mlStatus.pytorch_active;
  const ensembleAccuracy = mlStatus.xgb_active && mlStatus.pytorch_active
    ? (mlStatus.xgb_accuracy * 0.6 + mlStatus.pytorch_accuracy * 0.4)
    : mlStatus.xgb_active
    ? mlStatus.xgb_accuracy
    : mlStatus.pytorch_accuracy;

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-color">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent-purple" />
            <h3 className="text-sm font-medium text-text-primary">ML Engine Status</h3>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-accent-yellow/20 text-accent-yellow'
          }`}>
            <motion.div
              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent-green' : 'bg-accent-yellow'}`}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {isActive ? 'ACTIVE' : 'LEARNING'}
          </div>
        </div>
      </div>

      {/* Models */}
      <div className="p-4 space-y-4">
        {/* XGBoost */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">XGBoost</span>
              {mlStatus.xgb_active ? (
                <CheckCircle size={12} className="text-accent-green" />
              ) : (
                <XCircle size={12} className="text-accent-red" />
              )}
            </div>
            <span className="text-xs text-text-secondary">Weight: 60%</span>
          </div>
          <div className="relative h-2 bg-bg-primary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-blue to-accent-purple rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${mlStatus.xgb_accuracy}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-secondary">Accuracy</span>
            <span className="text-xs text-text-primary font-medium">{mlStatus.xgb_accuracy.toFixed(1)}%</span>
          </div>
        </div>

        {/* PyTorch */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">PyTorch Neural Net</span>
              {mlStatus.pytorch_active ? (
                <CheckCircle size={12} className="text-accent-green" />
              ) : (
                <XCircle size={12} className="text-accent-red" />
              )}
            </div>
            <span className="text-xs text-text-secondary">Weight: 40%</span>
          </div>
          <div className="relative h-2 bg-bg-primary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${mlStatus.pytorch_accuracy}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-secondary">Accuracy</span>
            <span className="text-xs text-text-primary font-medium">{mlStatus.pytorch_accuracy.toFixed(1)}%</span>
          </div>
        </div>

        {/* Ensemble */}
        <div className="bg-bg-primary rounded-lg p-3 border border-border-color">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-accent-purple">Ensemble Accuracy</span>
          </div>
          <div className="relative h-3 bg-bg-tertiary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-green via-accent-blue to-accent-purple rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${ensembleAccuracy}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-lg font-bold text-text-primary">{ensembleAccuracy.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-t border-border-color bg-bg-tertiary">
        <div className="flex items-center justify-between text-xs mb-3">
          <div className="flex items-center gap-1 text-text-secondary">
            <Database size={12} />
            Training Samples
          </div>
          <span className="text-text-primary font-medium">{mlStatus.total_trades}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-text-secondary">
            <Clock size={12} />
            Last Training
          </div>
          <span className="text-text-primary">
            {mlStatus.last_training ? formatTimeAgo(mlStatus.last_training) : 'Never'}
          </span>
        </div>
      </div>

      {/* Retrain Button */}
      <div className="px-4 py-3 border-t border-border-color">
        <motion.button
          onClick={handleRetrain}
          disabled={isRetraining}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-purple/20 text-accent-purple rounded-lg hover:bg-accent-purple/30 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            animate={{ rotate: isRetraining ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRetraining ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw size={14} />
          </motion.div>
          {isRetraining ? 'Training...' : 'Retrain Now'}
        </motion.button>
      </div>
    </div>
  );
}
