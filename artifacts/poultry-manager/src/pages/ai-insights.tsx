import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  analysis: string;
  dataSnapshot: any;
  generatedAt: string;
}

function MarkdownSection({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ") || line.startsWith("# ")) {
          const content = line.replace(/^#{1,2}\s/, "");
          return <h3 key={i} className="font-bold text-base text-foreground mt-4 mb-2 first:mt-0">{content}</h3>;
        }
        if (line.startsWith("### ")) {
          return <h4 key={i} className="font-semibold text-sm text-primary mt-3 mb-1">{line.replace("### ", "")}</h4>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-foreground">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="flex gap-2"><span className="text-primary mt-0.5 shrink-0">•</span><span>{line.slice(2)}</span></p>;
        }
        if (line.startsWith("1.") || /^\d+\./.test(line)) {
          const [num, ...rest] = line.split(". ");
          return (
            <p key={i} className="flex gap-2">
              <span className="text-primary font-bold shrink-0 min-w-[20px]">{num}.</span>
              <span>{rest.join(". ")}</span>
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-muted-foreground">{line}</p>;
      })}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AiInsights() {
  const { isAdmin } = useAuth();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showData, setShowData] = useState(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            تحليل الذكاء الاصطناعي
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">يحلل بيانات المزرعة والمذكرات لاقتراح حلول ذكية</p>
        </div>
        <Button onClick={analyze} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "جارٍ التحليل..." : result ? "تحليل مجدد" : "ابدأ التحليل"}
        </Button>
      </div>

      {!result && !loading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-5">
              <Brain className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-2">تحليل ذكي لبياناتك</h3>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              يقوم النظام بتحليل جميع بيانات المزرعة: الدجاجات، دورات التفقيس، المهام، الأهداف، والمذكرات اليومية — ثم يقدم لك رؤى وحلولاً عملية
            </p>
            <Button onClick={analyze} className="mt-6 gap-2" size="lg">
              <Sparkles className="w-5 h-5" />
              ابدأ التحليل الآن
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <Card><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-4" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-4/5 mb-2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-6 w-1/4 mb-4" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2 py-4">
            <RefreshCw className="w-4 h-4 animate-spin" />
            جارٍ تحليل بيانات المزرعة بالذكاء الاصطناعي...
          </div>
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            آخر تحليل: {new Date(result.generatedAt).toLocaleString("ar")}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="إجمالي الدجاجات" value={result.dataSnapshot.totalChickens} sub={`${result.dataSnapshot.totalFlocks} مجموعة`} />
            <StatCard label="نسبة الفقس" value={`${result.dataSnapshot.avgHatchRate}%`} sub="معدل التفقيس" />
            <StatCard label="المهام" value={`${result.dataSnapshot.taskStats?.completed}/${result.dataSnapshot.taskStats?.total}`} sub="مكتملة/إجمالي" />
            <StatCard label="الأهداف" value={`${result.dataSnapshot.goalStats?.completed}/${result.dataSnapshot.goalStats?.total}`} sub="مكتملة/إجمالي" />
          </div>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                تحليل الذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownSection text={result.analysis} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => setShowData(!showData)}
                className="w-full p-4 flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  البيانات المستخدمة في التحليل
                </span>
                {showData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showData && (
                <div className="px-4 pb-4">
                  <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-64 text-left dir-ltr">
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
