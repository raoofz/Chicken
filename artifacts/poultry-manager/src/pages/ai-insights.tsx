import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Sparkles, RefreshCw, TrendingUp, AlertTriangle,
  Lightbulb, Calendar, ChevronDown, ChevronUp,
  Thermometer, ShieldCheck, Target, Egg, Bird,
  Zap, DollarSign, Clock, CheckCircle2, AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  analysis: string;
  dataSnapshot: any;
  summary: any;
  generatedAt: string;
}

const SECTIONS = [
  { key: "🚨 تنبيهات عاجلة", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", title: "تنبيهات عاجلة" },
  { key: "🌡️ تحليل الفقاسة", icon: Thermometer, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", title: "تحليل الفقاسة" },
  { key: "🐔 تحليل القطعان", icon: Bird, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", title: "تحليل القطعان" },
  { key: "📊 تحليل الأداء العام", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", title: "الأداء العام" },
  { key: "🔮 توقعات الأسبوعين القادمين", icon: Sparkles, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", title: "التوقعات" },
  { key: "⚡ خطة العمل الفورية", icon: Zap, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", title: "خطة العمل" },
  { key: "💰 نصائح لزيادة الربحية", icon: DollarSign, color: "text-green-600", bg: "bg-green-50 border-green-200", title: "الربحية" },
  { key: "❤️ الصحة الوقائية", icon: ShieldCheck, color: "text-pink-600", bg: "bg-pink-50 border-pink-200", title: "الصحة الوقائية" },
];

function parseAnalysisSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split("\n");
  let currentKey = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const matchedSection = SECTIONS.find(s => line.startsWith(`## ${s.key}`));
    if (matchedSection) {
      if (currentKey) result[currentKey] = currentContent.join("\n").trim();
      currentKey = matchedSection.key;
      currentContent = [];
    } else if (currentKey) {
      currentContent.push(line);
    }
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
        if (line.match(/^[-*•]\s/)) {
          const content = line.replace(/^[-*•]\s/, "").replace(/\*\*(.*?)\*\*/g, "**$1**");
          const parts = content.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className="flex gap-2 items-start">
              <span className="text-primary mt-1 shrink-0">•</span>
              <span>
                {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
              </span>
            </p>
          );
        }
        if (/^\d+\./.test(line)) {
          const match = line.match(/^(\d+)\.\s*(.*)/);
          if (match) return (
            <p key={i} className="flex gap-2 items-start">
              <span className="bg-primary/15 text-primary font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs mt-0.5">{match[1]}</span>
              <span>{match[2]}</span>
            </p>
          );
        }
        return <p key={i} className="text-muted-foreground">{line}</p>;
      })}
    </div>
  );
}

function SectionCard({ sectionKey, content }: { sectionKey: string; content: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const def = SECTIONS.find(s => s.key === sectionKey);
  if (!def) return null;
  const Icon = def.icon;
  const isEmpty = !content.trim() || content.includes("لا تنبيهات");
  const isAlert = sectionKey === "🚨 تنبيهات عاجلة";

  return (
    <Card className={cn("border transition-all duration-200", def.bg, isAlert && !isEmpty && "ring-2 ring-red-300")}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <CardTitle className={cn("text-sm flex items-center justify-between", def.color)}>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {def.title}
            {isAlert && !isEmpty && (
              <Badge variant="destructive" className="text-xs">يحتاج انتباهاً</Badge>
            )}
            {isAlert && isEmpty && (
              <Badge className="text-xs bg-emerald-500 text-white">كل شيء بخير ✓</Badge>
            )}
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronUp className="w-4 h-4 opacity-50" />}
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0">
          <SectionContent text={content || "لا توجد بيانات كافية لهذا القسم."} />
        </CardContent>
      )}
    </Card>
  );
}

