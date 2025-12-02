import { useState, useEffect, useCallback } from 'react';
import type { TraderStatus, Metrics, Trade, OrderBookData } from '../types';

const API_BASE = '/api';

interface UseTraderDataReturn {
  status: TraderStatus | null;
  metrics: Metrics | null;
  trades: Trade[];
  totalTrades: number;
  orderbook: OrderBookData | null;
  isLoading: boolean;
  error: string | null;
  refetchStatus: () => Promise<void>;
  refetchMetrics: () => Promise<void>;
  refetchTrades: (options?: { limit?: number; offset?: number; strategy?: string; result?: string }) => Promise<void>;
  refetchOrderbook: () => Promise<void>;
  retrain: () => Promise<void>;
}

export function useTraderData(): UseTraderDataReturn {
  const [status, setStatus] = useState<TraderStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [orderbook, setOrderbook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Status fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Metrics fetch error:', err);
    }
  }, []);

  const fetchTrades = useCallback(async (options?: {
    limit?: number;
    offset?: number;
    strategy?: string;
    result?: string;
  }) => {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.strategy) params.append('strategy', options.strategy);
      if (options?.result) params.append('result', options.result);

      const response = await fetch(`${API_BASE}/trades?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      setTrades(data.trades);
      setTotalTrades(data.total);
    } catch (err) {
      console.error('Trades fetch error:', err);
    }
  }, []);

  const fetchOrderbook = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/orderbook`);
      if (!response.ok) throw new Error('Failed to fetch orderbook');
      const data = await response.json();
      setOrderbook(data);
    } catch (err) {
      console.error('Orderbook fetch error:', err);
    }
  }, []);

  const retrain = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/retrain`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start retraining');
      // Refetch metrics after a delay to see updated ML status
      setTimeout(fetchMetrics, 5000);
    } catch (err) {
      console.error('Retrain error:', err);
    }
  }, [fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStatus(),
        fetchMetrics(),
        fetchTrades({ limit: 50 }),
        fetchOrderbook()
      ]);
      setIsLoading(false);
    };

    init();
  }, [fetchStatus, fetchMetrics, fetchTrades, fetchOrderbook]);

  // Periodic refresh for metrics and trades (less frequent than WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchTrades({ limit: 50 });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [fetchMetrics, fetchTrades]);

  return {
    status,
    metrics,
    trades,
    totalTrades,
    orderbook,
    isLoading,
    error,
    refetchStatus: fetchStatus,
    refetchMetrics: fetchMetrics,
    refetchTrades: fetchTrades,
    refetchOrderbook: fetchOrderbook,
    retrain
  };
}
