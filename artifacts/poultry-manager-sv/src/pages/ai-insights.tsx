import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, RefreshCw, TrendingUp, AlertTriangle, Calendar, ChevronDown, ChevronUp, Thermometer, ShieldCheck, Target, Egg, Bird, Zap, DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AnalysisResult { analysis: string; dataSnapshot: any; summary: any; generatedAt: string; }

const SECTIONS = [
  { key: "\ud83d\udea8 \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0639\u0627\u062c\u0644\u0629", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "Brådskande varningar" },
  { key: "\ud83d\udcc5 \u062e\u0637\u0629 \u0627\u0644\u063a\u062f \u2014 \u0645\u0627\u0630\u0627 \u062a\u0641\u0639\u0644 \u063a\u062f\u0627\u061f", icon: Clock, color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-300", title: "Morgondagens plan", highlight: true },
  { key: "\ud83d\udd04 \u0627\u0644\u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u0646\u0627\u062c\u062d\u0629 \u2014 \u0643\u0631\u0631 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0644\u0648\u0628!", icon: RefreshCw, color: "text-teal-700", bg: "bg-teal-50 border-teal-200", title: "Framg\u00e5ngsm\u00f6nster" },
  { key: "\ud83c\udf21\ufe0f \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0641\u0642\u0627\u0633\u0629", icon: Thermometer, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", title: "Kl\u00e4ckningsanalys" },
  { key: "\ud83d\udc14 \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0642\u0637\u0639\u0627\u0646", icon: Bird, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", title: "Flockanalys" },
  { key: "\ud83d\udcca \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0623\u062f\u0627\u0621 \u0627\u0644\u0639\u0627\u0645", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", title: "Allm\u00e4n prestation" },
  { key: "\ud83d\udd2e \u062a\u0648\u0642\u0639\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0627\u0644\u0642\u0627\u062f\u0645\u064a\u0646", icon: Sparkles, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", title: "Prognoser" },
  { key: "\u26a1 \u062e\u0637\u0629 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0641\u0648\u0631\u064a\u0629 (\u0623\u0648\u0644\u0648\u064a\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639)", icon: Zap, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", title: "Veckans plan" },
  { key: "\ud83d\udcb0 \u0646\u0635\u0627\u0626\u062d \u0644\u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0631\u0628\u062d\u064a\u0629", icon: DollarSign, color: "text-green-600", bg: "bg-green-50 border-green-200", title: "L\u00f6nsamhetstips" },
  { key: "\u2764\ufe0f \u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064a\u0629", icon: ShieldCheck, color: "text-pink-600", bg: "bg-pink-50 border-pink-200", title: "F\u00f6rebyggande h\u00e4lsa" },
];

function parseAnalysisSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split("\n");
  let currentKey = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const matchedSection = SECTIONS.find(s => line.startsWith(`## ${s.key}`));
    if (matchedSection) { if (currentKey) result[currentKey] = currentContent.join("\n").trim(); currentKey = matchedSection.key; currentContent = []; }
    else if (currentKey) { currentContent.push(line); }
  }
  if (currentKey) result[currentKey] = currentContent.join("\n").trim();
  return result;
}

function SectionContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith("### ")) return <h5 key={i} className="font-semibold text-foreground mt-3 mb-1">{line.replace("### ", "")}</h5>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold text-foreground">{line.slice(2, -2)}</p>;
        if (line.match(/^[-*\u2022]\s/)) {
          const content = line.replace(/^[-*\u2022]\s/, "").replace(/\*\*(.*?)\*\*/g, "**$1**");
          const parts = content.split(/\*\*(.*?)\*\*/g);
          return <p key={i} className="flex gap-2 items-start"><span className="text-primary mt-1 shrink-0">\u2022</span><span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span></p>;
        }
        if (/^\d+\./.test(line)) {
          const match = line.match(/^(\d+)\.\s*(.*)/);
          if (match) return <p key={i} className="flex gap-2 items-start"><span className="bg-primary/15 text-primary font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs mt-0.5">{match[1]}</span><span>{match[2]}</span></p>;
        }
        return <p key={i} className="text-muted-foreground">{line}</p>;
      })}
    </div>
  );
}

function SectionCard({ sectionKey, content }: { sectionKey: string; content: string }) {
  const def = SECTIONS.find(s => s.key === sectionKey);
  if (!def) return null;
  const isHighlight = (def as any).highlight;
  const [collapsed, setCollapsed] = useState(!isHighlight);
  const Icon = def.icon;
  const isEmpty = !content.trim();
  const isAlert = sectionKey.includes("\ud83d\udea8");

  return (
    <Card className={cn("border transition-all duration-200", def.bg, isAlert && !isEmpty && "ring-2 ring-red-300", isHighlight && "ring-2 ring-indigo-300 shadow-md")}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <CardTitle className={cn("text-sm flex items-center justify-between", def.color)}>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className={isHighlight ? "font-bold text-base" : ""}>{def.title}</span>
            {isHighlight && <Badge className="text-xs bg-indigo-600 text-white">H\u00f6gsta prioritet</Badge>}
            {isAlert && !isEmpty && <Badge variant="destructive" className="text-xs">Kr\u00e4ver uppm\u00e4rksamhet</Badge>}
            {isAlert && isEmpty && <Badge className="text-xs bg-emerald-500 text-white">Allt \u00e4r bra</Badge>}
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronUp className="w-4 h-4 opacity-50" />}
        </CardTitle>
      </CardHeader>
      {!collapsed && <CardContent className="pt-0"><SectionContent text={content || "Inte tillr\u00e4ckligt med data f\u00f6r detta avsnitt."} /></CardContent>}
    </Card>
  );
}

