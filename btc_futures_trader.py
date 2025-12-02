"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║              BTC FUTURES SCALPER - AGGRESSIVE EDITION                         ║
║                   XGBoost + PyTorch Ensemble • Hedge Mode                     ║
║                      Scalping $100-200 • Multi-Strategy                       ║
╚═══════════════════════════════════════════════════════════════════════════════╝

STRATEGIE:
1. MOMENTUM SCALP - Segue direzione forte
2. MEAN REVERSION - Fade movimenti estremi  
3. FUNDING ARBITRAGE - Sfrutta funding rate estremi
4. LIQUIDATION HUNT - Anticipa squeeze
5. HEDGE MODE - Long + Short simultanei, chiude il perdente

ML ENSEMBLE:
- XGBoost: Pattern recognition su features
- PyTorch: Neural net per sequenze temporali
- Voting: 60% XGBoost + 40% PyTorch
"""

import sqlite3
import logging
import numpy as np
import requests
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, NamedTuple
from enum import Enum
from collections import deque
import json
import threading

# ML Libraries
try:
    from xgboost import XGBClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    import joblib
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

class Strategy(Enum):
    MOMENTUM = "MOMENTUM"
    MEAN_REVERSION = "MEAN_REVERSION"
    FUNDING_ARB = "FUNDING_ARB"
    LIQUIDATION_HUNT = "LIQUIDATION_HUNT"
    HEDGE = "HEDGE"
    ML_SIGNAL = "ML_SIGNAL"


class Direction(Enum):
    LONG = "LONG"
    SHORT = "SHORT"


@dataclass
class DeribitData:
    """Dati completi da Deribit."""
    timestamp: datetime = field(default_factory=datetime.now)
    
    # Prices
    last_price: float = 0.0
    mark_price: float = 0.0
    index_price: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    spread: float = 0.0
    mid_price: float = 0.0
    
    # Funding
    funding_rate: float = 0.0
    funding_8h: float = 0.0
    
    # Volume & OI
    open_interest: float = 0.0
    oi_change_1h: float = 0.0
    volume_24h: float = 0.0
    volume_usd: float = 0.0
    
    # Stats
    high_24h: float = 0.0
    low_24h: float = 0.0
    price_change_pct: float = 0.0
    
    # Basis
    basis: float = 0.0
    basis_pct: float = 0.0
    
    # Order Book
    bid_depth: float = 0.0
    ask_depth: float = 0.0
    book_imbalance: float = 0.0
    
    # Trade Flow
    buy_volume: float = 0.0
    sell_volume: float = 0.0
    trade_imbalance: float = 0.0
    large_buys: int = 0
    large_sells: int = 0
    
    # Derived
    volatility_1h: float = 0.0
    momentum_5m: float = 0.0
    momentum_15m: float = 0.0


@dataclass
class ScalpPosition:
    """Posizione scalping."""
    id: str
    direction: Direction
    strategy: Strategy
    entry_price: float
    entry_time: datetime
    size_usd: float
    stop_loss: float
    take_profit: float
    trailing_stop: Optional[float] = None
    max_price_seen: float = 0.0
    min_price_seen: float = float('inf')
    hedge_pair_id: Optional[str] = None  # ID della posizione hedge
    
    def pnl_usd(self, current_price: float) -> float:
        """Calcola P&L in USD."""
        if self.direction == Direction.LONG:
            pnl_pct = (current_price - self.entry_price) / self.entry_price
        else:
            pnl_pct = (self.entry_price - current_price) / self.entry_price
        return self.size_usd * pnl_pct
    
    def pnl_pct(self, current_price: float) -> float:
        """Calcola P&L in %."""
        if self.direction == Direction.LONG:
            return ((current_price - self.entry_price) / self.entry_price) * 100
        else:
            return ((self.entry_price - current_price) / self.entry_price) * 100


# ═══════════════════════════════════════════════════════════════════════════════
# PYTORCH MODEL
# ═══════════════════════════════════════════════════════════════════════════════

if TORCH_AVAILABLE:
    class ScalpNet(nn.Module):
        """Neural Network per scalping predictions."""
        
        def __init__(self, input_size: int = 15, hidden_sizes: List[int] = [64, 32, 16]):
            super().__init__()
            
            layers = []
            prev_size = input_size
            
            for hidden_size in hidden_sizes:
                layers.extend([
                    nn.Linear(prev_size, hidden_size),
                    nn.BatchNorm1d(hidden_size),
                    nn.ReLU(),
                    nn.Dropout(0.2)
                ])
                prev_size = hidden_size
            
            layers.append(nn.Linear(prev_size, 3))  # 3 classi: LONG, SHORT, NEUTRAL
            
            self.network = nn.Sequential(*layers)
        
        def forward(self, x):
            return self.network(x)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN TRADER CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class BTCFuturesTrader:
    """
    BTC Futures Scalper con ML Ensemble.
    """
    
    # API
    DERIBIT_URL = "https://www.deribit.com/api/v2/public"
    
    # Position Sizing
    DEFAULT_SIZE_USD = 10000.0  # $150 per trade
    MAX_POSITIONS = 6         # Max posizioni simultanee
    MAX_HEDGE_PAIRS = 2       # Max hedge pairs
    
    # Scalping Targets (aggressive)
    SCALP_TP_PCT = 0.4       # 0.15% take profit ($0.225 su $150)
    SCALP_SL_PCT = 0.6       # 0.10% stop loss ($0.15 su $150)
    TRAILING_ACTIVATION = 0.10  # Attiva trailing a +0.10%
    TRAILING_DISTANCE = 0.05    # Trailing stop 0.05%
    
    # Strategy Thresholds
    MOMENTUM_THRESHOLD = 0.05     # 0.08% movimento per momentum
    MEAN_REV_THRESHOLD = 0.20     # 0.20% per mean reversion
    FUNDING_EXTREME = 0.0005      # 0.05% funding = estremo
    OI_SPIKE_THRESHOLD = 0.03     # 3% cambio OI
    IMBALANCE_THRESHOLD = 0.15    # 25% book imbalance
    
    # ML
    MIN_TRADES_FOR_ML = 20
    XGBOOST_WEIGHT = 0.6
    PYTORCH_WEIGHT = 0.4
    ML_CONFIDENCE_THRESHOLD = 0.55
    
    # Timing
    POSITION_TIMEOUT_MINUTES = 30  # Max 30 min per posizione
    
    def __init__(self, db_path: str = "flask_standalone.db"):
        self.db_path = db_path
        
        # HTTP Session (persistent connection)
        self.session = requests.Session()
        
        # History
        self.price_history: deque = deque(maxlen=200)  # ~3 ore di dati
        self.data_history: List[DeribitData] = []
        self.max_history = 200
        
        # Positions
        self.positions: Dict[str, ScalpPosition] = {}
        self.position_counter = 0
        
        # P&L Tracking
        self.total_pnl_usd = 0.0
        self.session_pnl_usd = 0.0
        self.trades_today = 0
        self.wins_today = 0
        self.losses_today = 0
        
        # ML Models
        self.xgb_model = None
        self.xgb_scaler = None
        self.pytorch_model = None
        self.pytorch_scaler = None
        self.is_ml_active = False
        
        # Lock per thread safety
        self.lock = threading.Lock()
        
        # Init
        self._init_db()
        self._load_state()
        self._load_models()
        
        logger.info(f"🚀 BTC Futures Scalper inizializzato | ML: {self.is_ml_active} | P&L: ${self.total_pnl_usd:+.2f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DATABASE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _init_db(self):
        """Inizializza database."""
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            
            # Snapshots
            c.execute("""
                CREATE TABLE IF NOT EXISTS futures_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    last_price REAL,
                    mark_price REAL,
                    index_price REAL,
                    funding_rate REAL,
                    open_interest REAL,
                    oi_change_1h REAL,
                    volume_usd REAL,
                    book_imbalance REAL,
                    trade_imbalance REAL,
                    momentum_5m REAL,
                    momentum_15m REAL,
                    volatility_1h REAL
                )
            """)
            
            # Trades
            c.execute("""
                CREATE TABLE IF NOT EXISTS futures_scalp_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    position_id TEXT UNIQUE,
                    direction TEXT,
                    strategy TEXT,
                    entry_time TEXT,
                    exit_time TEXT,
                    entry_price REAL,
                    exit_price REAL,
                    size_usd REAL,
                    pnl_usd REAL,
                    pnl_pct REAL,
                    result TEXT,
                    exit_reason TEXT,
                    was_hedge INTEGER DEFAULT 0,
                    
                    -- Features at entry
                    funding_rate REAL,
                    book_imbalance REAL,
                    trade_imbalance REAL,
                    momentum_5m REAL,
                    oi_change REAL,
                    ml_confidence REAL,
                    ml_prediction TEXT
                )
            """)
            
            # Daily P&L
            c.execute("""
                CREATE TABLE IF NOT EXISTS futures_daily_pnl (
                    date TEXT PRIMARY KEY,
                    total_pnl_usd REAL DEFAULT 0.0,
                    trades_count INTEGER DEFAULT 0,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    best_trade_usd REAL DEFAULT 0.0,
                    worst_trade_usd REAL DEFAULT 0.0
                )
            """)
            
            # ML Status
            c.execute("""
                CREATE TABLE IF NOT EXISTS futures_ml_status (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    total_trades INTEGER DEFAULT 0,
                    xgb_active INTEGER DEFAULT 0,
                    pytorch_active INTEGER DEFAULT 0,
                    xgb_accuracy REAL DEFAULT 0.0,
                    pytorch_accuracy REAL DEFAULT 0.0,
                    ensemble_accuracy REAL DEFAULT 0.0,
                    last_training TEXT,
                    total_pnl_usd REAL DEFAULT 0.0
                )
            """)
            
            c.execute("INSERT OR IGNORE INTO futures_ml_status (id) VALUES (1)")
            
            conn.commit()
    
    def _load_state(self):
        """Carica stato da DB."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                
                # Total P&L
                c.execute("SELECT total_pnl_usd FROM futures_ml_status WHERE id=1")
                row = c.fetchone()
                if row:
                    self.total_pnl_usd = row["total_pnl_usd"] or 0.0
                
                
                # Total P&L (storico)
                c.execute("SELECT total_pnl_usd FROM futures_ml_status WHERE id=1")
                row = c.fetchone()
                if row:
                    self.total_pnl_usd = row["total_pnl_usd"] or 0.0
                
                # Todays stats (se esistono)
                today = datetime.now().strftime("%Y-%m-%d")
                c.execute("SELECT * FROM futures_daily_pnl WHERE date=?", (today,))
                row = c.fetchone()
                if row:
                    self.session_pnl_usd = row["total_pnl_usd"] or 0.0
                    self.trades_today = row["trades_count"] or 0
                    self.wins_today = row["wins"] or 0
                    self.losses_today = row["losses"] or 0
                else:
                    # Se oggi non ci sono trade, carica totali storici
                    c.execute("SELECT SUM(trades_count), SUM(wins), SUM(losses), SUM(total_pnl_usd) FROM futures_daily_pnl")
                    row = c.fetchone()
                    if row and row[0]:
                        self.trades_today = row[0] or 0
                        self.wins_today = row[1] or 0
                        self.losses_today = row[2] or 0
                        self.session_pnl_usd = row[3] or 0.0
                    
        except Exception as e:
            logger.warning(f"Load state error: {e}")
    
    def _load_models(self):
        """Carica modelli ML."""
        models_loaded = 0
        
        # XGBoost
        if XGBOOST_AVAILABLE:
            try:
                self.xgb_model = joblib.load("futures_xgb_model.joblib")
                self.xgb_scaler = joblib.load("futures_xgb_scaler.joblib")
                models_loaded += 1
                logger.info("✅ XGBoost model loaded")
            except:
                pass
        
        # PyTorch
        if TORCH_AVAILABLE:
            try:
                self.pytorch_model = ScalpNet()
                self.pytorch_model.load_state_dict(torch.load("futures_pytorch_model.pt"))
                self.pytorch_model.eval()
                self.pytorch_scaler = joblib.load("futures_pytorch_scaler.joblib")
                models_loaded += 1
                logger.info("✅ PyTorch model loaded")
            except:
                pass
        
        self.is_ml_active = models_loaded > 0
    
    # ═══════════════════════════════════════════════════════════════════════════
    # DATA FETCHING
    # ═══════════════════════════════════════════════════════════════════════════
    
    def fetch_deribit_data(self) -> Optional[DeribitData]:
        """Fetch completo da Deribit."""
        data = DeribitData()
        
        try:
            # 1. Book Summary
            resp = self.session.get(
                f"{self.DERIBIT_URL}/get_book_summary_by_instrument",
                params={"instrument_name": "BTC-PERPETUAL"},
                timeout=5
            )
            if resp.status_code == 200:
                r = resp.json().get("result", [{}])[0]
                
                data.last_price = float(r.get("last", 0))
                data.mark_price = float(r.get("mark_price", 0))
                data.index_price = float(r.get("estimated_delivery_price", data.mark_price))
                data.bid = float(r.get("bid_price", 0))
                data.ask = float(r.get("ask_price", 0))
                data.spread = data.ask - data.bid
                data.mid_price = (data.bid + data.ask) / 2
                
                data.funding_rate = float(r.get("current_funding", 0)) or float(r.get("funding_8h", 0))
                data.funding_8h = float(r.get("funding_8h", 0))
                
                data.open_interest = float(r.get("open_interest", 0))
                data.volume_24h = float(r.get("volume", 0))
                data.volume_usd = float(r.get("volume_usd", 0))
                
                data.high_24h = float(r.get("high", 0))
                data.low_24h = float(r.get("low", 0))
                data.price_change_pct = float(r.get("price_change", 0))
                
                data.basis = data.last_price - data.index_price
                data.basis_pct = (data.basis / data.index_price * 100) if data.index_price > 0 else 0
            
            # 2. Order Book
            resp = self.session.get(
                f"{self.DERIBIT_URL}/get_order_book",
                params={"instrument_name": "BTC-PERPETUAL", "depth": 20},
                timeout=5
            )
            if resp.status_code == 200:
                book = resp.json().get("result", {})
                bids = book.get("bids", [])
                asks = book.get("asks", [])
                
                data.bid_depth = sum(b[1] for b in bids) if bids else 0
                data.ask_depth = sum(a[1] for a in asks) if asks else 0
                
                total = data.bid_depth + data.ask_depth
                if total > 0:
                    data.book_imbalance = (data.bid_depth - data.ask_depth) / total
            
            # 3. Recent Trades
            resp = self.session.get(
                f"{self.DERIBIT_URL}/get_last_trades_by_instrument",
                params={"instrument_name": "BTC-PERPETUAL", "count": 100},
                timeout=5
            )
            if resp.status_code == 200:
                trades = resp.json().get("result", {}).get("trades", [])
                
                data.buy_volume = sum(t["amount"] for t in trades if t["direction"] == "buy")
                data.sell_volume = sum(t["amount"] for t in trades if t["direction"] == "sell")
                
                total = data.buy_volume + data.sell_volume
                if total > 0:
                    data.trade_imbalance = (data.buy_volume - data.sell_volume) / total
                
                # Large trades (whales > $50k)
                data.large_buys = sum(1 for t in trades 
                    if t["direction"] == "buy" and t["amount"] * data.last_price > 50000)
                data.large_sells = sum(1 for t in trades 
                    if t["direction"] == "sell" and t["amount"] * data.last_price > 50000)
            
            # 4. Calcola momentum e volatilità
            if len(self.price_history) >= 5:
                prices = list(self.price_history)
                data.momentum_5m = ((data.last_price - prices[-5]) / prices[-5] * 100) if prices[-5] > 0 else 0
                
                if len(prices) >= 15:
                    data.momentum_15m = ((data.last_price - prices[-15]) / prices[-15] * 100) if prices[-15] > 0 else 0
                
                if len(prices) >= 60:
                    returns = np.diff(prices[-60:]) / prices[-60:-1]
                    data.volatility_1h = np.std(returns) * 100 * np.sqrt(60)
            
            # 5. OI Change 1h
            if len(self.data_history) >= 40:  # ~1 ora fa
                old_oi = self.data_history[-40].open_interest
                if old_oi > 0:
                    data.oi_change_1h = (data.open_interest - old_oi) / old_oi
            
            data.timestamp = datetime.now()
            return data
            
        except Exception as e:
            logger.error(f"❌ Fetch error: {e}")
            return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ML PREDICTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _extract_features(self, data: DeribitData) -> np.ndarray:
        """Estrae features per ML (allineate al training - 6 features)."""
        return np.array([
            data.funding_rate * 10000,
            data.book_imbalance,
            data.trade_imbalance,
            data.momentum_5m,
            data.oi_change_1h * 100,
            1 if data.book_imbalance > 0 else -1  # direzione book
        ])
    
    def _get_ml_prediction(self, data: DeribitData) -> Tuple[Optional[Direction], float, str]:
        """
        Ottiene predizione ensemble ML.
        Returns: (direction, confidence, reason)
        """
        if not self.is_ml_active:
            return None, 0.0, "ML not active"
        
        features = self._extract_features(data)
        
        xgb_pred = None
        xgb_conf = 0.0
        pytorch_pred = None
        pytorch_conf = 0.0
        
        # XGBoost prediction
        if self.xgb_model is not None and self.xgb_scaler is not None:
            try:
                X = self.xgb_scaler.transform([features])
                pred = self.xgb_model.predict(X)[0]
                proba = self.xgb_model.predict_proba(X)[0]
                xgb_conf = max(proba)
                
                if pred == 1:
                    xgb_pred = Direction.LONG
                elif pred == 2:
                    xgb_pred = Direction.SHORT
            except Exception as e:
                logger.warning(f"XGB predict error: {e}")
        
        # PyTorch prediction
        if TORCH_AVAILABLE and self.pytorch_model is not None and self.pytorch_scaler is not None:
            try:
                X = self.pytorch_scaler.transform([features])
                X_tensor = torch.FloatTensor(X)
                
                with torch.no_grad():
                    output = self.pytorch_model(X_tensor)
                    proba = torch.softmax(output, dim=1)[0]
                    pred = torch.argmax(proba).item()
                    pytorch_conf = proba[pred].item()
                
                if pred == 1:
                    pytorch_pred = Direction.LONG
                elif pred == 2:
                    pytorch_pred = Direction.SHORT
            except Exception as e:
                logger.warning(f"PyTorch predict error: {e}")
        
        # Ensemble voting
        if xgb_pred is not None and pytorch_pred is not None:
            # Weighted confidence
            ensemble_conf = xgb_conf * self.XGBOOST_WEIGHT + pytorch_conf * self.PYTORCH_WEIGHT
            
            # Agreement bonus
            if xgb_pred == pytorch_pred:
                ensemble_conf = min(1.0, ensemble_conf * 1.2)
                final_pred = xgb_pred
                reason = f"ENSEMBLE AGREE: XGB={xgb_conf:.2f}, PT={pytorch_conf:.2f}"
            else:
                # Use higher confidence
                if xgb_conf * self.XGBOOST_WEIGHT > pytorch_conf * self.PYTORCH_WEIGHT:
                    final_pred = xgb_pred
                    reason = f"XGB OVERRIDE: {xgb_conf:.2f} > PT {pytorch_conf:.2f}"
                else:
                    final_pred = pytorch_pred
                    reason = f"PT OVERRIDE: {pytorch_conf:.2f} > XGB {xgb_conf:.2f}"
            
            return final_pred, ensemble_conf, reason
        
        elif xgb_pred is not None:
            return xgb_pred, xgb_conf, f"XGB ONLY: {xgb_conf:.2f}"
        
        elif pytorch_pred is not None:
            return pytorch_pred, pytorch_conf, f"PT ONLY: {pytorch_conf:.2f}"
        
        return None, 0.0, "No prediction"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STRATEGY ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _analyze_strategies(self, data: DeribitData) -> List[Tuple[Strategy, Direction, float, str]]:
        """
        Analizza tutte le strategie e ritorna segnali.
        Returns: List of (strategy, direction, score, reason)
        """
        signals = []
        
        # 1. MOMENTUM SCALP
        if abs(data.momentum_5m) > self.MOMENTUM_THRESHOLD:
            direction = Direction.LONG if data.momentum_5m > 0 else Direction.SHORT
            score = min(abs(data.momentum_5m) / self.MOMENTUM_THRESHOLD, 2.0)
            
            # Conferma con trade flow
            if (direction == Direction.LONG and data.trade_imbalance > 0.1) or \
               (direction == Direction.SHORT and data.trade_imbalance < -0.1):
                score *= 1.3
            
            signals.append((Strategy.MOMENTUM, direction, score, 
                f"Momentum {data.momentum_5m:+.3f}%, flow={data.trade_imbalance:+.2f}"))
        
        # 2. MEAN REVERSION
        if abs(data.momentum_15m) > self.MEAN_REV_THRESHOLD:
            # Fade the move
            direction = Direction.SHORT if data.momentum_15m > 0 else Direction.LONG
            score = min(abs(data.momentum_15m) / self.MEAN_REV_THRESHOLD, 2.0) * 0.8
            
            # Conferma con funding (se troppi long, short è meglio)
            if (direction == Direction.SHORT and data.funding_rate > 0.0002) or \
               (direction == Direction.LONG and data.funding_rate < -0.0001):
                score *= 1.3
            
            signals.append((Strategy.MEAN_REVERSION, direction, score,
                f"Mean Rev: moved {data.momentum_15m:+.3f}%, funding={data.funding_rate*100:.4f}%"))
        
        # 3. FUNDING ARBITRAGE
        if abs(data.funding_rate) > self.FUNDING_EXTREME:
            # Short se funding molto positivo (troppi long pagano), vice versa
            direction = Direction.SHORT if data.funding_rate > 0 else Direction.LONG
            score = min(abs(data.funding_rate) / self.FUNDING_EXTREME, 2.0)
            
            signals.append((Strategy.FUNDING_ARB, direction, score,
                f"Funding extreme: {data.funding_rate*100:.4f}%"))
        
        # 4. LIQUIDATION HUNT
        if abs(data.oi_change_1h) > self.OI_SPIKE_THRESHOLD:
            # OI spike + price move = liquidation cascade possible
            if data.oi_change_1h > 0 and data.momentum_5m < -0.05:
                # OI up ma prezzo giù = long squeezati, continua short
                signals.append((Strategy.LIQUIDATION_HUNT, Direction.SHORT, 1.5,
                    f"Long squeeze: OI+{data.oi_change_1h*100:.1f}%, price-{abs(data.momentum_5m):.2f}%"))
            elif data.oi_change_1h > 0 and data.momentum_5m > 0.05:
                # OI up + prezzo su = short squeezati
                signals.append((Strategy.LIQUIDATION_HUNT, Direction.LONG, 1.5,
                    f"Short squeeze: OI+{data.oi_change_1h*100:.1f}%, price+{data.momentum_5m:.2f}%"))
        
        # 5. BOOK IMBALANCE
        if abs(data.book_imbalance) > self.IMBALANCE_THRESHOLD:
            direction = Direction.LONG if data.book_imbalance > 0 else Direction.SHORT
            score = abs(data.book_imbalance) / self.IMBALANCE_THRESHOLD * 0.7
            
            signals.append((Strategy.MOMENTUM, direction, score,
                f"Book imbalance: {data.book_imbalance:+.2f}"))
        
        # 6. ML SIGNAL
        ml_dir, ml_conf, ml_reason = self._get_ml_prediction(data)
        if ml_dir is not None and ml_conf >= self.ML_CONFIDENCE_THRESHOLD:
            signals.append((Strategy.ML_SIGNAL, ml_dir, ml_conf * 2.0, ml_reason))
        
        return signals
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POSITION MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _generate_position_id(self) -> str:
        """Genera ID univoco per posizione."""
        self.position_counter += 1
        return f"FUT_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self.position_counter}"
    
    def _open_position(self, data: DeribitData, direction: Direction, 
                       strategy: Strategy, reason: str, 
                       hedge_pair_id: Optional[str] = None) -> ScalpPosition:
        """Apre nuova posizione."""
        
        pos_id = self._generate_position_id()
        entry_price = data.last_price
        
        # Calculate SL/TP
        if direction == Direction.LONG:
            sl = entry_price * (1 - self.SCALP_SL_PCT / 100)
            tp = entry_price * (1 + self.SCALP_TP_PCT / 100)
        else:
            sl = entry_price * (1 + self.SCALP_SL_PCT / 100)
            tp = entry_price * (1 - self.SCALP_TP_PCT / 100)
        
        position = ScalpPosition(
            id=pos_id,
            direction=direction,
            strategy=strategy,
            entry_price=entry_price,
            entry_time=datetime.now(),
            size_usd=self.DEFAULT_SIZE_USD,
            stop_loss=sl,
            take_profit=tp,
            max_price_seen=entry_price,
            min_price_seen=entry_price,
            hedge_pair_id=hedge_pair_id
        )
        
        self.positions[pos_id] = position
        
        logger.info(f"🚀 OPEN {direction.value} | {strategy.value} | ${entry_price:,.2f} | SL: ${sl:,.2f} | TP: ${tp:,.2f} | {reason}")
        
        return position
    
    def _close_position(self, pos_id: str, data: DeribitData, reason: str) -> Dict:
        """Chiude posizione e registra risultato."""
        
        if pos_id not in self.positions:
            return {}
        
        pos = self.positions.pop(pos_id)
        exit_price = data.last_price
        pnl_usd = pos.pnl_usd(exit_price)
        pnl_pct = pos.pnl_pct(exit_price)
        result = "WIN" if pnl_usd > 0 else "LOSS"
        
        # Update totals
        self.total_pnl_usd += pnl_usd
        self.session_pnl_usd += pnl_usd
        self.trades_today += 1
        
        if result == "WIN":
            self.wins_today += 1
        else:
            self.losses_today += 1
        
        # Save to DB
        self._save_trade(pos, exit_price, pnl_usd, pnl_pct, result, reason, data)
        
        logger.info(f"📊 CLOSE {pos.direction.value} | {result} | P&L: ${pnl_usd:+.2f} ({pnl_pct:+.2f}%) | {reason} | Total: ${self.session_pnl_usd:+.2f}")
        
        return {
            "position_id": pos.id,
            "direction": pos.direction.value,
            "strategy": pos.strategy.value,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "pnl_usd": round(pnl_usd, 2),
            "pnl_pct": round(pnl_pct, 4),
            "result": result,
            "reason": reason
        }
    
    def _save_trade(self, pos: ScalpPosition, exit_price: float, 
                    pnl_usd: float, pnl_pct: float, result: str, 
                    reason: str, data: DeribitData):
        """Salva trade nel DB."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                c = conn.cursor()
                
                # ML prediction info
                ml_dir, ml_conf, ml_reason = self._get_ml_prediction(data)
                
                c.execute("""
                    INSERT OR REPLACE INTO futures_scalp_trades (
                        position_id, direction, strategy, entry_time, exit_time,
                        entry_price, exit_price, size_usd, pnl_usd, pnl_pct,
                        result, exit_reason, was_hedge,
                        funding_rate, book_imbalance, trade_imbalance,
                        momentum_5m, oi_change, ml_confidence, ml_prediction
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pos.id, pos.direction.value, pos.strategy.value,
                    pos.entry_time.isoformat(), datetime.now().isoformat(),
                    pos.entry_price, exit_price, pos.size_usd,
                    pnl_usd, pnl_pct, result, reason,
                    1 if pos.hedge_pair_id else 0,
                    data.funding_rate, data.book_imbalance, data.trade_imbalance,
                    data.momentum_5m, data.oi_change_1h,
                    ml_conf, ml_dir.value if ml_dir else None
                ))
                
                # Update daily P&L
                today = datetime.now().strftime("%Y-%m-%d")
                c.execute("""
                    INSERT INTO futures_daily_pnl (date, total_pnl_usd, trades_count, wins, losses, best_trade_usd, worst_trade_usd)
                    VALUES (?, ?, 1, ?, ?, ?, ?)
                    ON CONFLICT(date) DO UPDATE SET
                        total_pnl_usd = total_pnl_usd + ?,
                        trades_count = trades_count + 1,
                        wins = wins + ?,
                        losses = losses + ?,
                        best_trade_usd = MAX(best_trade_usd, ?),
                        worst_trade_usd = MIN(worst_trade_usd, ?)
                """, (
                    today, pnl_usd, 1 if result == "WIN" else 0, 1 if result == "LOSS" else 0,
                    pnl_usd if pnl_usd > 0 else 0, pnl_usd if pnl_usd < 0 else 0,
                    pnl_usd, 1 if result == "WIN" else 0, 1 if result == "LOSS" else 0,
                    pnl_usd, pnl_usd
                ))
                
                # Update ML status
                c.execute("""
                    UPDATE futures_ml_status SET
                        total_trades = total_trades + 1,
                        total_pnl_usd = total_pnl_usd + ?
                    WHERE id = 1
                """, (pnl_usd,))
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Save trade error: {e}")
    
    def _check_positions(self, data: DeribitData) -> List[Dict]:
        """Controlla tutte le posizioni aperte."""
        results = []
        positions_to_close = []
        
        for pos_id, pos in self.positions.items():
            current_price = data.last_price
            pnl_pct = pos.pnl_pct(current_price)
            
            # Update max/min seen
            pos.max_price_seen = max(pos.max_price_seen, current_price)
            pos.min_price_seen = min(pos.min_price_seen, current_price)
            
            close_reason = None
            
            # 1. Check SL
            if pos.direction == Direction.LONG and current_price <= pos.stop_loss:
                close_reason = "SL_HIT"
            elif pos.direction == Direction.SHORT and current_price >= pos.stop_loss:
                close_reason = "SL_HIT"
            
            # 2. Check TP
            elif pos.direction == Direction.LONG and current_price >= pos.take_profit:
                close_reason = "TP_HIT"
            elif pos.direction == Direction.SHORT and current_price <= pos.take_profit:
                close_reason = "TP_HIT"
            
            # 3. Trailing stop activation & check
            elif pnl_pct >= self.TRAILING_ACTIVATION:
                if pos.trailing_stop is None:
                    # Activate trailing
                    if pos.direction == Direction.LONG:
                        pos.trailing_stop = current_price * (1 - self.TRAILING_DISTANCE / 100)
                    else:
                        pos.trailing_stop = current_price * (1 + self.TRAILING_DISTANCE / 100)
                    logger.info(f"🎯 Trailing activated for {pos_id} @ ${pos.trailing_stop:,.2f}")
                else:
                    # Update trailing
                    if pos.direction == Direction.LONG:
                        new_trail = current_price * (1 - self.TRAILING_DISTANCE / 100)
                        pos.trailing_stop = max(pos.trailing_stop, new_trail)
                        if current_price <= pos.trailing_stop:
                            close_reason = "TRAILING_HIT"
                    else:
                        new_trail = current_price * (1 + self.TRAILING_DISTANCE / 100)
                        pos.trailing_stop = min(pos.trailing_stop, new_trail)
                        if current_price >= pos.trailing_stop:
                            close_reason = "TRAILING_HIT"
            
            # 4. Timeout
            minutes_open = (datetime.now() - pos.entry_time).total_seconds() / 60
            if minutes_open > self.POSITION_TIMEOUT_MINUTES and close_reason is None:
                close_reason = "TIMEOUT"
            
            # 5. Hedge pair logic - chiudi il perdente
            if pos.hedge_pair_id and pos.hedge_pair_id in self.positions:
                hedge_pos = self.positions[pos.hedge_pair_id]
                hedge_pnl = hedge_pos.pnl_pct(current_price)
                
                # Se uno dei due è in profitto decente, chiudi il perdente
                if pnl_pct > 0.05 and hedge_pnl < -0.03:
                    positions_to_close.append((pos.hedge_pair_id, "HEDGE_LOSER"))
                elif hedge_pnl > 0.05 and pnl_pct < -0.03:
                    close_reason = "HEDGE_LOSER"
            
            if close_reason:
                positions_to_close.append((pos_id, close_reason))
        
        # Close positions
        for pos_id, reason in positions_to_close:
            if pos_id in self.positions:
                result = self._close_position(pos_id, data, reason)
                if result:
                    results.append(result)
        
        return results
    
    def _open_hedge_positions(self, data: DeribitData, reason: str) -> List[ScalpPosition]:
        """Apre coppia hedge (LONG + SHORT)."""
        
        # Open LONG
        long_pos = self._open_position(data, Direction.LONG, Strategy.HEDGE, f"HEDGE LONG: {reason}")
        
        # Open SHORT linked
        short_pos = self._open_position(data, Direction.SHORT, Strategy.HEDGE, 
                                        f"HEDGE SHORT: {reason}", hedge_pair_id=long_pos.id)
        
        # Link them
        long_pos.hedge_pair_id = short_pos.id
        
        return [long_pos, short_pos]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ML TRAINING
    # ═══════════════════════════════════════════════════════════════════════════
    
    def train_models(self):
        """Allena modelli ML."""
        xgb_acc = 0.0
        pt_acc = 0.0
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute("""
                    SELECT * FROM futures_scalp_trades 
                    WHERE result IS NOT NULL
                    ORDER BY exit_time DESC LIMIT 500
                """)
                trades = c.fetchall()
            
            if len(trades) < self.MIN_TRADES_FOR_ML:
                logger.info(f"⏳ Not enough trades for ML: {len(trades)}/{self.MIN_TRADES_FOR_ML}")
                return
            
            # Prepare data
            X = []
            y = []
            
            for t in trades:
                features = [
                    (t["funding_rate"] or 0) * 10000,
                    t["book_imbalance"] or 0,
                    t["trade_imbalance"] or 0,
                    t["momentum_5m"] or 0,
                    (t["oi_change"] or 0) * 100,
                    1 if (t["book_imbalance"] or 0) > 0 else -1
                ]
                X.append(features)
                
                # Label: 0=NEUTRAL, 1=LONG WIN, 2=SHORT WIN
                if t["result"] == "WIN":
                    y.append(1 if t["direction"] == "LONG" else 2)
                else:
                    y.append(0)
            
            X = np.array(X)
            y = np.array(y)
            
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Train XGBoost
            if XGBOOST_AVAILABLE:
                self.xgb_scaler = StandardScaler()
                X_train_scaled = self.xgb_scaler.fit_transform(X_train)
                X_test_scaled = self.xgb_scaler.transform(X_test)
                
                self.xgb_model = XGBClassifier(
                    n_estimators=100,
                    max_depth=5,
                    learning_rate=0.1,
                    random_state=42,
                    n_jobs=1,
                    use_label_encoder=False,
                    eval_metric="mlogloss"
                )
                self.xgb_model.fit(X_train_scaled, y_train)
                
                xgb_acc = self.xgb_model.score(X_test_scaled, y_test)
                
                joblib.dump(self.xgb_model, "futures_xgb_model.joblib")
                joblib.dump(self.xgb_scaler, "futures_xgb_scaler.joblib")
                
                logger.info(f"✅ XGBoost trained | Accuracy: {xgb_acc:.1%}")
            
            # Train PyTorch
            if TORCH_AVAILABLE:
                self.pytorch_scaler = StandardScaler()
                X_train_pt = self.pytorch_scaler.fit_transform(X_train)
                X_test_pt = self.pytorch_scaler.transform(X_test)
                
                X_train_t = torch.FloatTensor(X_train_pt)
                y_train_t = torch.LongTensor(y_train)
                X_test_t = torch.FloatTensor(X_test_pt)
                y_test_t = torch.LongTensor(y_test)
                
                self.pytorch_model = ScalpNet(input_size=X.shape[1], hidden_sizes=[32, 16])
                optimizer = torch.optim.Adam(self.pytorch_model.parameters(), lr=0.001)
                criterion = nn.CrossEntropyLoss()
                
                # Train
                self.pytorch_model.train()
                for epoch in range(100):
                    optimizer.zero_grad()
                    output = self.pytorch_model(X_train_t)
                    loss = criterion(output, y_train_t)
                    loss.backward()
                    optimizer.step()
                
                # Evaluate
                self.pytorch_model.eval()
                with torch.no_grad():
                    preds = torch.argmax(self.pytorch_model(X_test_t), dim=1)
                    pt_acc = (preds == y_test_t).float().mean().item()
                
                torch.save(self.pytorch_model.state_dict(), "futures_pytorch_model.pt")
                joblib.dump(self.pytorch_scaler, "futures_pytorch_scaler.joblib")
                
                logger.info(f"✅ PyTorch trained | Accuracy: {pt_acc:.1%}")
            
            self.is_ml_active = True
            
            # Update DB
            with sqlite3.connect(self.db_path) as conn:
                c = conn.cursor()
                c.execute("""
                    UPDATE futures_ml_status SET
                        xgb_active = ?,
                        pytorch_active = ?,
                        xgb_accuracy = ?,
                        pytorch_accuracy = ?,
                        last_training = ?
                    WHERE id = 1
                """, (
                    1 if XGBOOST_AVAILABLE else 0,
                    1 if TORCH_AVAILABLE else 0,
                    xgb_acc if XGBOOST_AVAILABLE else 0,
                    pt_acc if TORCH_AVAILABLE else 0,
                    datetime.now().isoformat()
                ))
                conn.commit()
                logger.info(f"💾 ML accuracy saved: XGB={xgb_acc:.1%}, PyTorch={pt_acc:.1%}")
                
        except Exception as e:
            logger.error(f"❌ Training error: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MAIN UPDATE
    # ═══════════════════════════════════════════════════════════════════════════
    
    def update(self) -> Dict:
        """
        Aggiornamento principale - chiamare ogni 90 secondi.
        """
        with self.lock:
            # Fetch data
            data = self.fetch_deribit_data()
            if data is None:
                return {"error": "Fetch failed"}
            
            # Update history
            self.price_history.append(data.last_price)
            self.data_history.append(data)
            if len(self.data_history) > self.max_history:
                self.data_history.pop(0)
            
            # Save snapshot
            self._save_snapshot(data)
            
            # Check existing positions
            closed = self._check_positions(data)
            
            # Analyze for new positions
            opened = []
            
            if len(self.positions) < self.MAX_POSITIONS:
                signals = self._analyze_strategies(data)
                
                # Sort by score
                signals.sort(key=lambda x: x[2], reverse=True)
                
                # Count current hedge pairs
                hedge_count = sum(1 for p in self.positions.values() if p.hedge_pair_id) // 2
                
                for strategy, direction, score, reason in signals:
                    if len(self.positions) >= self.MAX_POSITIONS:
                        break
                    
                    # Skip if already have position in same direction (unless hedge)
                    existing_dirs = [p.direction for p in self.positions.values()]
                    if direction in existing_dirs and strategy != Strategy.HEDGE:
                        continue
                    
                    # High uncertainty? Use hedge
                    if score < 1.0 and hedge_count < self.MAX_HEDGE_PAIRS and len(self.positions) <= self.MAX_POSITIONS - 2:
                        positions = self._open_hedge_positions(data, reason)
                        opened.extend([{
                            "position_id": p.id,
                            "direction": p.direction.value,
                            "strategy": p.strategy.value,
                            "entry_price": p.entry_price
                        } for p in positions])
                        hedge_count += 1
                    
                    elif score >= 0.5:
                        pos = self._open_position(data, direction, strategy, reason)
                        opened.append({
                            "position_id": pos.id,
                            "direction": pos.direction.value,
                            "strategy": pos.strategy.value,
                            "entry_price": pos.entry_price
                        })
            
            # Check if should retrain
            total_trades = self.wins_today + self.losses_today
            if total_trades >= self.MIN_TRADES_FOR_ML and total_trades % 10 == 0:
                threading.Thread(target=self.train_models, daemon=True).start()
            
            return {
                "timestamp": data.timestamp.isoformat(),
                "price": data.last_price,
                "funding_rate": data.funding_rate,
                "open_interest": data.open_interest,
                "book_imbalance": data.book_imbalance,
                "trade_imbalance": data.trade_imbalance,
                "momentum_5m": data.momentum_5m,
                "positions_open": len(self.positions),
                "positions": self._get_positions_info(data),
                "closed": closed,
                "opened": opened,
                "session_pnl": round(self.session_pnl_usd, 2),
                "total_pnl": round(self.total_pnl_usd, 2),
                "trades_today": self.trades_today,
                "winrate_today": round(self.wins_today / self.trades_today * 100, 1) if self.trades_today > 0 else 0,
                "ml_active": self.is_ml_active
            }
    
    def _save_snapshot(self, data: DeribitData):
        """Salva snapshot nel DB."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                c = conn.cursor()
                c.execute("""
                    INSERT INTO futures_snapshots (
                        timestamp, last_price, mark_price, index_price,
                        funding_rate, open_interest, oi_change_1h, volume_usd,
                        book_imbalance, trade_imbalance, momentum_5m, momentum_15m,
                        volatility_1h
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    data.timestamp.isoformat(),
                    data.last_price, data.mark_price, data.index_price,
                    data.funding_rate, data.open_interest, data.oi_change_1h,
                    data.volume_usd, data.book_imbalance, data.trade_imbalance,
                    data.momentum_5m, data.momentum_15m, data.volatility_1h
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"Save snapshot error: {e}")
    
    def _get_positions_info(self, data: DeribitData) -> List[Dict]:
        """Info su tutte le posizioni aperte."""
        return [{
            "id": pos.id,
            "direction": pos.direction.value,
            "strategy": pos.strategy.value,
            "entry_price": pos.entry_price,
            "current_price": data.last_price,
            "pnl_usd": round(pos.pnl_usd(data.last_price), 2),
            "pnl_pct": round(pos.pnl_pct(data.last_price), 4),
            "stop_loss": pos.stop_loss,
            "take_profit": pos.take_profit,
            "trailing_stop": pos.trailing_stop,
            "minutes_open": round((datetime.now() - pos.entry_time).total_seconds() / 60, 1),
            "is_hedge": pos.hedge_pair_id is not None
        } for pos in self.positions.values()]
    
    def get_status(self) -> Dict:
        """Status completo per dashboard."""
        latest = self.data_history[-1] if self.data_history else None
        
        # Calcola totali wins/losses in USD
        total_wins_usd = 0.0
        total_losses_usd = 0.0
        recent_trades = []
        xgb_accuracy = 0.0
        pytorch_accuracy = 0.0
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                
                # Totali
                c.execute("SELECT SUM(pnl_usd) FROM futures_scalp_trades WHERE result='WIN'")
                row = c.fetchone()
                total_wins_usd = row[0] or 0.0
                
                c.execute("SELECT SUM(ABS(pnl_usd)) FROM futures_scalp_trades WHERE result='LOSS'")
                row = c.fetchone()
                total_losses_usd = row[0] or 0.0
                
                # Ultimi 20 trade per grafico
                c.execute("""
                    SELECT result, pnl_usd, exit_time 
                    FROM futures_scalp_trades 
                    WHERE result IS NOT NULL 
                    ORDER BY exit_time DESC LIMIT 20
                """)
                for row in c.fetchall():
                    recent_trades.append({
                        "result": row["result"],
                        "pnl_usd": round(row["pnl_usd"], 2)
                    })
                
                # Leggi accuracy ML dal database
                c.execute("SELECT xgb_accuracy, pytorch_accuracy FROM futures_ml_status WHERE id = 1")
                ml_row = c.fetchone()
                if ml_row:
                    xgb_accuracy = ml_row["xgb_accuracy"] or 0.0
                    pytorch_accuracy = ml_row["pytorch_accuracy"] or 0.0
        except:
            pass
        
        return {
            "status": "ACTIVE" if self.is_ml_active else "LEARNING",
            "ml_active": self.is_ml_active,
            "price": latest.last_price if latest else 0,
            "funding_rate": latest.funding_rate if latest else 0,
            "book_imbalance": latest.book_imbalance if latest else 0,
            "trade_imbalance": latest.trade_imbalance if latest else 0,
            "positions_open": len(self.positions),
            "positions": self._get_positions_info(latest) if latest else [],
            "session_pnl_usd": round(self.session_pnl_usd, 2),
            "total_pnl_usd": round(self.total_pnl_usd, 2),
            "total_wins_usd": round(total_wins_usd, 2),
            "total_losses_usd": round(total_losses_usd, 2),
            "net_pnl_usd": round(total_wins_usd - total_losses_usd, 2),
            "trades_today": self.trades_today,
            "wins_today": self.wins_today,
            "losses_today": self.losses_today,
            "winrate_today": round(self.wins_today / self.trades_today * 100, 1) if self.trades_today > 0 else 0,
            "min_trades_ml": self.MIN_TRADES_FOR_ML,
            "strategies": [s.value for s in Strategy],
            "recent_trades": list(reversed(recent_trades)),
            "xgb_accuracy": round(xgb_accuracy * 100, 1),
            "pytorch_accuracy": round(pytorch_accuracy * 100, 1)
        }
# ═══════════════════════════════════════════════════════════════════════════════
# TEST
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    trader = BTCFuturesTrader()
    
    print("\n" + "="*70)
    print("BTC FUTURES SCALPER - TEST")
    print("="*70)
    
    result = trader.update()
    
    print(f"\n📊 Price: ${result.get('price', 0):,.2f}")
    print(f"💰 Funding: {result.get('funding_rate', 0)*100:.4f}%")
    print(f"📈 Momentum 5m: {result.get('momentum_5m', 0):+.3f}%")
    print(f"📊 Book Imbalance: {result.get('book_imbalance', 0):+.2f}")
    print(f"\n🎯 Positions: {result.get('positions_open', 0)}")
    print(f"💵 Session P&L: ${result.get('session_pnl', 0):+.2f}")
    print(f"📈 Trades Today: {result.get('trades_today', 0)}")
    print(f"🎯 Winrate: {result.get('winrate_today', 0):.1f}%")
    print(f"🤖 ML Active: {result.get('ml_active', False)}")
    
    if result.get('opened'):
        print(f"\n🚀 OPENED: {result['opened']}")
    if result.get('closed'):
        print(f"\n📊 CLOSED: {result['closed']}")
    
    print("="*70)