import { Button } from "@/components/ui/button";
import { BarChart2, Shield, TrendingUp, Zap } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginPage() {
  const { login, isLoggingIn, loginError } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.18 185) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 185) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 glow-teal">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                TradePulse <span className="text-primary">AI</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Professional Trading Signals
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {[
              { icon: TrendingUp, label: "AI-powered BUY/SELL signals" },
              { icon: BarChart2, label: "RSI, MACD, Bollinger Bands analysis" },
              { icon: Shield, label: "Built-in risk management" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {loginError.message}
            </div>
          )}

          <Button
            onClick={login}
            disabled={isLoggingIn}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            data-ocid="auth.login.primary_button"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              "Connect with Internet Identity"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Secured by Internet Computer Protocol
          </p>
        </div>
      </div>
    </div>
  );
}