function StatBadge({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return <div className={cn("rounded-xl p-4 text-center border", color)}><Icon className="w-5 h-5 mx-auto mb-1.5 opacity-70" /><div className="text-xl font-bold">{value}</div><div className="text-xs mt-0.5 opacity-80">{label}</div></div>;
}

export default function AiInsights() {
  const { isAdmin } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  if (!isAdmin) {
    return <div className="flex flex-col items-center justify-center py-24 text-center"><AlertTriangle className="w-16 h-16 text-amber-500 mb-4" /><h2 className="text-xl font-bold mb-2">Begr\u00e4nsad \u00e5tkomst</h2><p className="text-muted-foreground">Denna sida \u00e4r endast tillg\u00e4nglig f\u00f6r administrat\u00f6rer</p></div>;
  }

  const analyze = async () => {
    setLoading(true); setError("");
    try { const res = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lang: "sv" }) }); if (!res.ok) throw new Error("Analysen misslyckades"); const data = await res.json(); setResult(data); }
    catch (err: any) { setError(err.message ?? "Ett fel uppstod under analysen"); }
    finally { setLoading(false); }
  };

  const sections = result ? parseAnalysisSections(result.analysis) : {};

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-7 h-7 text-primary" />Smart r\u00e5dgivare</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Omfattande analys: kl\u00e4ckning \u00b7 flockar \u00b7 uppgifter \u00b7 m\u00e5l \u00b7 anteckningar \u00b7 prognoser</p>
        </div>
        <Button onClick={analyze} disabled={loading} className="gap-2 shadow-md" size="lg">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? "Analyserar..." : result ? "Uppdatera analys" : "Starta smart analys"}
        </Button>
      </div>

      {!result && !loading && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-amber-50">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/12 flex items-center justify-center mb-6 ring-4 ring-primary/10"><Brain className="w-12 h-12 text-primary" /></div>
            <h3 className="font-bold text-2xl mb-3">Din smarta g\u00e5rdsr\u00e5dgivare</h3>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-2">Analyserar all g\u00e5rdsdata: temperatur och fuktighet i kl\u00e4ckmaskinen, flockh\u00e4lsa, f\u00f6rsenade uppgifter, m\u00e5lframsteg och dagliga anteckningar</p>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-6">Ger dig <strong>br\u00e5dskande varningar, exakta prognoser och en prioriterad handlingsplan</strong></p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs">
              {["Kl\u00e4ckningsanalys", "Flockh\u00e4lsa", "Handlingsplan", "2-veckorsprognos", "L\u00f6nsamhetstips", "F\u00f6rebyggande h\u00e4lsa"].map(tag => <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full">{tag}</span>)}
            </div>
            <Button onClick={analyze} className="gap-2 shadow-lg" size="lg"><Sparkles className="w-5 h-5" />Starta analys nu</Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="text-center text-muted-foreground flex items-center justify-center gap-2 py-4"><RefreshCw className="w-5 h-5 animate-spin text-primary" /><span className="font-medium">AI analyserar din data p\u00e5 djupet...</span></div>
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-5 w-1/3 mb-3" /><Skeleton className="h-3 w-full mb-2" /><Skeleton className="h-3 w-4/5 mb-2" /><Skeleton className="h-3 w-3/4" /></CardContent></Card>)}
        </div>
      )}

      {error && <Card className="border-destructive/40 bg-destructive/5"><CardContent className="p-5 flex items-center gap-3 text-destructive"><AlertCircle className="w-5 h-5 shrink-0" /><div><p className="font-medium">Analysen misslyckades</p><p className="text-sm opacity-80">{error}</p></div></CardContent></Card>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Senaste analys: {new Date(result.generatedAt).toLocaleString("sv-SE")}</span>
            {result.summary?.urgentCount > 0 && <Badge variant="destructive" className="text-xs">{result.summary.urgentCount} \u00e4renden kr\u00e4ver uppm\u00e4rksamhet</Badge>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBadge label="H\u00f6ns" value={result.summary?.totalChickens ?? 0} icon={Bird} color="bg-amber-50 border-amber-200 text-amber-700" />
            <StatBadge label="Kl\u00e4ckfrekvens" value={`${result.summary?.avgHatchRate ?? 0}%`} icon={Egg} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
            <StatBadge label="Aktiva cykler" value={result.summary?.activeCyclesCount ?? 0} icon={Thermometer} color="bg-blue-50 border-blue-200 text-blue-700" />
            <StatBadge label="Uppgifter" value={result.summary?.tasksDone ?? "0/0"} icon={CheckCircle2} color="bg-purple-50 border-purple-200 text-purple-700" />
            <StatBadge label="M\u00e5l" value={result.summary?.goalsProgress ?? "0/0"} icon={Target} color="bg-pink-50 border-pink-200 text-pink-700" />
            <StatBadge label="Br\u00e5dskande" value={result.summary?.urgentCount ?? 0} icon={Zap} color={result.summary?.urgentCount > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"} />
          </div>
          <div className="space-y-3">{SECTIONS.map(s => <SectionCard key={s.key} sectionKey={s.key} content={sections[s.key] ?? ""} />)}</div>
          <Card className="border-border/50"><CardContent className="p-0">
            <button onClick={() => setShowRaw(!showRaw)} className="w-full p-4 flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"><span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Data som anv\u00e4nds i analysen</span>{showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
            {showRaw && <div className="px-4 pb-4"><pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-72 text-left">{JSON.stringify(result.dataSnapshot, null, 2)}</pre></div>}
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
