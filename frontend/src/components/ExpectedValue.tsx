import { motion } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';

interface ExpectedValueProps {
  totalTrades: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
}

export function ExpectedValue({ totalTrades, wins, losses, avgWin, avgLoss }: ExpectedValueProps) {
  // Calculate probabilities
  const pWin = totalTrades > 0 ? wins / totalTrades : 0;
  const pLoss = totalTrades > 0 ? losses / totalTrades : 0;

  // Expected Value formula: E = (P_win × Avg_win) - (P_loss × Avg_loss)
  const expectedValue = (pWin * avgWin) - (pLoss * Math.abs(avgLoss));
  const isPositive = expectedValue >= 0;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-kc-border bg-gradient-to-r from-kc-bg via-kc-bg-light to-kc-bg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={14} className="text-kc-cyan" />
            <span className="text-sm font-medium">Expected Value Calculator</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-kc-text-secondary">
            <span>per trade</span>
          </div>
        </div>
      </div>

      {/* Main Formula Display - Neon Sign Style */}
      <div className="relative p-6 bg-gradient-to-b from-kc-bg to-kc-bg-light">
        {/* Glowing background effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-red-500/10 blur-3xl rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-24 bg-kc-cyan/5 blur-2xl rounded-full" />
        </div>

        {/* Formula Header - Big Neon E = */}
        <div className="relative text-center mb-4">
          <motion.div
            className="inline-block"
            animate={{
              textShadow: [
                '0 0 10px rgba(234, 56, 59, 0.8), 0 0 20px rgba(234, 56, 59, 0.6), 0 0 30px rgba(234, 56, 59, 0.4)',
                '0 0 15px rgba(234, 56, 59, 1), 0 0 30px rgba(234, 56, 59, 0.8), 0 0 45px rgba(234, 56, 59, 0.6)',
                '0 0 10px rgba(234, 56, 59, 0.8), 0 0 20px rgba(234, 56, 59, 0.6), 0 0 30px rgba(234, 56, 59, 0.4)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-4xl font-black tracking-wider text-red-500" style={{
              textShadow: '0 0 10px rgba(234, 56, 59, 0.8), 0 0 20px rgba(234, 56, 59, 0.6), 0 0 30px rgba(234, 56, 59, 0.4), 0 0 40px rgba(234, 56, 59, 0.2)'
            }}>
              E =
            </span>
          </motion.div>
        </div>

        {/* Full Formula Display */}
        <div className="relative bg-kc-bg/80 backdrop-blur-sm rounded-xl p-4 border border-kc-border-light mb-4">
          <div className="text-center space-y-3">
            {/* Simplified formula */}
            <div className="flex items-center justify-center gap-2 text-lg font-mono flex-wrap">
              <motion.span
                className="text-red-500 font-bold text-2xl"
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ textShadow: '0 0 10px rgba(234, 56, 59, 0.6)' }}
              >
                E
              </motion.span>
              <span className="text-kc-text-secondary">=</span>
              <span className="text-kc-green">(P<sub>win</sub> × Avg<sub>win</sub>)</span>
              <span className="text-kc-text-secondary"></span>
              <span className="text-kc-red">(P<sub>loss</sub> × Avg<sub>loss</sub>)</span>
            </div>

            {/* Expanded formula */}
            <div className="text-xs text-kc-text-secondary border-t border-kc-border pt-3 mt-3">
              <div className="flex items-center justify-center gap-1 flex-wrap leading-6">
                <span className="text-red-500 font-bold" style={{ textShadow: '0 0 5px rgba(234, 56, 59, 0.5)' }}>E</span>
                <span>=</span>
                <span className="text-kc-green">(</span>
                <span className="text-kc-text">
                  <span className="border-b border-kc-text-secondary px-1">Winning Trades</span>
                  <span className="mx-1">÷</span>
                  <span className="border-b border-kc-text-secondary px-1">Total Trades</span>
                </span>
                <span className="mx-1">×</span>
                <span className="text-kc-green">Avg Win</span>
                <span className="text-kc-green">)</span>
                <span className="mx-1"></span>
                <span className="text-kc-red">(</span>
                <span className="text-kc-text">
                  <span className="border-b border-kc-text-secondary px-1">Losing Trades</span>
                  <span className="mx-1">÷</span>
                  <span className="border-b border-kc-text-secondary px-1">Total Trades</span>
                </span>
                <span className="mx-1">×</span>
                <span className="text-kc-red">Avg Loss</span>
                <span className="text-kc-red">)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Values */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-kc-bg-lighter rounded-lg p-3 text-center border border-kc-border">
            <div className="text-[10px] text-kc-text-secondary uppercase tracking-wider mb-1">Win Probability</div>
            <div className="text-lg font-bold font-mono text-kc-green">{(pWin * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-kc-text-muted">{wins}/{totalTrades} trades</div>
          </div>
          <div className="bg-kc-bg-lighter rounded-lg p-3 text-center border border-kc-border">
            <div className="text-[10px] text-kc-text-secondary uppercase tracking-wider mb-1">Loss Probability</div>
            <div className="text-lg font-bold font-mono text-kc-red">{(pLoss * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-kc-text-muted">{losses}/{totalTrades} trades</div>
          </div>
          <div className="bg-kc-bg-lighter rounded-lg p-3 text-center border border-kc-border">
            <div className="text-[10px] text-kc-text-secondary uppercase tracking-wider mb-1">Average Win</div>
            <div className="text-lg font-bold font-mono text-kc-green">+${avgWin.toFixed(2)}</div>
          </div>
          <div className="bg-kc-bg-lighter rounded-lg p-3 text-center border border-kc-border">
            <div className="text-[10px] text-kc-text-secondary uppercase tracking-wider mb-1">Average Loss</div>
            <div className="text-lg font-bold font-mono text-kc-red">-${Math.abs(avgLoss).toFixed(2)}</div>
          </div>
        </div>

        {/* RESULT - Big Neon Display */}
        <motion.div
          className={`relative rounded-xl p-6 text-center overflow-hidden ${
            isPositive
              ? 'bg-gradient-to-r from-kc-green/10 via-kc-green/20 to-kc-green/10 border border-kc-green/30'
              : 'bg-gradient-to-r from-kc-red/10 via-kc-red/20 to-kc-red/10 border border-kc-red/30'
          }`}
          animate={{
            boxShadow: isPositive
              ? ['0 0 20px rgba(0, 199, 135, 0.2)', '0 0 40px rgba(0, 199, 135, 0.4)', '0 0 20px rgba(0, 199, 135, 0.2)']
              : ['0 0 20px rgba(234, 56, 59, 0.2)', '0 0 40px rgba(234, 56, 59, 0.4)', '0 0 20px rgba(234, 56, 59, 0.2)']
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Glow effect */}
          <div className={`absolute inset-0 ${isPositive ? 'bg-kc-green/5' : 'bg-kc-red/5'} blur-xl`} />

          <div className="relative">
            <div className="text-xs text-kc-text-secondary uppercase tracking-widest mb-2">
              Expected Value Per Trade
            </div>
            <motion.div
              className={`text-5xl font-black font-mono ${isPositive ? 'text-kc-green' : 'text-kc-red'}`}
              animate={{
                textShadow: isPositive
                  ? ['0 0 10px rgba(0, 199, 135, 0.5)', '0 0 20px rgba(0, 199, 135, 0.8)', '0 0 10px rgba(0, 199, 135, 0.5)']
                  : ['0 0 10px rgba(234, 56, 59, 0.5)', '0 0 20px rgba(234, 56, 59, 0.8)', '0 0 10px rgba(234, 56, 59, 0.5)']
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {isPositive ? '+' : ''}{expectedValue.toFixed(2)}
              <span className="text-2xl ml-1">USD</span>
            </motion.div>
            <div className="flex items-center justify-center gap-2 mt-3">
              {isPositive ? (
                <>
                  <TrendingUp className="text-kc-green" size={18} />
                  <span className="text-sm text-kc-green font-medium">Profitable Strategy</span>
                </>
              ) : (
                <>
                  <TrendingDown className="text-kc-red" size={18} />
                  <span className="text-sm text-kc-red font-medium">Review Strategy</span>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Calculation breakdown */}
        <div className="relative mt-4 p-3 bg-kc-bg/50 rounded-lg border border-kc-border text-xs text-center text-kc-text-secondary">
          <span className="text-red-500 font-bold" style={{ textShadow: '0 0 5px rgba(234, 56, 59, 0.5)' }}>E</span>
          <span> = </span>
          <span className="text-kc-green">({(pWin * 100).toFixed(1)}% × ${avgWin.toFixed(2)})</span>
          <span>  </span>
          <span className="text-kc-red">({(pLoss * 100).toFixed(1)}% × ${Math.abs(avgLoss).toFixed(2)})</span>
          <span> = </span>
          <span className={`font-bold ${isPositive ? 'text-kc-green' : 'text-kc-red'}`}>
            ${expectedValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
