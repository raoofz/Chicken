import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Brain, RefreshCw, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Egg, Droplets, Thermometer, Skull, Wheat,
  Activity, Target, Heart, Zap, BarChart3, PlusCircle, Save
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchReport(lang: string) {
  const r = await fetch(`${BASE}/api/intelligence/report?lang=${lang}`, { credentials: "include" });
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
}

async function postData(endpoint: string, data: any) {
  const r = await fetch(`${BASE}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("save failed");
  return r.json();
}

export default function Intelligence() {
  const { t, lang, dir } = useLanguage();
  const isRtl = dir === "rtl";
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "data" | "trends">("overview");

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ["intelligence", lang],
    queryFn: () => fetchReport(lang),
    staleTime: 60_000,
  });

  const tabs = [
    { id: "overview" as const, label: t("intel.tab.overview"), icon: Activity },
    { id: "data" as const, label: t("intel.tab.data"), icon: PlusCircle },
    { id: "trends" as const, label: t("intel.tab.trends"), icon: BarChart3 },
  ];

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("intel.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("intel.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition text-sm font-medium"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          {t("intel.refresh")}
        </button>
      </div>

      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-20 space-y-3">
          <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("intel.loading")}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{t("intel.error")}</p>
        </div>
      )}

      {report && !isLoading && (
        <>
          {activeTab === "overview" && <OverviewTab report={report} t={t} lang={lang} isRtl={isRtl} />}
          {activeTab === "data" && <DataEntryTab t={t} lang={lang} isRtl={isRtl} qc={qc} refetchReport={refetch} />}
          {activeTab === "trends" && <TrendsTab report={report} t={t} lang={lang} isRtl={isRtl} />}
        </>
      )}
    </div>
  );
}

function ScoreGauge({ score, t }: { score: number; t: any }) {
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const bg = score >= 80 ? "from-green-500/20 to-green-500/5" : score >= 50 ? "from-amber-500/20 to-amber-500/5" : "from-red-500/20 to-red-500/5";
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-6 text-center", bg)}>
      <div className={cn("text-5xl font-black", color)}>{score}</div>
      <p className="text-sm text-muted-foreground mt-1">{t("intel.score")}</p>
      <p className="text-xs text-muted-foreground/70">{t("intel.score.desc")}</p>
    </div>
  );
}

function KpiCard({ label, value, unit, icon: Icon, color }: { label: string; value: number | string; unit?: string; icon: any; color: string }) {
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold">{value}{unit ? <span className="text-xs text-muted-foreground ms-1">{unit}</span> : null}</p>
      </div>
    </div>
  );
}

function OverviewTab({ report, t, lang, isRtl }: { report: any; t: any; lang: string; isRtl: boolean }) {
  const { kpis, alerts, recommendations, predictions, anomalies } = report;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ScoreGauge score={report.score} t={t} />
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label={t("intel.kpi.avgProd")} value={kpis.avgProduction} unit={t("intel.kpi.avgProd.unit")} icon={Egg} color="bg-amber-500" />
          <KpiCard label={t("intel.kpi.feedEff")} value={kpis.feedEfficiency} unit={t("intel.kpi.feedEff.unit")} icon={Wheat} color="bg-emerald-500" />
          <KpiCard label={t("intel.kpi.mortality")} value={`${kpis.mortalityRate}%`} icon={Skull} color="bg-red-500" />
          <KpiCard label={t("intel.kpi.water")} value={kpis.waterPerBird} unit={t("intel.kpi.water.unit")} icon={Droplets} color="bg-blue-500" />
          <KpiCard label={t("intel.kpi.costEgg")} value={kpis.costPerEgg} unit={lang === "sv" ? "IQD" : "د.ع"} icon={Target} color="bg-purple-500" />
          <KpiCard label={t("intel.kpi.hatchRate")} value={`${kpis.hatchRate}%`} icon={Heart} color="bg-pink-500" />
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />{t("intel.alerts.title")}</h2>
          <div className="space-y-2">
            {alerts.map((a: any, i: number) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border p-4 flex items-start gap-3",
                  a.level === "critical" ? "bg-red-500/10 border-red-500/30" :
                  a.level === "warning" ? "bg-amber-500/10 border-amber-500/30" :
                  "bg-blue-500/10 border-blue-500/30"
                )}
              >
                {a.level === "critical" ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /> :
                 a.level === "warning" ? <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" /> :
                 <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
                <div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    a.level === "critical" ? "bg-red-500/20 text-red-400" :
                    a.level === "warning" ? "bg-amber-500/20 text-amber-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>
                    {t(`intel.alerts.${a.level}`)}
                  </span>
                  <p className="mt-1 text-sm">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-violet-400" />{t("intel.reco.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((r: any, i: number) => (
              <div key={i} className="bg-card rounded-xl border p-4">
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  r.priority === "high" ? "bg-red-500/15 text-red-400" :
                  r.priority === "medium" ? "bg-amber-500/15 text-amber-400" :
                  "bg-green-500/15 text-green-400"
                )}>
                  {t(`intel.reco.${r.priority}`)}
                </span>
                <p className="mt-2 text-sm font-medium">{r.action}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("intel.reco.reason")} {r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {predictions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" />{t("intel.pred.title")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {predictions.map((p: any, i: number) => (
              <div key={i} className="bg-card rounded-xl border p-4">
                <p className="text-sm font-medium mb-2">{p.metric}</p>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">{t("intel.pred.current")}: </span>
                    <span className="font-bold">{p.current}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.trend === "up" ? <TrendingUp className="w-4 h-4 text-green-400" /> :
                     p.trend === "down" ? <TrendingDown className="w-4 h-4 text-red-400" /> :
                     <Minus className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-xs">{t(`intel.pred.${p.trend}`)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{t("intel.pred.predicted")}: </span>
                    <span className="font-bold text-violet-400">{p.predicted}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p.confidence}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{t("intel.pred.confidence")}: {p.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5 text-orange-400" />{t("intel.anomaly.title")}</h2>
          <div className="space-y-2">
            {anomalies.map((a: any, i: number) => (
              <div key={i} className={cn(
                "rounded-xl border p-4",
                a.severity === "critical" ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"
              )}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{a.description}</span>
                  <span className="text-xs text-muted-foreground">{a.date}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{t("intel.anomaly.expected")} {a.expected}</span>
                  <span>{t("intel.anomaly.actual")} {a.actual}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendsTab({ report, t, lang, isRtl }: { report: any; t: any; lang: string; isRtl: boolean }) {
  const charts = [
    { key: "production", label: t("intel.chart.production"), data: report.trends.production, color: "#f59e0b", unit: t("intel.chart.egg") },
    { key: "feed", label: t("intel.chart.feed"), data: report.trends.feed, color: "#22c55e", unit: t("intel.chart.kg") },
    { key: "mortality", label: t("intel.chart.mortality"), data: report.trends.mortality, color: "#ef4444", unit: t("intel.chart.count") },
    { key: "environment", label: t("intel.chart.environment"), data: report.trends.environment, color: "#3b82f6", unit: t("intel.chart.temp") },
  ];

  return (
    <div className="space-y-6">
      {charts.map(chart => (
        <div key={chart.key} className="bg-card rounded-xl border p-5">
          <h3 className="font-bold text-sm mb-4">{chart.label}</h3>
          {chart.data.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("intel.nodata")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chart.data}>
                <defs>
                  <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chart.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} reversed={isRtl} />
                <YAxis tick={{ fontSize: 11 }} orientation={isRtl ? "right" : "left"} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(value: any) => [`${value} ${chart.unit}`, ""]}
                />
                <Area type="monotone" dataKey="value" stroke={chart.color} strokeWidth={2} fill={`url(#grad-${chart.key})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      ))}
    </div>
  );
}

function DataEntryTab({ t, lang, isRtl, qc, refetchReport }: { t: any; lang: string; isRtl: boolean; qc: any; refetchReport: () => void }) {
  const [activeForm, setActiveForm] = useState<"production" | "feed" | "environment" | "water" | "mortality">("production");
  const [saved, setSaved] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const mutation = useMutation({
    mutationFn: ({ endpoint, data }: { endpoint: string; data: any }) => postData(endpoint, data),
    onSuccess: () => {
      setSaved(activeForm);
      qc.invalidateQueries({ queryKey: ["intelligence"] });
      refetchReport();
      setTimeout(() => setSaved(""), 2500);
    },
  });

  const forms = [
    { id: "production" as const, label: t("intel.entry.production"), icon: Egg, color: "bg-amber-500/10 text-amber-400" },
    { id: "feed" as const, label: t("intel.entry.feed"), icon: Wheat, color: "bg-emerald-500/10 text-emerald-400" },
    { id: "environment" as const, label: t("intel.entry.environment"), icon: Thermometer, color: "bg-blue-500/10 text-blue-400" },
    { id: "water" as const, label: t("intel.entry.water"), icon: Droplets, color: "bg-cyan-500/10 text-cyan-400" },
    { id: "mortality" as const, label: t("intel.entry.mortality"), icon: Skull, color: "bg-red-500/10 text-red-400" },
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {};
    fd.forEach((v, k) => { if (v !== "") data[k] = v; });
    mutation.mutate({ endpoint: activeForm, data });
    e.currentTarget.reset();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2"><PlusCircle className="w-5 h-5 text-violet-400" />{t("intel.entry.title")}</h2>

      <div className="flex flex-wrap gap-2">
        {forms.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveForm(f.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
              activeForm === f.id ? "bg-violet-500/15 text-violet-400 border-violet-500/30" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <f.icon className="w-4 h-4" />
            {f.label}
          </button>
        ))}
      </div>

      {saved === activeForm && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm text-center font-medium">{t("intel.entry.saved")}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="date" label={t("intel.entry.date")} type="date" defaultValue={today} required />

          {activeForm === "production" && (
            <>
              <FormField name="eggsCollected" label={t("intel.entry.eggs")} type="number" required />
              <FormField name="eggsBroken" label={t("intel.entry.broken")} type="number" />
            </>
          )}

          {activeForm === "feed" && (
            <>
              <FormField name="feedType" label={t("intel.entry.feedType")} type="text" required />
              <FormField name="quantityKg" label={t("intel.entry.feedQty")} type="number" step="0.1" required />
              <FormField name="totalCost" label={t("intel.entry.feedCost")} type="number" />
            </>
          )}

          {activeForm === "environment" && (
            <>
              <FormField name="temperatureC" label={t("intel.entry.tempC")} type="number" step="0.1" required />
              <FormField name="humidityPct" label={t("intel.entry.humidity")} type="number" step="0.1" />
            </>
          )}

          {activeForm === "water" && (
            <>
              <FormField name="quantityLiters" label={t("intel.entry.waterQty")} type="number" step="0.1" required />
            </>
          )}

          {activeForm === "mortality" && (
            <>
              <FormField name="count" label={t("intel.entry.deathCount")} type="number" required />
              <FormField name="cause" label={t("intel.entry.cause")} type="text" />
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? "..." : t("intel.entry.saved").replace("✓ ", "")}
        </button>
      </form>
    </div>
  );
}

function FormField({ name, label, type, required, defaultValue, step }: {
  name: string; label: string; type: string; required?: boolean; defaultValue?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}{required && " *"}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      />
    </div>
  );
}
