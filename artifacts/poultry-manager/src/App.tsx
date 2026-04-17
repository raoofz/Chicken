import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import Login from "@/pages/login";
import OfflineBanner from "@/components/OfflineBanner";
import PWAInstallBanner from "@/components/PWAInstallBanner";

// ── Lazy-loaded pages (code splitting — reduce initial bundle) ────────────────
// Core pages loaded immediately (most used)
import Dashboard from "@/pages/dashboard";

// Heavy / less-frequent pages loaded on demand
const Flocks          = lazy(() => import("@/pages/flocks"));
const Hatching        = lazy(() => import("@/pages/hatching"));
const Tasks           = lazy(() => import("@/pages/tasks"));
const Goals           = lazy(() => import("@/pages/goals"));
const Logs            = lazy(() => import("@/pages/logs"));
const Notes           = lazy(() => import("@/pages/notes"));
const SmartInput      = lazy(() => import("@/pages/smart-input"));
const AiAnalysis      = lazy(() => import("@/pages/ai-analysis"));
const AdvancedAnalysis  = lazy(() => import("@/pages/advanced-analysis"));
const PrecisionAnalysis = lazy(() => import("@/pages/precision-analysis"));
const Finance         = lazy(() => import("@/pages/finance"));
const Analytics       = lazy(() => import("@/pages/analytics"));
const FarmLab         = lazy(() => import("@/pages/farm-lab"));
const Brain           = lazy(() => import("@/pages/brain"));
const Operations      = lazy(() => import("@/pages/operations"));
const FeedIntelligence = lazy(() => import("@/pages/feed-intelligence"));
const SettingsPage    = lazy(() => import("@/pages/settings"));
const OfflinePage     = lazy(() => import("@/pages/offline"));
const NotFound        = lazy(() => import("@/pages/not-found"));

// ── Query Client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

// ── Page Loading Fallback ─────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ── App Routes ────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user, loading } = useAuth();
  const { dir, t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/"             component={Dashboard} />
          <Route path="/flocks"       component={Flocks} />
          <Route path="/hatching"     component={Hatching} />
          <Route path="/tasks"        component={Tasks} />
          <Route path="/goals"        component={Goals} />
          <Route path="/logs"         component={Logs} />
          <Route path="/notes"        component={Notes} />
          <Route path="/smart-input"  component={SmartInput} />
          <Route path="/ai"           component={AiAnalysis} />
          <Route path="/ai/advanced"  component={AdvancedAnalysis} />
          <Route path="/ai/precision" component={PrecisionAnalysis} />
          <Route path="/finance"      component={Finance} />
          <Route path="/analytics"    component={Analytics} />
          <Route path="/farm-lab"     component={FarmLab} />
          <Route path="/brain"        component={Brain} />
          <Route path="/operations"   component={Operations} />
          <Route path="/feed"         component={FeedIntelligence} />
          <Route path="/settings"     component={SettingsPage} />
          <Route path="/offline"      component={OfflinePage} />
          <Route                      component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              {/* Offline status bar (top) */}
              <OfflineBanner />
              <AppRoutes />
              {/* PWA install prompt (bottom) */}
              <PWAInstallBanner />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
