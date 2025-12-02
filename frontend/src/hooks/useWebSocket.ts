import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  PriceData,
  OrderBookData,
  Position,
  Signal,
  MLPrediction,
  PnLData,
  TradeEvent,
  ConnectionStatus
} from '../types';

interface WebSocketState {
  connectionStatus: ConnectionStatus;
  priceData: PriceData | null;
  orderBookData: OrderBookData | null;
  positions: Position[];
  signals: Signal[];
  mlPrediction: MLPrediction | null;
  pnlData: PnLData | null;
  lastTradeOpened: TradeEvent | null;
  lastTradeClosed: TradeEvent | null;
}

interface UseWebSocketReturn extends WebSocketState {
  reconnect: () => void;
}

// Get the backend URL - always use port 5000 for the Flask backend
const getBackendUrl = (): string => {
  const hostname = window.location.hostname;
  return `http://${hostname}:5000`;
};

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [orderBookData, setOrderBookData] = useState<OrderBookData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mlPrediction, setMlPrediction] = useState<MLPrediction | null>(null);
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [lastTradeOpened, setLastTradeOpened] = useState<TradeEvent | null>(null);
  const [lastTradeClosed, setLastTradeClosed] = useState<TradeEvent | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const backendUrl = getBackendUrl();
    console.log('🔌 Connecting to WebSocket at:', backendUrl);

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected!');
      setConnectionStatus('connected');
      socket.emit('subscribe', { channels: ['price', 'orderbook', 'positions', 'signals', 'pnl'] });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('⚠️ WebSocket connection error:', error.message);
      setConnectionStatus('disconnected');
    });

    socket.on('connected', (data) => {
      console.log('📡 Server confirmed connection:', data);
    });

    socket.on('subscribed', (data) => {
      console.log('📢 Subscribed to updates:', data);
    });

    // Price updates
    socket.on('price_update', (data: PriceData) => {
      setPriceData(data);
    });

    // Orderbook updates
    socket.on('orderbook_update', (data: OrderBookData) => {
      setOrderBookData(data);
    });

    // Positions updates
    socket.on('positions_update', (data: { positions: Position[]; count: number }) => {
      setPositions(data.positions);
    });

    // Signals updates
    socket.on('signals_update', (data: { signals: Signal[]; ml_prediction: MLPrediction }) => {
      setSignals(data.signals);
      setMlPrediction(data.ml_prediction);
    });

    // P&L updates
    socket.on('pnl_update', (data: PnLData) => {
      setPnlData(data);
    });

    // Trade events
    socket.on('trade_opened', (data: TradeEvent) => {
      console.log('🚀 Trade opened:', data);
      setLastTradeOpened(data);
    });

    socket.on('trade_closed', (data: TradeEvent) => {
      console.log('📊 Trade closed:', data);
      setLastTradeClosed(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const reconnect = useCallback(() => {
    console.log('🔄 Reconnecting...');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus('connecting');
    setTimeout(connect, 500);
  }, [connect]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  return {
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
  };
}
