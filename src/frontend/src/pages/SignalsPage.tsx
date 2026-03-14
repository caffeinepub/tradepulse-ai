import { Badge } from "@/components/ui/badge";
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
import { Zap } from "lucide-react";
import type { Trade } from "../backend";
import { Variant_buy_sell, Variant_win_pending_loss } from "../backend";
import { useActor } from "../hooks/useActor";
import { formatPrice } from "../utils/indicators";

function DirectionBadge({ direction }: { direction: Variant_buy_sell }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded border ${
        direction === Variant_buy_sell.buy
          ? "signal-buy signal-buy-bg"
          : "signal-sell signal-sell-bg"
      }`}
    >
      {direction === Variant_buy_sell.buy ? "BUY" : "SELL"}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: Variant_win_pending_loss }) {
  if (outcome === Variant_win_pending_loss.win)
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">
        WIN
      </Badge>
    );
  if (outcome === Variant_win_pending_loss.loss)
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
        LOSS
      </Badge>
    );
  return (
    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">
      PENDING
    </Badge>
  );
}

export default function SignalsPage() {
  const { actor } = useActor();

  const { data: trades, isLoading } = useQuery<Array<[string, Trade | null]>>({
    queryKey: ["latestTrades", actor],
    queryFn: () => actor?.getLatestTradeEntries() ?? [],
    enabled: !!actor,
  });

  const validTrades = (trades || []).filter(([, t]) => t !== null) as Array<
    [string, Trade]
  >;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Trading Signals</h1>
        <span className="text-sm text-muted-foreground">
          Latest signal per pair
        </span>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">
            Signal Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" data-ocid="trade.history.loading_state">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : validTrades.length === 0 ? (
            <div
              className="py-12 text-center text-muted-foreground"
              data-ocid="trade.history.empty_state"
            >
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No signals recorded yet.</p>
              <p className="text-xs mt-1">
                Visit the Dashboard to start analyzing pairs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-ocid="trade.history.table">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      Symbol
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Direction
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Entry
                    </TableHead>
                    <TableHead className="text-muted-foreground">SL</TableHead>
                    <TableHead className="text-muted-foreground">TP</TableHead>
                    <TableHead className="text-muted-foreground">
                      Prob.
                    </TableHead>
                    <TableHead className="text-muted-foreground">R:R</TableHead>
                    <TableHead className="text-muted-foreground">PnL</TableHead>
                    <TableHead className="text-muted-foreground">
                      Outcome
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validTrades.map(([sym, trade], idx) => (
                    <TableRow
                      key={sym}
                      className="border-border hover:bg-secondary/50"
                      data-ocid={`trade.history.row.item.${idx + 1}`}
                    >
                      <TableCell className="font-mono font-semibold text-primary text-xs">
                        {sym}
                      </TableCell>
                      <TableCell>
                        <DirectionBadge direction={trade.direction} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatPrice(trade.entry, sym)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-red-400">
                        {formatPrice(trade.sl, sym)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-green-400">
                        {formatPrice(trade.tp, sym)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {Number(trade.probability)}%
                      </TableCell>
                      <TableCell className="text-xs">
                        1:{trade.rrRatio.toFixed(1)}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {trade.pnl >= 0 ? "+" : ""}
                        {trade.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <OutcomeBadge outcome={trade.outcome} />
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
