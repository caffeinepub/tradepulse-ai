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
  Newspaper,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Candle, UserProfile } from "../backend";
import CandlestickChart from "../components/CandlestickChart";
import { useActor } from "../hooks/useActor";
import {
  type SignalResult,
  formatPrice,
  generateSignalWithNews,
  parseNewsSentiment,
  playSignalSound,
} from "../utils/indicators";

const CRYPTO_PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
];

function pairToCurrency(pair: string): string {
  if (pair.startsWith("BTC")) return "BTC";
  if (pair.startsWith("ETH")) return "ETH";
  if (pair.startsWith("BNB")) return "BNB";
  if (pair.startsWith("SOL")) return "SOL";
  if (pair.startsWith("XRP")) return "XRP";
  if (pair.includes("USD") || pair.includes("EUR") || pair.includes("GBP"))
    return "USD";
  return "BTC,ETH";
}

function parseBinanceKlines(raw: string, symbol: string): Candle[] {
  try {
    const parsed: Array<Array<string | number>> = JSON.parse(raw);
    return parsed.map((k) => ({
      symbol,
      timestamp: BigInt(k[0] as number),
      open: Number.parseFloat(k[1] as string),
      high: Number.parseFloat(k[2] as string),
      low: Number.parseFloat(k[3] as string),
      close: Number.parseFloat(k[4] as string),
      volume: Number.parseFloat(k[5] as string),
    }));
  } catch {
    return [];
  }
}

interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
}

function scoreNewsSentimentItem(
  title: string,
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  const t = title.toLowerCase();
  const bullishWords = [
    "bullish",
    "surge",
    "rally",
    "buy",
    "adoption",
    "breakout",
    "gains",
    "high",
    "moon",
    "pump",
    "rise",
    "soar",
    "ath",
    "up",
  ];
  const bearishWords = [
    "bearish",
    "crash",
    "dump",
    "sell",
    "ban",
    "hack",
    "drop",
    "low",
    "loss",
    "fear",
    "fall",
    "decline",
    "down",
    "warning",
  ];
  let s = 0;
  for (const w of bullishWords) if (t.includes(w)) s++;
  for (const w of bearishWords) if (t.includes(w)) s--;
  if (s > 0) return "BULLISH";
  if (s < 0) return "BEARISH";
  return "NEUTRAL";
}

