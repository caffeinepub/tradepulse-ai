import type { Candle } from "../backend";

export interface SignalResult {
  direction: "BUY" | "SELL" | "HOLD";
  entry: number;
  sl: number;
  tp: number;
  lotSize: number;
  rrRatio: number;
  probability: number;
  trend: "Bullish" | "Bearish" | "Sideways";
  rsi: number;
  macd: number;
  bbPosition: number; // 0-1 where price is in BB
}

export function computeEMA(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = closes[0];
  for (const c of closes) {
    prev = c * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

export function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeMACD(closes: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  const signalLine = computeEMA(macdLine, 9);
  const last = macdLine.length - 1;
  const macd = macdLine[last];
  const signal = signalLine[last];
  return { macd, signal, histogram: macd - signal };
}

export function computeBollingerBands(
  closes: number[],
  period = 20,
): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last * 1.02, middle: last, lower: last * 0.98 };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(
    slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period,
  );
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

export function computeATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function computeSupportResistance(candles: Candle[]): {
  support: number;
  resistance: number;
} {
  if (candles.length === 0) return { support: 0, resistance: 0 };
  const slice = candles.slice(-20);
  const lows = slice.map((c) => c.low);
  const highs = slice.map((c) => c.high);
  return {
    support: Math.min(...lows),
    resistance: Math.max(...highs),
  };
}

export function generateSignal(
  candles: Candle[],
  balance: number,
  maxRiskPercent: number,
): SignalResult {
  if (candles.length < 30) {
    const entry = candles[candles.length - 1]?.close || 0;
    return {
      direction: "HOLD",
      entry,
      sl: entry * 0.99,
      tp: entry * 1.01,
      lotSize: 0.01,
      rrRatio: 2,
      probability: 50,
      trend: "Sideways",
      rsi: 50,
      macd: 0,
      bbPosition: 0.5,
    };
  }

  const closes = candles.map((c) => c.close);
  const entry = closes[closes.length - 1];

  const rsi = computeRSI(closes);
  const { macd, signal: macdSignal, histogram } = computeMACD(closes);
  const bb = computeBollingerBands(closes);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const atr = computeATR(candles);
  const { support, resistance } = computeSupportResistance(candles);

  const lastEma20 = ema20[ema20.length - 1];
  const lastEma50 = ema50[ema50.length - 1];

  // Scoring
  let score = 0;
  const maxScore = 6;

  // RSI
  if (rsi < 40)
    score += 1; // oversold = bullish
  else if (rsi > 60) score -= 1; // overbought = bearish

  // MACD
  if (histogram > 0 && macd > macdSignal) score += 1;
  else if (histogram < 0 && macd < macdSignal) score -= 1;

  // EMA trend
  if (lastEma20 > lastEma50) score += 1;
  else if (lastEma20 < lastEma50) score -= 1;

  // Bollinger position
  const bbRange = bb.upper - bb.lower;
  const bbPosition = bbRange > 0 ? (entry - bb.lower) / bbRange : 0.5;
  if (bbPosition < 0.25)
    score += 1; // near lower band = bullish
  else if (bbPosition > 0.75) score -= 1; // near upper band = bearish

  // S/R proximity
  const range = resistance - support;
  if (range > 0) {
    const pos = (entry - support) / range;
    if (pos < 0.3)
      score += 1; // near support = bullish
    else if (pos > 0.7) score -= 1; // near resistance = bearish
  }

  // Volume trend (simple: last candle volume vs avg)
  const avgVol = candles.slice(-10).reduce((s, c) => s + c.volume, 0) / 10;
  const lastVol = candles[candles.length - 1].volume;
  if (lastVol > avgVol * 1.2) {
    score += closes[closes.length - 1] > closes[closes.length - 2] ? 1 : -1;
  }

  const normalizedScore = (score + maxScore) / (2 * maxScore); // 0 to 1
  const probability = Math.round(normalizedScore * 100);

  let direction: "BUY" | "SELL" | "HOLD";
  if (probability >= 60) direction = "BUY";
  else if (probability <= 40) direction = "SELL";
  else direction = "HOLD";

  const atrFactor = atr > 0 ? atr : entry * 0.01;
  let sl: number;
  let tp: number;

  if (direction === "BUY") {
    sl = entry - 1.5 * atrFactor;
    tp = entry + 3 * atrFactor;
  } else if (direction === "SELL") {
    sl = entry + 1.5 * atrFactor;
    tp = entry - 3 * atrFactor;
  } else {
    sl = entry - 1.5 * atrFactor;
    tp = entry + 3 * atrFactor;
  }

  const slDistance = Math.abs(entry - sl);
  const tpDistance = Math.abs(tp - entry);
  const rrRatio = slDistance > 0 ? tpDistance / slDistance : 2;

  // Lot size: (balance * riskPct%) / (slDistance * pip_value)
  // For crypto/forex simplified: use slDistance as pip move
  const riskAmount = (balance * maxRiskPercent) / 100;
  let lotSize = slDistance > 0 ? riskAmount / (slDistance * 10) : 0.01;
  lotSize = Math.max(0.01, Math.min(10, Math.round(lotSize * 100) / 100));

  let trend: "Bullish" | "Bearish" | "Sideways";
  if (lastEma20 > lastEma50 * 1.002) trend = "Bullish";
  else if (lastEma20 < lastEma50 * 0.998) trend = "Bearish";
  else trend = "Sideways";

  return {
    direction,
    entry,
    sl,
    tp,
    lotSize,
    rrRatio: Math.round(rrRatio * 10) / 10,
    probability,
    trend,
    rsi: Math.round(rsi),
    macd: Math.round(macd * 10000) / 10000,
    bbPosition: Math.round(bbPosition * 100) / 100,
  };
}

export function playSignalSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore
  }
}

export function formatPrice(price: number, symbol?: string): string {
  if (!price) return "0.00";
  // Forex pairs have more decimals
  const isForex =
    symbol &&
    !symbol.includes("BTC") &&
    !symbol.includes("ETH") &&
    !symbol.includes("BNB") &&
    !symbol.includes("USDT");
  if (isForex) return price.toFixed(5);
  if (price > 1000) return price.toFixed(2);
  if (price > 1) return price.toFixed(4);
  return price.toFixed(6);
}
