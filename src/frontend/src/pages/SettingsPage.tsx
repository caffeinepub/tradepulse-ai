import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle,
  Copy,
  PlusCircle,
  Settings,
  Trash2,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { UserProfile } from "../backend";
import { Variant_forex_crypto } from "../backend";
import { useActor } from "../hooks/useActor";

export default function SettingsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["profile", actor],
    queryFn: () => actor?.getCallerUserProfile() ?? null,
    enabled: !!actor,
  });

  const [form, setForm] = useState<UserProfile>({
    balance: 10000,
    maxRiskPercent: 2,
    dailyProfitTarget: 5,
    telegramBotToken: "",
    telegramChatId: "",
    soundAlertsEnabled: true,
  });

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (p: UserProfile) => actor!.saveCallerUserProfile(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved.");
    },
    onError: () => toast.error("Failed to save settings."),
  });

  // Pair management
  const { data: pairs, refetch: refetchPairs } = useQuery({
    queryKey: ["pairs", actor],
    queryFn: () => actor?.getPairs() ?? [],
    enabled: !!actor,
  });

  const [newPairSymbol, setNewPairSymbol] = useState("");
  const [newPairType, setNewPairType] = useState<Variant_forex_crypto>(
    Variant_forex_crypto.forex,
  );

  const addPairMutation = useMutation({
    mutationFn: () => actor!.addPair(newPairSymbol.toUpperCase(), newPairType),
    onSuccess: () => {
      setNewPairSymbol("");
      refetchPairs();
      toast.success(`Pair ${newPairSymbol.toUpperCase()} added.`);
    },
    onError: () => toast.error("Failed to add pair."),
  });

  const removePairMutation = useMutation({
    mutationFn: (sym: string) => actor!.removePair(sym),
    onSuccess: () => {
      refetchPairs();
      toast.success("Pair removed.");
    },
  });

  const testTelegram = async () => {
    if (!form.telegramBotToken || !form.telegramChatId) {
      toast.error("Enter your Telegram bot token and chat ID first.");
      return;
    }
    try {
      const url = `https://api.telegram.org/bot${form.telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: form.telegramChatId,
          text: "TradePulse AI: Test message from your trading signal bot!",
        }),
      });
      if (res.ok) toast.success("Telegram test message sent!");
      else toast.error("Telegram test failed. Check your token and chat ID.");
    } catch {
      toast.error("Failed to reach Telegram API.");
    }
  };

  const webhookUrl = `${window.location.origin}/api/mt5`;
  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Account & Risk */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Account & Risk Management</CardTitle>
          <CardDescription className="text-xs">
            Define your trading capital and risk parameters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Account Balance (USD)
            </Label>
            <Input
              type="number"
              value={form.balance}
              onChange={(e) =>
                setForm({
                  ...form,
                  balance: Number.parseFloat(e.target.value) || 0,
                })
              }
              className="bg-secondary border-border"
              data-ocid="settings.balance.input"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Max Risk Per Trade:{" "}
              <span className="text-primary font-semibold">
                {form.maxRiskPercent}%
              </span>
            </Label>
            <Slider
              min={0.5}
              max={5}
              step={0.5}
              value={[form.maxRiskPercent]}
              onValueChange={([v]) => setForm({ ...form, maxRiskPercent: v })}
              className="w-full"
              data-ocid="settings.risk.input"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5%</span>
              <span>5%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Daily Profit Target (%)
            </Label>
            <Input
              type="number"
              value={form.dailyProfitTarget}
              onChange={(e) =>
                setForm({
                  ...form,
                  dailyProfitTarget: Number.parseFloat(e.target.value) || 0,
                })
              }
              className="bg-secondary border-border"
            />
          </div>

          <div className="pt-1 text-xs text-muted-foreground p-3 rounded bg-secondary">
            Risk amount per trade:{" "}
            <span className="text-primary font-semibold">
              ${((form.balance * form.maxRiskPercent) / 100).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4" /> Alert Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sound Alerts</div>
              <div className="text-xs text-muted-foreground">
                Play a sound when a new signal fires
              </div>
            </div>
            <Switch
              checked={form.soundAlertsEnabled}
              onCheckedChange={(v) =>
                setForm({ ...form, soundAlertsEnabled: v })
              }
              data-ocid="settings.sound.switch"
            />
          </div>

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div className="text-sm font-medium">Telegram Alerts</div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bot Token</Label>
              <Input
                type="text"
                placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                value={form.telegramBotToken}
                onChange={(e) =>
                  setForm({ ...form, telegramBotToken: e.target.value })
                }
                className="bg-secondary border-border font-mono text-xs"
                data-ocid="settings.telegram_token.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chat ID</Label>
              <Input
                type="text"
                placeholder="-1001234567890"
                value={form.telegramChatId}
                onChange={(e) =>
                  setForm({ ...form, telegramChatId: e.target.value })
                }
                className="bg-secondary border-border font-mono text-xs"
                data-ocid="settings.telegram_chatid.input"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testTelegram}
              className="border-border"
              data-ocid="settings.telegram_test.button"
            >
              Test Telegram
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MT5 Integration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4" /> MetaTrader 5 Integration
          </CardTitle>
          <CardDescription className="text-xs">
            Send live candle data from your MT5 terminal to TradePulse AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Webhook Endpoint
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="bg-secondary border-border font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0 border-border"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="p-3 rounded bg-secondary text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              MT5 EA Setup Instructions:
            </p>
            <p>
              1. Download a free HTTP EA script (e.g., Wininet or libcurl-based
              EA)
            </p>
            <p>2. Configure it to POST OHLCV JSON to the webhook URL above</p>
            <p>
              3. The payload should include: symbol, open, high, low, close,
              volume, timestamp
            </p>
            <p>4. Attach the EA to your MT5 chart and enable AutoTrading</p>
          </div>
        </CardContent>
      </Card>

      {/* Pair management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm">Pair Management</CardTitle>
          <CardDescription className="text-xs">
            Add custom forex or crypto pairs to track.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add pair */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="EURUSD"
                value={newPairSymbol}
                onChange={(e) => setNewPairSymbol(e.target.value)}
                className="bg-secondary border-border uppercase"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={newPairType}
                onValueChange={(v) => setNewPairType(v as Variant_forex_crypto)}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value={Variant_forex_crypto.forex}>
                    Forex
                  </SelectItem>
                  <SelectItem value={Variant_forex_crypto.crypto}>
                    Crypto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => addPairMutation.mutate()}
              disabled={!newPairSymbol || addPairMutation.isPending}
              className="mb-0"
            >
              <PlusCircle className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {/* Pair list */}
          {pairs && pairs.length > 0 && (
            <div className="space-y-2">
              {pairs.map(([sym, info]) => (
                <div
                  key={sym}
                  className="flex items-center justify-between p-2 rounded bg-secondary"
                >
                  <div>
                    <span className="font-mono font-semibold text-sm text-primary">
                      {sym}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      {info.type}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-destructive hover:text-destructive"
                    onClick={() => removePairMutation.mutate(sym)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="w-full bg-primary text-primary-foreground"
        data-ocid="settings.save.submit_button"
      >
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