function StatBadge({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className={cn("rounded-xl p-4 text-center border", color)}>
      <Icon className="w-5 h-5 mx-auto mb-1.5 opacity-70" />
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

export default function AiInsights() {
  const { isAdmin } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">وصول مقيّد</h2>
        <p className="text-muted-foreground">هذه الصفحة متاحة للمديرين فقط</p>
      </div>
    );
  }

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في التحليل");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? "حدث خطأ أثناء التحليل");
    } finally {
      setLoading(false);
    }
  };

  const sections = result ? parseAnalysisSections(result.analysis) : {};

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            المستشار الذكي
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            تحليل شامل: الفقاسة · القطعان · المهام · الأهداف · المذكرات · التوقعات
          </p>
        </div>
        <Button onClick={analyze} disabled={loading} className="gap-2 shadow-md" size="lg">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? "جارٍ التحليل..." : result ? "تحديث التحليل" : "ابدأ التحليل الذكي"}
        </Button>
      </div>

      {/* Welcome card */}
      {!result && !loading && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-amber-50">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/12 flex items-center justify-center mb-6 ring-4 ring-primary/10">
              <Brain className="w-12 h-12 text-primary" />
            </div>
            <h3 className="font-bold text-2xl mb-3">مستشارك الذكي للمزرعة</h3>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-2">
              يحلل بيانات مزرعتك بالكامل: درجات الحرارة والرطوبة في الفقاسة، صحة القطعان، المهام المتأخرة، تقدم الأهداف، والمذكرات اليومية
            </p>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-6">
              ثم يعطيك <strong>تنبيهات عاجلة، توقعات دقيقة، وخطة عمل مرتّبة بالأولوية</strong>
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs">
              {["🌡️ تحليل الفقاسة", "🐔 صحة القطعان", "⚡ خطة عمل فورية", "🔮 توقعات الأسبوعين", "💰 نصائح الربحية", "❤️ وقاية الأمراض"].map(tag => (
                <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>
            <Button onClick={analyze} className="gap-2 shadow-lg" size="lg">
              <Sparkles className="w-5 h-5" />
              ابدأ التحليل الآن
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="text-center text-muted-foreground flex items-center justify-center gap-2 py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span className="font-medium">يحلل الذكاء الاصطناعي بياناتك بعمق...</span>
          </div>
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-4/5 mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium">فشل التحليل</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Meta info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              آخر تحليل: {new Date(result.generatedAt).toLocaleString("ar-SA")}
            </span>
            {result.summary?.urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {result.summary.urgentCount} أمر يحتاج انتباهاً
              </Badge>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBadge label="الدجاجات" value={result.summary?.totalChickens ?? 0} icon={Bird} color="bg-amber-50 border-amber-200 text-amber-700" />
            <StatBadge label="معدل الفقس" value={`${result.summary?.avgHatchRate ?? 0}%`} icon={Egg} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
            <StatBadge label="دورات نشطة" value={result.summary?.activeCyclesCount ?? 0} icon={Thermometer} color="bg-blue-50 border-blue-200 text-blue-700" />
            <StatBadge label="إنجاز المهام" value={result.summary?.tasksDone ?? "0/0"} icon={CheckCircle2} color="bg-purple-50 border-purple-200 text-purple-700" />
            <StatBadge label="الأهداف" value={result.summary?.goalsProgress ?? "0/0"} icon={Target} color="bg-pink-50 border-pink-200 text-pink-700" />
            <StatBadge label="أمور عاجلة" value={result.summary?.urgentCount ?? 0} icon={Zap} color={result.summary?.urgentCount > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"} />
          </div>

          {/* Section cards */}
          <div className="space-y-3">
            {SECTIONS.map(s => (
              <SectionCard
                key={s.key}
                sectionKey={s.key}
                content={sections[s.key] ?? ""}
              />
            ))}
          </div>

          {/* Raw data */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="w-full p-4 flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />البيانات المستخدمة في التحليل</span>
                {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRaw && (
                <div className="px-4 pb-4">
                  <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-72 text-left" dir="ltr">
                    {JSON.stringify(result.dataSnapshot, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
