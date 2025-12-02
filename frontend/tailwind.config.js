/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KuCoin-style dark theme
        'kc-bg': '#0b0e11',
        'kc-bg-light': '#1e2329',
        'kc-bg-lighter': '#2b3139',
        'kc-border': '#2b3139',
        'kc-border-light': '#3c4451',
        'kc-text': '#eaecef',
        'kc-text-secondary': '#848e9c',
        'kc-text-muted': '#5e6673',
        'kc-green': '#00c787',
        'kc-green-light': '#00e0a0',
        'kc-red': '#ea383b',
        'kc-red-light': '#ff4d4f',
        'kc-yellow': '#f6be00',
        'kc-cyan': '#00e0e0',
        'kc-blue': '#1890ff',
        'kc-purple': '#7c3aed',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'mono': ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-up': 'flashUp 0.4s ease-out',
        'flash-down': 'flashDown 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        flashUp: {
          '0%': { backgroundColor: 'rgba(0, 199, 135, 0.3)' },
          '100%': { backgroundColor: 'transparent' }
        },
        flashDown: {
          '0%': { backgroundColor: 'rgba(234, 56, 59, 0.3)' },
          '100%': { backgroundColor: 'transparent' }
        },
        glow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 5px currentColor' },
          '50%': { opacity: '0.7', boxShadow: '0 0 20px currentColor' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 199, 135, 0.4)',
        'glow-red': '0 0 20px rgba(234, 56, 59, 0.4)',
        'glow-cyan': '0 0 20px rgba(0, 224, 224, 0.4)',
      }
    },
  },
  plugins: [],
}
