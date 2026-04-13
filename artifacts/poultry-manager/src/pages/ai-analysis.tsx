import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, RefreshCw, AlertTriangle, AlertCircle, Info,
  ShieldAlert, Bird, Egg, CheckSquare, Target, TrendingUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  type: "danger" | "warning" | "info";
  title: string;
  description: string;
}

interface Section {
  tag: string;
  title: string;
  content: string;
}

interface Stats {
  chickens: number;
  hatchRate: string;
  activeCycles: number;
  tasksDone: string;
  goals: string;
  urgentItems: number;
}

interface Analysis {
  alerts: Alert[];
  sections: Section[];
  topPriority: string;
  stats: Stats;
}

interface AnalysisResponse {
  analysis: Analysis;
  rawData: Record<string, any>;
  timestamp: string;
}

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const isRtl = dir === "rtl";

  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRawData, setShowRawData] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("ai.restricted")}</h2>
        <p className="text-muted-foreground">{t("ai.adminOnly")}</p>
      </div>
    );
  }

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("ai.errorMsg"));
      }
      const data: AnalysisResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? t("ai.errorMsg"));
      toast({ title: t("ai.failedMsg"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const alertIcon = (type: string) => {
    switch (type) {
      case "danger": return <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />;
      case "warning": return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />;
      default: return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  const alertBg = (type: string) => {
    switch (type) {
      case "danger": return "bg-red-500/10 border-red-500/30";
      case "warning": return "bg-amber-500/10 border-amber-500/30";
      default: return "bg-blue-500/10 border-blue-500/30";
    }
  };

  const statItems = result ? [
    { label: t("ai.stat.chickens"), value: result.analysis.stats.chickens, icon: Bird, color: "text-green-600" },
    { label: t("ai.stat.hatchRate"), value: result.analysis.stats.hatchRate, icon: Egg, color: "text-amber-600" },
    { label: t("ai.stat.activeCycles"), value: result.analysis.stats.activeCycles, icon: TrendingUp, color: "text-blue-600" },
    { label: t("ai.stat.tasksDone"), value: result.analysis.stats.tasksDone, icon: CheckSquare, color: "text-purple-600" },
    { label: t("ai.stat.goals"), value: result.analysis.stats.goals, icon: Target, color: "text-indigo-600" },
    { label: t("ai.stat.urgent"), value: result.analysis.stats.urgentItems, icon: AlertTriangle, color: "text-red-600" },
  ] : [];

  if (!result && !loading && !error) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("ai.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("ai.subtitle")}</p>
        </div>

        <Card className="max-w-lg mx-auto shadow-xl border-primary/20">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center">
              <Brain className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold">{t("ai.welcome.title")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t("ai.welcome.desc1") }} />
              <p className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t("ai.welcome.desc2") }} />
            </div>
            <Button onClick={runAnalysis} size="lg" className="w-full text-base gap-2">
              <Sparkles className="w-5 h-5" />
              {t("ai.startNow")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("ai.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("ai.subtitle")}</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {loading ? t("ai.analyzing") : t("ai.refresh")}
        </Button>
      </div>

      {loading && (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-lg">{t("ai.analyzing")}</p>
              <p className="text-sm text-muted-foreground">{t("ai.deepAnalysis")}</p>
            </div>
            <div className="w-48 mx-auto h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <p className="font-semibold text-red-600">{t("ai.failed")}</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={runAnalysis} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t("ai.refresh")}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <>
          {result.timestamp && (
            <p className="text-xs text-muted-foreground">
              {t("ai.lastAnalysis")} {new Date(result.timestamp).toLocaleString(isRtl ? "ar" : "sv")}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statItems.map((s, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-3 text-center space-y-1">
                  <s.icon className={cn("w-5 h-5 mx-auto", s.color)} />
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {result.analysis.topPriority && (
            <Card className="border-primary/30 bg-primary/5 shadow-md">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">{t("ai.topPriority")}</p>
                  <p className="text-sm font-medium">{result.analysis.topPriority}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {result.analysis.alerts.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t("ai.needsAttention")} ({result.analysis.alerts.length})
              </h3>
              {result.analysis.alerts.map((alert, i) => (
                <div key={i} className={cn("border rounded-xl p-3 flex items-start gap-3", alertBg(alert.type))}>
                  {alertIcon(alert.type)}
                  <div>
                    <p className="font-semibold text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-green-600 font-medium">
              {t("ai.allGood")}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {result.analysis.sections.map((section, i) => (
              <Card key={i} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{section.tag.split(" ")[0]}</span>
                    <span>{section.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {section.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              {t("ai.rawData")}
            </button>
            {showRawData && (
              <Card className="mt-3 text-start">
                <CardContent className="p-4">
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-60" dir="ltr">
                    {JSON.stringify(result.rawData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
