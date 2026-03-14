# TradePulse AI - Trading Signal Platform

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Full-stack trading signal web app with authentication
- Binance REST API integration (HTTP outcalls) for crypto market data (BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT, XRP/USDT)
- MT5 webhook endpoint to receive price data from MetaTrader 5 EA scripts
- Rule-based signal engine: RSI, MACD, Bollinger Bands, Moving Averages, Support/Resistance, Volume scoring
- Signal output: BUY/SELL, Entry, Stop Loss, Take Profit, Lot Size, R:R Ratio, Probability %
- Risk management engine: position size from account balance, max risk % (1-2%), daily profit target
- User authentication (login/register) with per-user stored settings and trade history
- Performance tracker: win rate, daily profit, weekly profit, trade history log
- Alert system: in-app popup alerts, sound notifications, Telegram bot config (user-configurable)
- Dashboard: live candlestick chart, trend indicator, active signal card, positions
- Forex and crypto pair support

### Modify
- Nothing (new project)

### Remove
- Nothing (new project)

## Implementation Plan

### Backend (Motoko)
1. User auth system (register/login/session via authorization component)
2. User profile store: account balance, max risk %, daily target, telegram config
3. Market data fetcher: HTTP outcalls to Binance REST API (/api/v3/klines, /api/v3/ticker/price)
4. MT5 webhook receiver: accepts OHLCV data payloads from external EA
5. Signal engine: compute RSI, MACD, EMA/SMA, Bollinger Bands, S/R levels from candle data; score and emit BUY/SELL signal with Entry/SL/TP/LotSize/RR/Probability
6. Risk calculator: position size = (balance * riskPct) / (entry - stopLoss)
7. Trade history store: record signals, outcomes (win/loss user-reported), timestamps
8. Performance aggregator: win rate, daily/weekly PnL from trade history
9. Telegram alert endpoint: forward signal to user-configured Telegram bot via HTTP outcall

### Frontend (React + TypeScript)
1. Auth pages: Login / Register
2. Dashboard page: pair selector, candlestick chart (lightweight-charts), trend badge, active signal card
3. Signal card: BUY/SELL badge, Entry/SL/TP, Lot Size, R:R, Probability bar
4. Risk settings panel: account balance input, max risk %, daily profit target
5. Performance tracker page: win rate chart, daily/weekly PnL, trade history table
6. Alert settings: Telegram bot token + chat ID config, sound toggle
7. MT5 data panel: webhook URL display, connection status
8. Toast/popup alerts + audio playback on new signal
9. Responsive mobile-friendly layout with dark trading theme
