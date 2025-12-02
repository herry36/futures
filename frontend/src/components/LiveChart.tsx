import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, LineStyle, Time } from 'lightweight-charts';

interface LiveChartProps {
  price: number;
  positions?: Array<{
    direction: 'LONG' | 'SHORT';
    entry_price: number;
    stop_loss: number;
    take_profit: number;
  }>;
}

export function LiveChart({ price, positions = [] }: LiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m'>('1m');

  // Store candle data
  const lastCandleTimeRef = useRef<number>(0);
  const currentCandleRef = useRef<any>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Get interval in seconds based on timeframe
  const getInterval = useCallback(() => {
    return timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;
  }, [timeframe]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#00e0e0',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#00e0e0',
        },
        horzLine: {
          color: '#00e0e0',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#00e0e0',
        },
      },
      rightPriceScale: {
        borderColor: '#2b3139',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00c787',
      downColor: '#ea383b',
      borderDownColor: '#ea383b',
      borderUpColor: '#00c787',
      wickDownColor: '#ea383b',
      wickUpColor: '#00c787',
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#00e0e0',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

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
      isInitializedRef.current = false;
    };
  }, []);

  // Initialize data when price becomes available
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !price || price === 0) return;
    if (isInitializedRef.current) return;

    const interval = getInterval();
    const now = Math.floor(Date.now() / 1000);
    const currentCandleTime = Math.floor(now / interval) * interval;

    // Generate historical data ending at the current candle time
    const historicalData = generateHistoricalData(100, price, interval, currentCandleTime);

    candleSeriesRef.current.setData(historicalData);

    // Generate volume data
    const volumeData = historicalData.map((candle: any) => ({
      time: candle.time,
      value: Math.random() * 1000 + 500,
      color: candle.close >= candle.open ? 'rgba(0, 199, 135, 0.5)' : 'rgba(234, 56, 59, 0.5)',
    }));
    volumeSeriesRef.current.setData(volumeData);

    // Set the last candle as current
    const lastCandle = historicalData[historicalData.length - 1];
    lastCandleTimeRef.current = lastCandle.time as number;
    currentCandleRef.current = { ...lastCandle };

    isInitializedRef.current = true;

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [price, getInterval]);

  // Update chart with new price
  useEffect(() => {
    if (!candleSeriesRef.current || !isInitializedRef.current || !price || price === 0) return;

    const interval = getInterval();
    const now = Math.floor(Date.now() / 1000);
    const candleTime = Math.floor(now / interval) * interval;

    // Only update if candleTime is >= lastCandleTime
    if (candleTime < lastCandleTimeRef.current) {
      return; // Skip updates for old timestamps
    }

    try {
      if (candleTime === lastCandleTimeRef.current && currentCandleRef.current) {
        // Update current candle
        const updated = {
          time: candleTime as Time,
          open: currentCandleRef.current.open,
          high: Math.max(currentCandleRef.current.high, price),
          low: Math.min(currentCandleRef.current.low, price),
          close: price,
        };
        currentCandleRef.current = updated;
        candleSeriesRef.current.update(updated);
      } else if (candleTime > lastCandleTimeRef.current) {
        // New candle
        const newCandle = {
          time: candleTime as Time,
          open: price,
          high: price,
          low: price,
          close: price,
        };
        currentCandleRef.current = newCandle;
        lastCandleTimeRef.current = candleTime;
        candleSeriesRef.current.update(newCandle);

        // Update volume
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: candleTime as Time,
            value: Math.random() * 1000 + 500,
            color: 'rgba(0, 224, 224, 0.5)',
          });
        }
      }
    } catch (error) {
      // Silently ignore update errors (can happen during rapid updates)
      console.debug('Chart update skipped:', error);
    }
  }, [price, getInterval]);

  // Handle timeframe change
  const handleTimeframeChange = (tf: '1m' | '5m' | '15m') => {
    if (tf === timeframe) return;

    setTimeframe(tf);
    isInitializedRef.current = false;
    currentCandleRef.current = null;
    lastCandleTimeRef.current = 0;
  };

  return (
    <div className="card h-[500px] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-kc-border flex items-center justify-between">
        <span className="text-sm font-medium text-kc-text">BTC-PERPETUAL</span>
        <div className="flex items-center gap-1">
          {(['1m', '5m', '15m'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                timeframe === tf
                  ? 'bg-kc-cyan/20 text-kc-cyan'
                  : 'bg-kc-bg-lighter hover:bg-kc-border-light text-kc-text-secondary hover:text-kc-text'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="flex-1" />
    </div>
  );
}

// Generate historical candle data
function generateHistoricalData(count: number, currentPrice: number, interval: number, endTime: number) {
  const data: any[] = [];
  let price = currentPrice - (Math.random() * 500 - 250); // Start slightly different

  for (let i = count; i >= 0; i--) {
    const time = endTime - i * interval;
    const volatility = Math.random() * 50 + 10;
    const change = (Math.random() - 0.5) * volatility;

    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;

    data.push({
      time: time as Time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    price = close;
  }

  // Adjust last candle to current price
  if (data.length > 0) {
    const lastCandle = data[data.length - 1];
    lastCandle.close = currentPrice;
    lastCandle.high = Math.max(lastCandle.high, currentPrice);
    lastCandle.low = Math.min(lastCandle.low, currentPrice);
  }

  return data;
}
