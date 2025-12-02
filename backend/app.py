"""
BTC Futures Scalper - Flask Backend with WebSocket
Professional Trading Dashboard API
"""

import sys
import os
import logging
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import sqlite3
import threading
import time
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from btc_futures_trader import BTCFuturesTrader, DeribitData, Direction, Strategy

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'btc-futures-secret-key-2024'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Global trader instance
trader = None
streaming_thread = None
is_streaming = False

def get_db_connection():
    """Get database connection."""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'flask_standalone.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_trader():
    """Initialize trader instance."""
    global trader
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'flask_standalone.db')
    trader = BTCFuturesTrader(db_path=db_path)
    logger.info("Trader initialized successfully")

# ═══════════════════════════════════════════════════════════════════════════════
# REST API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get complete trader status."""
    try:
        if trader is None:
            return jsonify({"error": "Trader not initialized"}), 500
        status = trader.get_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/positions', methods=['GET'])
def get_positions():
    """Get all open positions."""
    try:
        if trader is None:
            return jsonify({"error": "Trader not initialized"}), 500

        data = trader.data_history[-1] if trader.data_history else None
        if data:
            positions = trader._get_positions_info(data)
        else:
            positions = []
        return jsonify({"positions": positions})
    except Exception as e:
        logger.error(f"Positions error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/trades', methods=['GET'])
def get_trades():
    """Get trade history."""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        strategy = request.args.get('strategy', None)
        result_filter = request.args.get('result', None)

        conn = get_db_connection()
        c = conn.cursor()

        query = "SELECT * FROM futures_scalp_trades WHERE result IS NOT NULL"
        params = []

        if strategy:
            query += " AND strategy = ?"
            params.append(strategy)
        if result_filter:
            query += " AND result = ?"
            params.append(result_filter)

        query += " ORDER BY exit_time DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        c.execute(query, params)
        trades = [dict(row) for row in c.fetchall()]

        # Get total count
        count_query = "SELECT COUNT(*) FROM futures_scalp_trades WHERE result IS NOT NULL"
        c.execute(count_query)
        total = c.fetchone()[0]

        conn.close()

        return jsonify({
            "trades": trades,
            "total": total,
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        logger.error(f"Trades error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get performance metrics and ML stats."""
    try:
        conn = get_db_connection()
        c = conn.cursor()

        # Overall stats
        c.execute("""
            SELECT
                COUNT(*) as total_trades,
                SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END) as losses,
                SUM(pnl_usd) as total_pnl,
                AVG(CASE WHEN result='WIN' THEN pnl_usd END) as avg_win,
                AVG(CASE WHEN result='LOSS' THEN pnl_usd END) as avg_loss,
                MAX(pnl_usd) as best_trade,
                MIN(pnl_usd) as worst_trade
            FROM futures_scalp_trades
            WHERE result IS NOT NULL
        """)
        overall = dict(c.fetchone())

        # Today stats
        today = datetime.now().strftime("%Y-%m-%d")
        c.execute("""
            SELECT
                COUNT(*) as trades,
                SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) as wins,
                SUM(pnl_usd) as pnl,
                MAX(pnl_usd) as best,
                MIN(pnl_usd) as worst
            FROM futures_scalp_trades
            WHERE DATE(exit_time) = ? AND result IS NOT NULL
        """, (today,))
        today_stats = dict(c.fetchone())

        # ML status
        c.execute("SELECT * FROM futures_ml_status WHERE id = 1")
        ml_status = dict(c.fetchone()) if c.fetchone() else {}
        c.execute("SELECT * FROM futures_ml_status WHERE id = 1")
        ml_row = c.fetchone()
        ml_status = dict(ml_row) if ml_row else {}

        # Strategy breakdown
        c.execute("""
            SELECT
                strategy,
                COUNT(*) as trades,
                SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) as wins,
                SUM(pnl_usd) as pnl
            FROM futures_scalp_trades
            WHERE result IS NOT NULL
            GROUP BY strategy
        """)
        strategies = [dict(row) for row in c.fetchall()]

        # Equity curve data (last 30 days)
        c.execute("""
            SELECT date, total_pnl_usd, trades_count, wins, losses
            FROM futures_daily_pnl
            ORDER BY date DESC
            LIMIT 30
        """)
        equity_data = [dict(row) for row in c.fetchall()]

        conn.close()

        # Calculate expected value
        wins = overall.get('wins') or 0
        losses = overall.get('losses') or 0
        total = wins + losses

        if total > 0:
            win_rate = wins / total
            avg_win = overall.get('avg_win') or 0
            avg_loss = abs(overall.get('avg_loss') or 0)
            expected_value = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)
        else:
            win_rate = 0
            avg_win = 0
            avg_loss = 0
            expected_value = 0

        return jsonify({
            "overall": {
                "total_trades": overall.get('total_trades') or 0,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate * 100, 1),
                "total_pnl": round(overall.get('total_pnl') or 0, 2),
                "avg_win": round(avg_win, 2),
                "avg_loss": round(avg_loss, 2),
                "expected_value": round(expected_value, 2),
                "best_trade": round(overall.get('best_trade') or 0, 2),
                "worst_trade": round(overall.get('worst_trade') or 0, 2)
            },
            "today": {
                "trades": today_stats.get('trades') or 0,
                "wins": today_stats.get('wins') or 0,
                "pnl": round(today_stats.get('pnl') or 0, 2),
                "best": round(today_stats.get('best') or 0, 2),
                "worst": round(today_stats.get('worst') or 0, 2)
            },
            "ml": {
                "xgb_active": bool(ml_status.get('xgb_active')),
                "pytorch_active": bool(ml_status.get('pytorch_active')),
                "xgb_accuracy": round((ml_status.get('xgb_accuracy') or 0) * 100, 1),
                "pytorch_accuracy": round((ml_status.get('pytorch_accuracy') or 0) * 100, 1),
                "ensemble_accuracy": round((ml_status.get('ensemble_accuracy') or 0) * 100, 1),
                "last_training": ml_status.get('last_training'),
                "total_trades": ml_status.get('total_trades') or 0
            },
            "strategies": strategies,
            "equity_curve": list(reversed(equity_data))
        })
    except Exception as e:
        logger.error(f"Metrics error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/orderbook', methods=['GET'])
def get_orderbook():
    """Get current orderbook data."""
    try:
        if trader is None or not trader.data_history:
            return jsonify({"bids": [], "asks": [], "imbalance": 0})

        # Fetch fresh orderbook
        import requests
        resp = requests.get(
            f"{trader.DERIBIT_URL}/get_order_book",
            params={"instrument_name": "BTC-PERPETUAL", "depth": 20},
            timeout=5
        )

        if resp.status_code == 200:
            book = resp.json().get("result", {})
            bids = book.get("bids", [])
            asks = book.get("asks", [])

            bid_depth = sum(b[1] for b in bids) if bids else 0
            ask_depth = sum(a[1] for a in asks) if asks else 0
            total = bid_depth + ask_depth
            imbalance = (bid_depth - ask_depth) / total if total > 0 else 0

            return jsonify({
                "bids": bids[:10],
                "asks": asks[:10],
                "bid_depth": bid_depth,
                "ask_depth": ask_depth,
                "imbalance": round(imbalance, 4),
                "spread": asks[0][0] - bids[0][0] if bids and asks else 0
            })

        return jsonify({"bids": [], "asks": [], "imbalance": 0})
    except Exception as e:
        logger.error(f"Orderbook error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/signals', methods=['GET'])
def get_signals():
    """Get current ML signals."""
    try:
        if trader is None or not trader.data_history:
            return jsonify({"signals": []})

        data = trader.data_history[-1]
        signals = trader._analyze_strategies(data)

        formatted_signals = []
        for strategy, direction, score, reason in signals:
            formatted_signals.append({
                "strategy": strategy.value,
                "direction": direction.value if direction else None,
                "confidence": round(min(score / 2, 1) * 100, 1),
                "reason": reason
            })

        # Get ML prediction separately
        ml_dir, ml_conf, ml_reason = trader._get_ml_prediction(data)

        return jsonify({
            "signals": formatted_signals,
            "ml_prediction": {
                "direction": ml_dir.value if ml_dir else None,
                "confidence": round(ml_conf * 100, 1),
                "reason": ml_reason
            },
            "book_imbalance": round(data.book_imbalance, 4),
            "trade_imbalance": round(data.trade_imbalance, 4),
            "momentum_5m": round(data.momentum_5m, 4),
            "funding_rate": data.funding_rate
        })
    except Exception as e:
        logger.error(f"Signals error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/price-history', methods=['GET'])
def get_price_history():
    """Get price history for charts."""
    try:
        if trader is None:
            return jsonify({"prices": []})

        prices = list(trader.price_history)
        return jsonify({
            "prices": prices,
            "count": len(prices)
        })
    except Exception as e:
        logger.error(f"Price history error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/retrain', methods=['POST'])
def retrain_models():
    """Trigger ML model retraining."""
    try:
        if trader is None:
            return jsonify({"error": "Trader not initialized"}), 500

        threading.Thread(target=trader.train_models, daemon=True).start()
        return jsonify({"status": "Training started"})
    except Exception as e:
        logger.error(f"Retrain error: {e}")
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET EVENTS
# ═══════════════════════════════════════════════════════════════════════════════

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    logger.info(f"Client connected")
    emit('connected', {'status': 'connected', 'timestamp': datetime.now().isoformat()})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info(f"Client disconnected")

@socketio.on('subscribe')
def handle_subscribe(data):
    """Handle subscription to updates."""
    logger.info(f"Client subscribed: {data}")
    emit('subscribed', {'status': 'subscribed'})

def stream_updates():
    """Background thread for streaming updates."""
    global is_streaming

    while is_streaming:
        try:
            if trader is not None:
                # Update trader (fetch new data, check positions, etc.)
                update_result = trader.update()

                # Get current data
                data = trader.data_history[-1] if trader.data_history else None

                if data:
                    # Emit price update
                    socketio.emit('price_update', {
                        'timestamp': datetime.now().isoformat(),
                        'last_price': data.last_price,
                        'mark_price': data.mark_price,
                        'index_price': data.index_price,
                        'bid': data.bid,
                        'ask': data.ask,
                        'spread': data.spread,
                        'funding_rate': data.funding_rate,
                        'funding_8h': data.funding_8h,
                        'basis': data.basis,
                        'basis_pct': data.basis_pct,
                        'volume_24h': data.volume_24h,
                        'volume_usd': data.volume_usd,
                        'open_interest': data.open_interest,
                        'price_change_pct': data.price_change_pct,
                        'high_24h': data.high_24h,
                        'low_24h': data.low_24h
                    })

                    # Emit orderbook update
                    socketio.emit('orderbook_update', {
                        'bid_depth': data.bid_depth,
                        'ask_depth': data.ask_depth,
                        'book_imbalance': data.book_imbalance,
                        'trade_imbalance': data.trade_imbalance,
                        'large_buys': data.large_buys,
                        'large_sells': data.large_sells
                    })

                    # Emit positions update
                    positions = trader._get_positions_info(data)
                    socketio.emit('positions_update', {
                        'positions': positions,
                        'count': len(positions)
                    })

                    # Emit signals update
                    signals = trader._analyze_strategies(data)
                    ml_dir, ml_conf, ml_reason = trader._get_ml_prediction(data)

                    socketio.emit('signals_update', {
                        'signals': [{
                            'strategy': s[0].value,
                            'direction': s[1].value if s[1] else None,
                            'confidence': round(min(s[2] / 2, 1) * 100, 1),
                            'reason': s[3]
                        } for s in signals],
                        'ml_prediction': {
                            'direction': ml_dir.value if ml_dir else None,
                            'confidence': round(ml_conf * 100, 1),
                            'reason': ml_reason
                        }
                    })

                    # Emit P&L update
                    socketio.emit('pnl_update', {
                        'session_pnl': trader.session_pnl_usd,
                        'total_pnl': trader.total_pnl_usd,
                        'trades_today': trader.trades_today,
                        'wins_today': trader.wins_today,
                        'losses_today': trader.losses_today,
                        'winrate': round(trader.wins_today / trader.trades_today * 100, 1) if trader.trades_today > 0 else 0
                    })

                    # Emit trade events if any
                    if update_result.get('opened'):
                        for opened in update_result['opened']:
                            socketio.emit('trade_opened', opened)

                    if update_result.get('closed'):
                        for closed in update_result['closed']:
                            socketio.emit('trade_closed', closed)

            time.sleep(1.5)  # Update every 1.5 seconds

        except Exception as e:
            logger.error(f"Stream error: {e}")
            time.sleep(5)

def start_streaming():
    """Start the streaming thread."""
    global streaming_thread, is_streaming

    if streaming_thread is None or not streaming_thread.is_alive():
        is_streaming = True
        streaming_thread = threading.Thread(target=stream_updates, daemon=True)
        streaming_thread.start()
        logger.info("Streaming started")

def stop_streaming():
    """Stop the streaming thread."""
    global is_streaming
    is_streaming = False
    logger.info("Streaming stopped")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    # Initialize trader
    init_trader()

    # Start streaming
    start_streaming()

    # Run Flask app
    logger.info("Starting BTC Futures Dashboard API on http://0.0.0.0:6998")
    socketio.run(app, host='0.0.0.0', port=6998, debug=False)
