import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Loader2, CalendarClock, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanSlot {
  time: string;
  icon: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "normal";
  source: "system" | "task" | "cycle" | "note";
}

interface DailyPlan {
  date: string;
  greeting: string;
  slots: PlanSlot[];
  riskLevel: "critical" | "high" | "medium" | "low";
  riskSummary: string;
  tip: string;
}

export default function DailyPlanPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedSlots, setCheckedSlots] = useState<Set<number>>(new Set());

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("ai.restricted")}</h2>
        <p className="text-muted-foreground">{t("ai.adminOnly")}</p>
      </div>
    );
  }

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/daily-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "فشل");
      }
      const data = await res.json();
      setPlan(data.plan);
      setCheckedSlots(new Set());
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  const toggleSlot = (idx: number) => {
    setCheckedSlots(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const riskColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-amber-500";
      default: return "bg-emerald-500";
    }
  };

  const riskLabel = (level: string) => {
    switch (level) {
      case "critical": return "حرج";
      case "high": return "مرتفع";
      case "medium": return "متوسط";
      default: return "منخفض";
    }
  };

  const priorityDot = (p: string) => {
    switch (p) {
      case "critical": return "bg-red-500";
      case "high": return "bg-amber-500";
      default: return "bg-blue-400";
    }
  };

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  const completedCount = checkedSlots.size;
  const totalSlots = plan?.slots.length ?? 0;
  const progress = totalSlots > 0 ? Math.round((completedCount / totalSlots) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">الخطة اليومية الذكية</h1>
            <p className="text-xs text-muted-foreground">جدول عملك من الصباح للمساء — مبني من بيانات مزرعتك</p>
          </div>
        </div>
        <Button
          onClick={fetchPlan}
          disabled={loading}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loading && !plan && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
            <p className="text-sm text-muted-foreground">جارٍ بناء خطتك اليومية...</p>
          </div>
        )}

        {plan && (
          <>
            <Card className="border-none shadow-sm bg-gradient-to-l from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold">{plan.greeting}</p>
                    <p className="text-xs text-muted-foreground mt-1">{plan.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{progress}%</div>
                      <div className="text-[10px] text-muted-foreground">{completedCount}/{totalSlots} مهمة</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Card className={cn("flex-1 border-none shadow-sm")}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full", riskColor(plan.riskLevel))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">مستوى الخطر: {riskLabel(plan.riskLevel)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{plan.riskSummary}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-3 flex items-start gap-2">
                <span className="text-lg">💡</span>
                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{plan.tip}</p>
              </CardContent>
            </Card>

            <div className="relative">
              <div className="absolute top-0 bottom-0 start-[39px] w-0.5 bg-border/60 z-0" />

              {plan.slots.map((slot, idx) => {
                const isChecked = checkedSlots.has(idx);
                const slotHour = parseInt(slot.time.split(":")[0]);
                const isPast = slotHour < currentHour;
                const isCurrent = slotHour === currentHour;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "relative flex items-start gap-3 py-2 px-1 rounded-xl transition-all cursor-pointer group",
                      isChecked && "opacity-50",
                      isCurrent && !isChecked && "bg-amber-50/80 dark:bg-amber-950/20",
                    )}
                    onClick={() => toggleSlot(idx)}
                  >
                    <div className="flex flex-col items-center z-10 shrink-0 w-[50px]">
                      <span className={cn(
                        "text-[11px] font-mono font-semibold",
                        isCurrent ? "text-amber-600" : isPast ? "text-muted-foreground/50" : "text-foreground"
                      )}>
                        {slot.time}
                      </span>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 transition-colors",
                        isChecked
                          ? "bg-emerald-500 border-emerald-500"
                          : cn("bg-background", priorityDot(slot.priority).replace("bg-", "border-"))
                      )}>
                        {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className={cn(
                      "flex-1 min-w-0 pb-3",
                      isChecked && "line-through decoration-muted-foreground/40"
                    )}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{slot.icon}</span>
                        <span className={cn(
                          "text-sm font-semibold",
                          slot.priority === "critical" && !isChecked && "text-red-700 dark:text-red-400"
                        )}>
                          {slot.title}
                        </span>
                        {slot.priority === "critical" && !isChecked && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                        {slot.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {completedCount === totalSlots && totalSlots > 0 && (
              <Card className="border-none shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">أحسنت! أنهيت كل مهام اليوم</p>
                  <p className="text-xs text-muted-foreground mt-1">لا تنسَ تسجيل ملاحظاتك اليومية قبل النوم.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
