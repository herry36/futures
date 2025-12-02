import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface Trade {
  id?: string;
  exit_time: string;
  pnl_usd: number;
  result?: string;
}

interface EquityCurveProps {
  trades: Trade[];
  sessionPnl?: number;
}

const STARTING_CAPITAL = 20000;

export function EquityCurve({ trades, sessionPnl = 0 }: EquityCurveProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [currentCapital, setCurrentCapital] = useState(STARTING_CAPITAL);

  // Calculate current capital from trades
  useEffect(() => {
    if (trades.length > 0) {
      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
      setCurrentCapital(STARTING_CAPITAL + totalPnl);
    } else {
      setCurrentCapital(STARTING_CAPITAL + sessionPnl);
    }
  }, [trades, sessionPnl]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.3)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#00e0e0', width: 1, style: 2 },
        horzLine: { color: '#00e0e0', width: 1, style: 2 },
      },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: '#00c787',
      topColor: 'rgba(0, 199, 135, 0.4)',
      bottomColor: 'rgba(0, 199, 135, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => '$' + price.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      },
    });

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!areaSeriesRef.current) return;

    const data: LineData[] = [];
    let equity = STARTING_CAPITAL;

    // Starting point
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 24);
    data.push({
      time: (startTime.getTime() / 1000) as Time,
      value: equity,
    });

    // Add trades chronologically
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime()
    );

    sortedTrades.forEach((trade) => {
      equity += trade.pnl_usd || 0;
      const tradeTime = new Date(trade.exit_time).getTime() / 1000;
      data.push({
        time: tradeTime as Time,
        value: equity,
      });
    });

    // Current point
    data.push({
      time: (Date.now() / 1000) as Time,
      value: equity,
    });

    // Update series color based on profit/loss
    const isProfit = equity >= STARTING_CAPITAL;
    areaSeriesRef.current.applyOptions({
      lineColor: isProfit ? '#00c787' : '#ea383b',
      topColor: isProfit ? 'rgba(0, 199, 135, 0.4)' : 'rgba(234, 56, 59, 0.4)',
      bottomColor: isProfit ? 'rgba(0, 199, 135, 0.0)' : 'rgba(234, 56, 59, 0.0)',
    });

    areaSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [trades]);

  const totalPnl = currentCapital - STARTING_CAPITAL;
  const pnlPercent = (totalPnl / STARTING_CAPITAL) * 100;
  const isProfit = totalPnl >= 0;

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-kc-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-kc-cyan" />
          <span className="text-sm font-medium">Equity Curve</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-kc-text-secondary">Starting Capital</div>
            <div className="text-sm font-mono text-kc-text">${STARTING_CAPITAL.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-kc-text-secondary">Current Capital</div>
            <div className={`text-lg font-bold font-mono ${isProfit ? 'text-kc-green' : 'text-kc-red'}`}>
              ${currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-kc-text-secondary">Total P&L</div>
            <div className={`flex items-center gap-1 text-sm font-mono font-medium ${isProfit ? 'text-kc-green' : 'text-kc-red'}`}>
              {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isProfit ? '+' : ''}{totalPnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" style={{ height: 200 }} />
    </div>
  );
}
