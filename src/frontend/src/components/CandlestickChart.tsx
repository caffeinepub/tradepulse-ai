import { useEffect, useRef, useState } from "react";
import type { Candle } from "../backend";
import type { SignalResult } from "../utils/indicators";
import { formatPrice } from "../utils/indicators";

interface TooltipData {
  x: number;
  y: number;
  candle: Candle;
}

interface Props {
  candles: Candle[];
  signal?: SignalResult | null;
  selectedPair: string;
  currentPrice?: number;
  selectedInterval?: string;
}

const VOLUME_HEIGHT_RATIO = 0.2;
const PADDING = { top: 16, right: 60, bottom: 40, left: 8 };
const VOLUME_GAP = 8;

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Closing...";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  return `${totalSec}s`;
}

export default function CandlestickChart({
  candles,
  signal,
  selectedPair,
  currentPrice,
  selectedInterval,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!selectedInterval || candles.length === 0) return;
    const intervalMs = INTERVAL_MS[selectedInterval] || 60_000;
    const lastCandle = candles[candles.length - 1];

    const tick = () => {
      const closeTime = Number(lastCandle.timestamp) + intervalMs;
      const remaining = closeTime - Date.now();
      setCountdown(formatCountdown(remaining));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [candles, selectedInterval]);

  const height = 300;
  const display = candles.slice(
    -Math.floor((width - PADDING.left - PADDING.right) / 6),
  );
  if (display.length === 0) return null;

  const chartW = width - PADDING.left - PADDING.right;
  const totalH = height - PADDING.top - PADDING.bottom;
  const volH = totalH * VOLUME_HEIGHT_RATIO;
  const priceH = totalH - volH - VOLUME_GAP;

  const prices = display.flatMap((c) => [c.high, c.low]);
  const signalLevels = signal ? [signal.sl, signal.tp, signal.entry] : [];
  const livePriceLevels =
    currentPrice && currentPrice > 0 ? [currentPrice] : [];
  const allPrices = [
    ...prices,
    ...signalLevels.filter(Boolean),
    ...livePriceLevels,
  ];
  let priceMin = Math.min(...allPrices);
  let priceMax = Math.max(...allPrices);
  const pricePad = (priceMax - priceMin) * 0.05 || priceMin * 0.01;
  priceMin -= pricePad;
  priceMax += pricePad;
  const priceRange = priceMax - priceMin || 1;

  const maxVol = Math.max(...display.map((c) => c.volume), 1);
  const candleW = Math.max(2, chartW / display.length - 1);

  const px = (i: number) =>
    PADDING.left + i * (chartW / display.length) + chartW / display.length / 2;
  const py = (price: number) =>
    PADDING.top + priceH - ((price - priceMin) / priceRange) * priceH;
  const pvy = (vol: number) =>
    PADDING.top + priceH + VOLUME_GAP + volH - (vol / maxVol) * volH;

  const yTicks: number[] = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(priceMin + (priceRange * i) / tickCount);
  }

  const xTickEvery = Math.max(1, Math.floor(display.length / 6));

  // Live price line Y position
  const showPriceLine = currentPrice && currentPrice > 0;
  const priceLineY = showPriceLine ? py(currentPrice) : 0;

  return (
    <div
      ref={containerRef}
      className="w-full relative select-none"
      style={{ height }}
    >
      <svg
        role="img"
        aria-label={`${selectedPair} candlestick chart`}
        width={width}
        height={height}
        style={{ display: "block" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left - PADDING.left;
          const idx = Math.round((mx / chartW) * (display.length - 1));
          if (idx >= 0 && idx < display.length) {
            setTooltip({
              x: px(idx),
              y: e.clientY - rect.top,
              candle: display[idx],
            });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <title>{selectedPair} Candlestick Chart</title>

        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={py(tick)}
            y2={py(tick)}
            stroke="oklch(0.25 0.02 240)"
            strokeWidth={0.5}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={width - PADDING.right + 4}
            y={py(tick) + 4}
            fill="oklch(0.50 0.02 220)"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
          >
            {formatPrice(tick, selectedPair)}
          </text>
        ))}

        {/* X axis labels */}
        {display.map((c, i) => {
          if (i % xTickEvery !== 0) return null;
          const ts = new Date(Number(c.timestamp));
          const label = ts.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <text
              key={String(c.timestamp)}
              x={px(i)}
              y={height - 8}
              fill="oklch(0.50 0.02 220)"
              fontSize={9}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {label}
            </text>
          );
        })}

        {/* Signal reference lines */}
        {signal &&
          [
            { price: signal.sl, color: "oklch(0.60 0.22 25)", label: "SL" },
            { price: signal.tp, color: "oklch(0.72 0.20 145)", label: "TP" },
            {
              price: signal.entry,
              color: "oklch(0.72 0.18 185)",
              label: "Entry",
            },
          ].map(({ price, color, label }) => (
            <g key={label}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={py(price)}
                y2={py(price)}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={width - PADDING.right + 4}
                y={py(price) - 3}
                fill={color}
                fontSize={8}
                fontFamily="'JetBrains Mono', monospace"
              >
                {label}
              </text>
            </g>
          ))}

        {/* Candles */}
        {display.map((c, i) => {
          const isBull = c.close >= c.open;
          const color = isBull ? "oklch(0.72 0.20 145)" : "oklch(0.60 0.22 25)";
          const cx = px(i);
          const openY = py(c.open);
          const closeY = py(c.close);
          const highY = py(c.high);
          const lowY = py(c.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyH = Math.max(1, Math.abs(closeY - openY));
          const halfW = Math.max(1, candleW / 2 - 0.5);
          const vBarH = Math.max(1, (c.volume / maxVol) * volH);
          const vBarY = pvy(c.volume);

          return (
            <g key={String(c.timestamp)}>
              <line
                x1={cx}
                x2={cx}
                y1={highY}
                y2={lowY}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={cx - halfW}
                y={bodyTop}
                width={halfW * 2}
                height={bodyH}
                fill={color}
                opacity={0.9}
              />
              <rect
                x={cx - halfW}
                y={vBarY}
                width={halfW * 2}
                height={vBarH}
                fill={color}
                opacity={0.4}
              />
            </g>
          );
        })}

        {/* Volume separator */}
        <line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={PADDING.top + priceH + VOLUME_GAP / 2}
          y2={PADDING.top + priceH + VOLUME_GAP / 2}
          stroke="oklch(0.25 0.02 240)"
          strokeWidth={0.5}
        />

        {/* Live price line */}
        {showPriceLine && (
          <g>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={priceLineY}
              y2={priceLineY}
              stroke="oklch(0.85 0.12 195)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {/* Price label badge on right axis */}
            <rect
              x={width - PADDING.right + 2}
              y={priceLineY - 7}
              width={56}
              height={14}
              rx={2}
              fill="oklch(0.85 0.12 195)"
              opacity={0.15}
            />
            <rect
              x={width - PADDING.right + 2}
              y={priceLineY - 7}
              width={56}
              height={14}
              rx={2}
              fill="none"
              stroke="oklch(0.85 0.12 195)"
              strokeWidth={0.6}
              opacity={0.7}
            />
            <text
              x={width - PADDING.right + 30}
              y={priceLineY + 4}
              fill="oklch(0.85 0.12 195)"
              fontSize={8}
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {formatPrice(currentPrice, selectedPair)}
            </text>
          </g>
        )}

        {/* Candle close countdown */}
        {countdown && (
          <g>
            <rect
              x={PADDING.left + 4}
              y={PADDING.top + 2}
              width={64}
              height={16}
              rx={3}
              fill="oklch(0.15 0.02 240)"
              opacity={0.85}
            />
            <text
              x={PADDING.left + 10}
              y={PADDING.top + 13}
              fill="oklch(0.75 0.05 220)"
              fontSize={9}
              fontFamily="'JetBrains Mono', monospace"
            >
              {`⏱ ${countdown}`}
            </text>
          </g>
        )}

        {/* Crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={PADDING.top}
              y2={height - PADDING.bottom}
              stroke="oklch(0.55 0.05 220)"
              strokeWidth={0.8}
              strokeDasharray="3 3"
            />
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={tooltip.y}
              y2={tooltip.y}
              stroke="oklch(0.55 0.05 220)"
              strokeWidth={0.8}
              strokeDasharray="3 3"
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded border border-border bg-card/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, width - 160),
            top: Math.max(4, tooltip.y - 60),
          }}
        >
          <div className="text-muted-foreground mb-1">
            {new Date(Number(tooltip.candle.timestamp)).toLocaleString()}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            <span className="text-muted-foreground">O</span>
            <span>{formatPrice(tooltip.candle.open, selectedPair)}</span>
            <span className="text-green-400">H</span>
            <span className="text-green-400">
              {formatPrice(tooltip.candle.high, selectedPair)}
            </span>
            <span className="text-red-400">L</span>
            <span className="text-red-400">
              {formatPrice(tooltip.candle.low, selectedPair)}
            </span>
            <span className="text-primary">C</span>
            <span className="text-primary">
              {formatPrice(tooltip.candle.close, selectedPair)}
            </span>
            <span className="text-muted-foreground">V</span>
            <span>{tooltip.candle.volume.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
