import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import Flocks from "@/pages/flocks";
import Hatching from "@/pages/hatching";
import Tasks from "@/pages/tasks";
import Goals from "@/pages/goals";
import Logs from "@/pages/logs";
import Notes from "@/pages/notes";
import Login from "@/pages/login";
import SettingsPage from "@/pages/settings";
import AiAnalysis from "@/pages/ai-analysis";
import AdvancedAnalysis from "@/pages/advanced-analysis";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

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
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/flocks" component={Flocks} />
        <Route path="/hatching" component={Hatching} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/goals" component={Goals} />
        <Route path="/logs" component={Logs} />
        <Route path="/notes" component={Notes} />
        <Route path="/ai" component={AiAnalysis} />
        <Route path="/ai/advanced" component={AdvancedAnalysis} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
