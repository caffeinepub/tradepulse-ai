import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  DollarSign,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trade } from "../backend";
import { Variant_win_pending_loss } from "../backend";
import { useActor } from "../hooks/useActor";

export default function PerformancePage() {
  const { actor } = useActor();

  const { data: trades, isLoading } = useQuery<Array<[string, Trade | null]>>({
    queryKey: ["latestTrades", actor],
    queryFn: () => actor?.getLatestTradeEntries() ?? [],
    enabled: !!actor,
  });

  const validTrades = (trades || [])
    .filter(([, t]) => t !== null)
    .map(([, t]) => t as Trade);

  const wins = validTrades.filter(
    (t) => t.outcome === Variant_win_pending_loss.win,
  ).length;
  const losses = validTrades.filter(
    (t) => t.outcome === Variant_win_pending_loss.loss,
  ).length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const now = Date.now();
  const oneDayAgo = now - 86400000;
  const oneWeekAgo = now - 7 * 86400000;

  const dailyPnl = validTrades
    .filter((t) => Number(t.timestamp) / 1e6 > oneDayAgo)
    .reduce((s, t) => s + t.pnl, 0);

  const weeklyPnl = validTrades
    .filter((t) => Number(t.timestamp) / 1e6 > oneWeekAgo)
    .reduce((s, t) => s + t.pnl, 0);

  // Build daily chart data for last 7 days
  const dailyChart = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayTrades = validTrades.filter((t) => {
      const ts = Number(t.timestamp) / 1e6;
      return ts >= dayStart && ts < dayEnd;
    });
    const pnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
    const date = new Date(dayStart);
    return {
      day: date.toLocaleDateString([], { weekday: "short" }),
      pnl: Math.round(pnl * 100) / 100,
    };
  });

  const stats = [
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: Trophy,
      color: "text-primary",
      ocid: "performance.winrate.card",
      sub: `${wins}W / ${losses}L`,
    },
    {
      label: "Total Trades",
      value: total.toString(),
      icon: Target,
      color: "text-foreground",
      ocid: "performance.winrate.card",
      sub: `${validTrades.filter((t) => t.outcome === Variant_win_pending_loss.pending).length} pending`,
    },
    {
      label: "Daily PnL",
      value: `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)}`,
      icon: TrendingUp,
      color: dailyPnl >= 0 ? "text-green-400" : "text-red-400",
      ocid: "performance.daily_pnl.card",
      sub: "Last 24h",
    },
    {
      label: "Weekly PnL",
      value: `${weeklyPnl >= 0 ? "+" : ""}$${weeklyPnl.toFixed(2)}`,
      icon: DollarSign,
      color: weeklyPnl >= 0 ? "text-green-400" : "text-red-400",
      ocid: "performance.weekly_pnl.card",
      sub: "Last 7 days",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Performance Tracker</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, ocid, sub }) => (
          <Card key={label} className="bg-card border-border" data-ocid={ocid}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily PnL Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Daily PnL — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyChart}>
              <XAxis
                dataKey="day"
                tick={{ fill: "oklch(0.55 0.02 220)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "oklch(0.55 0.02 220)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.13 0.02 240)",
                  border: "1px solid oklch(0.22 0.025 240)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "oklch(0.72 0.18 185)" }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyChart.map((entry) => (
                  <Cell
                    key={entry.day}
                    fill={
                      entry.pnl >= 0
                        ? "oklch(0.72 0.20 145)"
                        : "oklch(0.60 0.22 25)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">
            Trade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : validTrades.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No trade history yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      Symbol
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Entry
                    </TableHead>
                    <TableHead className="text-muted-foreground">SL</TableHead>
                    <TableHead className="text-muted-foreground">TP</TableHead>
                    <TableHead className="text-muted-foreground">PnL</TableHead>
                    <TableHead className="text-muted-foreground">
                      Outcome
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validTrades.map((trade) => (
                    <TableRow
                      key={trade.symbol + String(trade.timestamp)}
                      className="border-border hover:bg-secondary/50"
                    >
                      <TableCell className="font-mono font-semibold text-primary text-xs">
                        {trade.symbol}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {trade.entry.toFixed(4)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-red-400">
                        {trade.sl.toFixed(4)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-green-400">
                        {trade.tp.toFixed(4)}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {trade.pnl >= 0 ? "+" : ""}
                        {trade.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-semibold ${
                            trade.outcome === Variant_win_pending_loss.win
                              ? "text-green-400"
                              : trade.outcome === Variant_win_pending_loss.loss
                                ? "text-red-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {trade.outcome.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(
                          Number(trade.timestamp) / 1e6,
                        ).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