function parseNewsItems(newsJson: string): NewsItem[] {
  try {
    const data = JSON.parse(newsJson);
    const results = data?.results || [];
    return results.slice(0, 5).map(
      (item: {
        title: string;
        source?: { title: string };
        published_at?: string;
      }) => ({
        title: item.title || "",
        source: item.source?.title || "News",
        publishedAt: item.published_at || "",
        sentiment: scoreNewsSentimentItem(item.title || ""),
      }),
    );
  } catch {
    return [];
  }
}

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
  const [selectedInterval, setSelectedInterval] = useState("1h");
  const [liveCandles, setLiveCandles] = useState<Candle[]>([]);
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [newsSentiment, setNewsSentiment] = useState(0);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [livePrice, setLivePrice] = useState(0);
  const prevSignalDir = useRef<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const actorRef = useRef(actor);
  actorRef.current = actor;

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

  // Full candle history — refetch every 5s
  const {
    data: candles,
    refetch: refetchCandles,
    isFetching,
  } = useQuery<Candle[]>({
    queryKey: ["candles", selectedPair, selectedInterval, actor],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const raw = await actor.fetchBinanceData(
          selectedPair,
          selectedInterval,
        );
        const newCandles = parseBinanceKlines(raw, selectedPair);
        return newCandles;
      } catch {
        return actor.getCandles(selectedPair, BigInt(100));
      }
    },
    enabled: !!actor,
    refetchInterval: 5000,
  });

  // Sync live candles from full fetch
  useEffect(() => {
    if (candles && candles.length > 0) {
      setLiveCandles(candles.slice(-100));
    }
  }, [candles]);

  // 1-second live candle update
  useEffect(() => {
    if (!actor) return;
    const ticker = setInterval(async () => {
      try {
        const raw = await actorRef.current?.fetchBinanceData(
          selectedPair,
          selectedInterval,
        );
        if (!raw) return;
        const updated = parseBinanceKlines(raw, selectedPair);
        if (updated.length === 0) return;
        const lastCandle = updated[updated.length - 1];
        setLivePrice(lastCandle.close);
        setLiveCandles((prev) => {
          if (prev.length === 0) return updated.slice(-100);
          const arr = [...prev];
          if (arr[arr.length - 1].timestamp === lastCandle.timestamp) {
            arr[arr.length - 1] = lastCandle;
          } else {
            arr.push(lastCandle);
            if (arr.length > 100) arr.shift();
          }
          return arr;
        });
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [actor, selectedPair, selectedInterval]);

  // News fetch — every 60s
  useEffect(() => {
    if (!actor) return;
    const currency = pairToCurrency(selectedPair);
    let cancelled = false;

    const fetchNews = async () => {
      try {
        const raw = await actorRef.current?.fetchNewsData(currency);
        if (!raw || cancelled) return;
        const sentiment = parseNewsSentiment(raw, selectedPair);
        const items = parseNewsItems(raw);
        setNewsSentiment(sentiment);
        setNewsItems(items);
      } catch {
        // silent fallback
      }
    };

    fetchNews();
    const newsTimer = setInterval(fetchNews, 60000);
    return () => {
      cancelled = true;
      clearInterval(newsTimer);
    };
  }, [actor, selectedPair]);

  // Compute signal when candles or news sentiment changes
  useEffect(() => {
    if (liveCandles.length === 0) return;
    const balance = profile?.balance || 10000;
    const risk = profile?.maxRiskPercent || 2;
    const result = generateSignalWithNews(
      liveCandles,
      balance,
      risk,
      newsSentiment,
    );
    setSignal(result);

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
  }, [liveCandles, newsSentiment, profile, selectedPair]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchCandles();
    setIsRefreshing(false);
  }, [refetchCandles]);

  const allPairs = [
    ...CRYPTO_PAIRS,
    ...(pairs || [])
      .map(([sym]) => sym)
      .filter((s) => !CRYPTO_PAIRS.includes(s)),
  ];

  const currentPrice =
    livePrice || liveCandles[liveCandles.length - 1]?.close || 0;
  const prevPrice = liveCandles[liveCandles.length - 2]?.close || 0;
  const priceChange = prevPrice
    ? ((currentPrice - prevPrice) / prevPrice) * 100
    : 0;

  const sentimentLabel =
    newsSentiment > 0.1
      ? `+${newsSentiment.toFixed(2)} Bullish`
      : newsSentiment < -0.1
        ? `${newsSentiment.toFixed(2)} Bearish`
        : "Neutral";
  const sentimentColor =
    newsSentiment > 0.1
      ? "text-green-400"
      : newsSentiment < -0.1
        ? "text-red-400"
        : "text-yellow-400";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Select
            value={selectedPair}
            onValueChange={(v) => {
              setSelectedPair(v);
              setLiveCandles([]);
            }}
          >
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

      {/* Timeframe selector */}
      <div className="flex items-center gap-1">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            data-ocid={`timeframe.${label}.tab`}
            onClick={() => {
              setSelectedInterval(value);
              setLiveCandles([]);
            }}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
              selectedInterval === value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Price Chart — {selectedPair} ({selectedInterval.toUpperCase()})
              </CardTitle>
            </CardHeader>
            <CardContent data-ocid="chart.canvas_target" className="p-0 pb-2">
              {isFetching && liveCandles.length === 0 ? (
                <Skeleton
                  className="h-72 w-full"
                  data-ocid="chart.loading_state"
                />
              ) : liveCandles.length === 0 ? (
                <div
                  className="h-72 flex items-center justify-center text-muted-foreground text-sm"
                  data-ocid="chart.empty_state"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="w-8 h-8 opacity-30" />
                    <span>No chart data — fetching market data...</span>
                  </div>
                </div>
              ) : (
                <CandlestickChart
                  candles={liveCandles}
                  signal={signal}
                  selectedPair={selectedPair}
                  currentPrice={currentPrice}
                  selectedInterval={selectedInterval}
                />
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

                {/* News sentiment row */}
                <div className="flex justify-between items-center text-sm border-t border-border pt-3">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Newspaper className="w-3 h-3" /> News Sentiment
                  </span>
                  <span className={`font-mono font-semibold ${sentimentColor}`}>
                    {sentimentLabel}
                  </span>
                </div>

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

      {/* News Panel */}
      <Card className="bg-card border-border" data-ocid="news.panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Market News &amp; Sentiment — {pairToCurrency(selectedPair)}
            <Badge
              variant="outline"
              className={`ml-auto text-xs ${
                newsSentiment > 0.1
                  ? "border-green-500/50 text-green-400"
                  : newsSentiment < -0.1
                    ? "border-red-500/50 text-red-400"
                    : "border-yellow-500/50 text-yellow-400"
              }`}
            >
              {sentimentLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {newsItems.length === 0 ? (
            <div
              className="py-6 text-center text-muted-foreground text-sm"
              data-ocid="news.empty_state"
            >
              <Newspaper className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Fetching market news...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {newsItems.map((item, idx) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 px-4 py-3"
                  data-ocid={`news.item.${idx + 1}`}
                >
                  <span
                    className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded border mt-0.5 ${
                      item.sentiment === "BULLISH"
                        ? "bg-green-500/10 text-green-400 border-green-500/30"
                        : item.sentiment === "BEARISH"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {item.sentiment}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug line-clamp-2">
                      {item.title.length > 80
                        ? `${item.title.slice(0, 80)}…`
                        : item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.source} ·{" "}
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
