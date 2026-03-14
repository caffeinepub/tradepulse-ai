import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PerformancePage from "./pages/PerformancePage";
import SettingsPage from "./pages/SettingsPage";
import SignalsPage from "./pages/SignalsPage";

export type Page = "dashboard" | "signals" | "performance" | "settings";

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">
            Initializing TradePulse AI...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <Toaster richColors />
      {currentPage === "dashboard" && <DashboardPage />}
      {currentPage === "signals" && <SignalsPage />}
      {currentPage === "performance" && <PerformancePage />}
      {currentPage === "settings" && <SettingsPage />}
    </Layout>
  );
}
