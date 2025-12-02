import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Moon, Sun, Bell, BellOff } from 'lucide-react';
import type { ConnectionStatus } from '../types';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  onReconnect: () => void;
}

export function Header({ connectionStatus, onReconnect }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [isDark, setIsDark] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUTCTime = (date: Date) => {
    return date.toISOString().slice(11, 19);
  };

  const formatUTCDate = (date: Date) => {
    return date.toISOString().slice(0, 10);
  };

  return (
    <header className="bg-bg-secondary border-b border-border-color px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-yellow to-accent-yellow/70 flex items-center justify-center"
            animate={{
              boxShadow: ['0 0 10px rgba(210, 153, 34, 0.3)', '0 0 20px rgba(210, 153, 34, 0.5)', '0 0 10px rgba(210, 153, 34, 0.3)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg viewBox="0 0 32 32" className="w-6 h-6" fill="white">
              <path d="M22.5 14.5c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.7-1.7-.4-.7 2.7c-.4-.1-.7-.2-1-.2v-.1l-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .2.1h-.2l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.7c.5.1 1 .2 1.4.3l-.7 2.7 1.7.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.4c-.5 2.1-4.1 1-5.2.7l.9-3.7c1.2.3 4.9.9 4.3 3zm.5-5.4c-.5 1.9-3.4.9-4.4.7l.8-3.4c1 .3 4.1.7 3.6 2.7z"/>
            </svg>
          </motion.div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">BTC FUTURES SCALPER</h1>
            <p className="text-xs text-text-secondary">Professional Trading Dashboard</p>
          </div>
        </div>

        {/* Center - Connection Status */}
        <div className="flex items-center gap-4">
          <motion.button
            onClick={onReconnect}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              connectionStatus === 'connected'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : connectionStatus === 'connecting'
                ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
                : 'bg-accent-red/20 text-accent-red border border-accent-red/30'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {connectionStatus === 'connected' ? (
              <>
                <motion.div
                  className="w-2 h-2 rounded-full bg-accent-green"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <Wifi size={14} />
                <span>LIVE</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <motion.div
                  className="w-2 h-2 rounded-full bg-accent-yellow"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                <span>CONNECTING...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-accent-red" />
                <WifiOff size={14} />
                <span>DISCONNECTED</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Right - Clock & Controls */}
        <div className="flex items-center gap-4">
          {/* UTC Clock */}
          <div className="text-right">
            <div className="text-sm font-mono text-text-primary">{formatUTCTime(time)} UTC</div>
            <div className="text-xs text-text-secondary">{formatUTCDate(time)}</div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-border-color" />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-tertiary text-text-secondary'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}
            >
              {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </motion.button>

            <motion.button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
