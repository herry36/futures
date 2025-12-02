import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineStyle } from 'lightweight-charts';
import { motion } from 'framer-motion';
import type { Position, PriceData } from '../types';

interface TradingChartProps {
  priceData: PriceData | null;
  positions: Position[];
}

type TimeframeType = '1m' | '5m' | '15m';

export function TradingChart({ priceData, positions }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeType>('1m');
  const [candleData, setCandleData] = useState<CandlestickData[]>([]);
  const currentCandleRef = useRef<CandlestickData | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#161b22' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#58a6ff',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#58a6ff',
        },
        horzLine: {
          color: '#58a6ff',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#58a6ff',
        },
      },
      rightPriceScale: {
        borderColor: '#30363d',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderDownColor: '#f85149',
      borderUpColor: '#3fb950',
      wickDownColor: '#f85149',
      wickUpColor: '#3fb950',
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#58a6ff',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Generate initial mock data
    const initialData = generateInitialCandleData(100);
    setCandleData(initialData);
    candleSeries.setData(initialData);

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update with real price data
  useEffect(() => {
    if (!priceData?.last_price || !candleSeriesRef.current) return;

    const now = Math.floor(Date.now() / 1000);
    const candleTime = getCandleTime(now, timeframe);

    if (currentCandleRef.current && currentCandleRef.current.time === candleTime) {
      // Update current candle
      const updated = {
        ...currentCandleRef.current,
        high: Math.max(currentCandleRef.current.high, priceData.last_price),
        low: Math.min(currentCandleRef.current.low, priceData.last_price),
        close: priceData.last_price,
      };
      currentCandleRef.current = updated;
      candleSeriesRef.current.update(updated);
    } else {
      // New candle
      const newCandle: CandlestickData = {
        time: candleTime as any,
        open: priceData.last_price,
        high: priceData.last_price,
        low: priceData.last_price,
        close: priceData.last_price,
      };
      currentCandleRef.current = newCandle;
      candleSeriesRef.current.update(newCandle);
    }

    // Add position markers
    if (chartRef.current && positions.length > 0) {
      positions.forEach(pos => {
        // Entry line
        candleSeriesRef.current?.createPriceLine({
          price: pos.entry_price,
          color: pos.direction === 'LONG' ? '#3fb950' : '#f85149',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${pos.direction} Entry`,
        });

        // SL line
        candleSeriesRef.current?.createPriceLine({
          price: pos.stop_loss,
          color: '#f85149',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'SL',
        });

        // TP line
        candleSeriesRef.current?.createPriceLine({
          price: pos.take_profit,
          color: '#3fb950',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'TP',
        });
      });
    }
  }, [priceData, timeframe, positions]);

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <h3 className="text-sm font-medium text-text-primary">BTC-PERPETUAL Chart</h3>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1">
          {(['1m', '5m', '15m'] as const).map((tf) => (
            <motion.button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {tf.toUpperCase()}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="flex-1 min-h-[300px]" />
    </div>
  );
}

// Helper functions
function getCandleTime(timestamp: number, timeframe: TimeframeType): number {
  const intervals: Record<TimeframeType, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
  };
  const interval = intervals[timeframe];
  return Math.floor(timestamp / interval) * interval;
}

function generateInitialCandleData(count: number): CandlestickData[] {
  const data: CandlestickData[] = [];
  const now = Math.floor(Date.now() / 1000);
  let price = 97000 + Math.random() * 2000;

  for (let i = count; i >= 0; i--) {
    const time = now - i * 60;
    const change = (Math.random() - 0.5) * 100;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 30;
    const low = Math.min(open, close) - Math.random() * 30;

    data.push({
      time: time as any,
      open,
      high,
      low,
      close,
    });

    price = close;
  }

  return data;
}
