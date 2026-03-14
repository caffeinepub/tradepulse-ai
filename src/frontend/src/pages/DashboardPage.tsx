import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { Candle, UserProfile } from "../backend";
import { useActor } from "../hooks/useActor";
import {
  type SignalResult,
  formatPrice,
  generateSignal,
  playSignalSound,
} from "../utils/indicators";

const CRYPTO_PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

function TrendBadge({ trend }: { trend: "Bullish" | "Bearish" | "Sideways" }) {
  if (trend === "Bullish")
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 font-semibold">
        <TrendingUp className="w-3 h-3" /> Bullish
      </span>
    );
  if (trend === "Bearish")
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold">
        <TrendingDown className="w-3 h-3" /> Bearish
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-semibold">
      <Minus className="w-3 h-3" /> Sideways
    </span>
  );
}

export default function DashboardPage() {
  const { actor } = useActor();
  const [selectedPair, setSelectedPair] = useState(CRYPTO_PAIRS[0]);
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const prevSignalDir = useRef<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["profile", actor],
    queryFn: () => actor?.getCallerUserProfile() ?? null,
    enabled: !!actor,
  });

  const { data: pairs } = useQuery({
    queryKey: ["pairs", actor],
    queryFn: () => actor?.getPairs() ?? [],
    enabled: !!actor,
  });

  const {
    data: candles,
    refetch: refetchCandles,
    isFetching,
  } = useQuery<Candle[]>({
    queryKey: ["candles", selectedPair, actor],
    queryFn: async () => {
      if (!actor) return [];
      // Try to fetch live data from Binance first
      try {
        const raw = await actor.fetchBinanceData(selectedPair, "1h");
        const parsed: number[][] = JSON.parse(raw);
        const newCandles: Candle[] = parsed.map((k) => ({
          symbol: selectedPair,
          timestamp: BigInt(k[0]),
          open: Number.parseFloat(k[1] as unknown as string),
          high: Number.parseFloat(k[2] as unknown as string),
          low: Number.parseFloat(k[3] as unknown as string),
          close: Number.parseFloat(k[4] as unknown as string),
          volume: Number.parseFloat(k[5] as unknown as string),
        }));
        // Store in backend
        await actor.addOrUpdateCandles(selectedPair, newCandles);
        return newCandles;
      } catch {
        // Fallback to stored candles
        return actor.getCandles(selectedPair, BigInt(100));
      }
    },
    enabled: !!actor,
    refetchInterval: 30000,
  });

  // Compute signal when candles change
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const balance = profile?.balance || 10000;
    const risk = profile?.maxRiskPercent || 2;
    const result = generateSignal(candles, balance, risk);
    setSignal(result);

    // Alert on direction change
    if (
      prevSignalDir.current &&
      prevSignalDir.current !== result.direction &&
      result.direction !== "HOLD"
    ) {
      toast(`New ${result.direction} Signal on ${selectedPair}`, {
        description: `Entry: ${formatPrice(result.entry, selectedPair)} | SL: ${formatPrice(result.sl, selectedPair)} | TP: ${formatPrice(result.tp, selectedPair)}`,
        duration: 8000,
      });
      if (profile?.soundAlertsEnabled !== false) playSignalSound();
    }
    prevSignalDir.current = result.direction;
  }, [candles, profile, selectedPair]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchCandles();
    setIsRefreshing(false);
  }, [refetchCandles]);

  // Chart data
  const chartData = (candles || []).slice(-60).map((c) => ({
    time: new Date(Number(c.timestamp)).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: c.close,
    high: c.high,
    low: c.low,
    volume: c.volume,
  }));

  const allPairs = [
    ...CRYPTO_PAIRS,
    ...(pairs || [])
      .map(([sym]) => sym)
      .filter((s) => !CRYPTO_PAIRS.includes(s)),
  ];

  const currentPrice = candles?.[candles.length - 1]?.close || 0;
  const prevPrice = candles?.[candles.length - 2]?.close || 0;
  const priceChange = prevPrice
    ? ((currentPrice - prevPrice) / prevPrice) * 100
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Select value={selectedPair} onValueChange={setSelectedPair}>
            <SelectTrigger
              className="w-36 bg-card border-border"
              data-ocid="pair.selector.tab"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {allPairs.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-mono">
              {formatPrice(currentPrice, selectedPair)}
            </span>
            <span
              className={`text-sm font-medium ${
                priceChange >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          </div>

          {signal && <TrendBadge trend={signal.trend} />}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching || isRefreshing}
          className="border-border"
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Price Chart — {selectedPair} (1H)
              </CardTitle>
            </CardHeader>
            <CardContent data-ocid="chart.canvas_target">
              {isFetching && !candles ? (
                <Skeleton
                  className="h-64 w-full"
                  data-ocid="chart.loading_state"
                />
              ) : chartData.length === 0 ? (
                <div
                  className="h-64 flex items-center justify-center text-muted-foreground text-sm"
                  data-ocid="chart.empty_state"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="w-8 h-8 opacity-30" />
                    <span>No chart data — fetching market data...</span>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="priceGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="oklch(0.72 0.18 185)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="oklch(0.72 0.18 185)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "oklch(0.55 0.02 220)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.55 0.02 220)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tickFormatter={(v) => formatPrice(v, selectedPair)}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.13 0.02 240)",
                        border: "1px solid oklch(0.22 0.025 240)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "oklch(0.72 0.18 185)" }}
                      itemStyle={{ color: "oklch(0.92 0.02 220)" }}
                    />
                    {signal && (
                      <>
                        <ReferenceLine
                          y={signal.sl}
                          stroke="oklch(0.60 0.22 25)"
                          strokeDasharray="4 4"
                          label={{
                            value: "SL",
                            fill: "oklch(0.60 0.22 25)",
                            fontSize: 10,
                          }}
                        />
                        <ReferenceLine
                          y={signal.tp}
                          stroke="oklch(0.72 0.20 145)"
                          strokeDasharray="4 4"
                          label={{
                            value: "TP",
                            fill: "oklch(0.72 0.20 145)",
                            fontSize: 10,
                          }}
                        />
                        <ReferenceLine
                          y={signal.entry}
                          stroke="oklch(0.72 0.18 185)"
                          strokeDasharray="2 2"
                          label={{
                            value: "Entry",
                            fill: "oklch(0.72 0.18 185)",
                            fontSize: 10,
                          }}
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="oklch(0.72 0.18 185)"
                      strokeWidth={1.5}
                      fill="url(#priceGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Signal Card */}
        <div data-ocid="signal.card.panel">
          {!signal ? (
            <Card className="bg-card border-border h-full">
              <CardContent className="pt-6">
                <Skeleton
                  className="h-80 w-full"
                  data-ocid="signal.loading_state"
                />
              </CardContent>
            </Card>
          ) : (
            <Card
              className={`bg-card border h-full ${
                signal.direction === "BUY"
                  ? "border-green-500/40 glow-green"
                  : signal.direction === "SELL"
                    ? "border-red-500/40 glow-red"
                    : "border-border"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">
                    Signal
                  </CardTitle>
                  <span
                    data-ocid="signal.direction.toggle"
                    className={`text-lg font-black tracking-widest px-4 py-1 rounded border ${
                      signal.direction === "BUY"
                        ? "signal-buy signal-buy-bg"
                        : signal.direction === "SELL"
                          ? "signal-sell signal-sell-bg"
                          : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                    }`}
                  >
                    {signal.direction}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price levels */}
                <div className="space-y-2">
                  {[
                    {
                      label: "Entry",
                      value: formatPrice(signal.entry, selectedPair),
                      color: "text-primary",
                    },
                    {
                      label: "Stop Loss",
                      value: formatPrice(signal.sl, selectedPair),
                      color: "text-red-400",
                    },
                    {
                      label: "Take Profit",
                      value: formatPrice(signal.tp, selectedPair),
                      color: "text-green-400",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-mono font-semibold ${color}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lot Size</span>
                    <span className="font-mono font-semibold">
                      {signal.lotSize}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">R:R Ratio</span>
                    <span className="font-mono font-semibold">
                      1:{signal.rrRatio}
                    </span>
                  </div>
                </div>

                {/* Probability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Probability</span>
                    <span className="font-semibold text-primary">
                      {signal.probability}%
                    </span>
                  </div>
                  <Progress
                    value={signal.probability}
                    className="h-2"
                    style={{
                      background: "oklch(0.18 0.025 240)",
                    }}
                  />
                </div>

                {/* Indicator mini-stats */}
                <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-secondary">
                    <div className="text-xs text-muted-foreground">RSI</div>
                    <div
                      className={`text-sm font-bold font-mono ${
                        signal.rsi > 70
                          ? "text-red-400"
                          : signal.rsi < 30
                            ? "text-green-400"
                            : "text-foreground"
                      }`}
                    >
                      {signal.rsi}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-secondary">
                    <div className="text-xs text-muted-foreground">MACD</div>
                    <div
                      className={`text-sm font-bold font-mono ${
                        signal.macd > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {signal.macd > 0 ? "+" : ""}
                      {signal.macd}
                    </div>
                  </div>
                </div>

                {signal.direction !== "HOLD" && (
                  <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-400">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    Trading involves risk. Always verify signals manually.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Stats row */}
      {signal && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Trend",
              value: signal.trend,
              color:
                signal.trend === "Bullish"
                  ? "text-green-400"
                  : signal.trend === "Bearish"
                    ? "text-red-400"
                    : "text-yellow-400",
            },
            {
              label: "Account Balance",
              value: `$${(profile?.balance || 10000).toLocaleString()}`,
              color: "text-primary",
            },
            {
              label: "Max Risk / Trade",
              value: `${profile?.maxRiskPercent || 2}%`,
              color: "text-foreground",
            },
            {
              label: "Risk Amount",
              value: `$${(((profile?.balance || 10000) * (profile?.maxRiskPercent || 2)) / 100).toFixed(2)}`,
              color: "text-foreground",
            },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-muted-foreground mb-1">
                  {label}
                </div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
