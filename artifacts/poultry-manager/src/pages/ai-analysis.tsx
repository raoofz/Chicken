import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Send, ShieldAlert, Trash2, Loader2, Stethoscope,
  BookOpen, ChevronDown, ChevronUp, Sparkles, Bot, User,
  BarChart3, AlertTriangle, CheckCircle2, Info, Zap,
  ClipboardList, TrendingUp, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface EncSection {
  id: string;
  icon: string;
  title: string;
  topics: { title: string; summary: string }[];
}

interface FarmAnalysis {
  score: number;
  scoreLabel: string;
  alerts: { type: string; title: string; description: string }[];
  sections: { icon: string; title: string; items: { label: string; value: string; status: string }[] }[];
  duties: { priority: string; title: string; description: string }[];
  predictions: { title: string; description: string; confidence: string }[];
  errors: { title: string; description: string; solution: string }[];
  topPriority: string;
}

type TabType = "chat" | "analyze";

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const isRtl = dir === "rtl";

  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [encyclopedia, setEncyclopedia] = useState<EncSection[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [encLoading, setEncLoading] = useState(false);
  const [analysis, setAnalysis] = useState<FarmAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("ai.restricted")}</h2>
        <p className="text-muted-foreground">{t("ai.adminOnly")}</p>
      </div>
    );
  }

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, newChat: messages.length === 0 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "فشل الاتصال");
      }
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, timestamp: data.timestamp }]);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setMessages(prev => prev.slice(0, -1));
      setInput(msg);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = async () => {
    try { await fetch("/api/ai/clear", { method: "POST", credentials: "include" }); } catch {}
    setMessages([]);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze-farm", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "فشل"); }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadEncyclopedia = async () => {
    if (encyclopedia.length > 0) { setShowEncyclopedia(!showEncyclopedia); return; }
    setEncLoading(true);
    try {
      const res = await fetch("/api/ai/encyclopedia", { credentials: "include" });
      const data = await res.json();
      setEncyclopedia(data.sections);
      setShowEncyclopedia(true);
    } catch { toast({ title: "خطأ", description: "فشل تحميل الموسوعة", variant: "destructive" }); }
    finally { setEncLoading(false); }
  };

  const askAboutTopic = (topic: string) => {
    setInput(`اشرح لي بالتفصيل العلمي عن: ${topic}`);
    setShowEncyclopedia(false);
    setActiveTab("chat");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const quickQuestions = [
    "حلل مزرعتي بالكامل وأعطني تقرير شامل",
    "ما هي درجة الحرارة والرطوبة المثالية للتفقيس؟",
    "كيف أعالج الكوكسيديا بالجرعات الدقيقة؟",
    "ما هو برنامج التحصينات الكامل لدجاج اللحم؟",
    "كيف أزيد نسبة الفقس فوق 85%؟",
    "ما هي علامات المرض في الدجاج؟",
    "كيف أحسب معامل التحويل الغذائي؟",
    "ما هو بروتوكول الإقفال المتقدم؟",
  ];

  const formatContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="font-bold text-base mt-3 mb-1">{line.replace("### ", "")}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.replace("## ", "")}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="font-bold text-xl mt-4 mb-2">{line.replace("# ", "")}</h1>;
      if (line.startsWith("- ")) return <li key={i} className="mr-4 ml-4 list-disc">{line.replace("- ", "")}</li>;
      if (line.match(/^\d+\. /)) return <li key={i} className="mr-4 ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold mt-2">{line.replace(/\*\*/g, "")}</p>;
      if (line.startsWith("|")) return null;
      if (line.trim() === "") return <br key={i} />;
      const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-emerald-500 to-teal-600";
    if (score >= 60) return "from-amber-500 to-orange-600";
    return "from-red-500 to-rose-600";
  };

  const alertIcon = (type: string) => {
    switch (type) {
      case "danger": return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case "success": return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const alertBg = (type: string) => {
    switch (type) {
      case "danger": return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      case "warning": return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
      case "success": return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
      default: return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-amber-500 text-white";
      default: return "bg-blue-500 text-white";
    }
  };

  const priorityLabel = (p: string) => {
    switch (p) { case "urgent": return "عاجل"; case "high": return "مهم"; case "medium": return "متوسط"; default: return "عادي"; }
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "good": return "bg-emerald-500";
      case "warning": return "bg-amber-500";
      case "danger": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">أداة تحليل المزرعة الذكية</h1>
            <p className="text-xs text-muted-foreground">تحليل دوري للقطيع، التفقيس، المهام، الأهداف، والملاحظات</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-3 bg-muted/50 p-1 rounded-xl">
        <button onClick={() => setActiveTab("chat")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "chat" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <Bot className="w-4 h-4" /> المحادثة الذكية
        </button>
        <button onClick={() => setActiveTab("analyze")} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "analyze" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <BarChart3 className="w-4 h-4" /> تحليل المزرعة
        </button>
      </div>

      {activeTab === "analyze" ? (
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {!analysis && !analyzing && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <BarChart3 className="w-12 h-12 text-emerald-600" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-lg font-bold">تحليل شامل وقابل للتنفيذ</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  تقرأ الأداة كل البيانات المتاحة وتحوّلها إلى: مخاطر، أولويات، أخطاء محتملة، واجبات عملية، وتوقعات تشغيلية.
                </p>
              </div>
              <Button onClick={runAnalysis} size="lg" className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg">
                <Sparkles className="w-5 h-5" />
                ابدأ التحليل
              </Button>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center animate-pulse">
                <Stethoscope className="w-10 h-10 text-emerald-600" />
              </div>
              <p className="font-semibold text-lg">جارٍ تحليل بيانات المزرعة...</p>
              <p className="text-sm text-muted-foreground">يفحص الفقاسات، الدجاجات، المهام، الأهداف، والملاحظات</p>
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse" style={{ width: "65%" }} />
              </div>
            </div>
          )}

          {analysis && !analyzing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", getScoreBg(analysis.score))}>
                    <span className="text-2xl font-bold">{analysis.score}</span>
                  </div>
                  <div>
                    <p className={cn("text-lg font-bold", getScoreColor(analysis.score))}>{analysis.scoreLabel}</p>
                    <p className="text-xs text-muted-foreground">تقييم صحة المزرعة</p>
                  </div>
                </div>
                <Button onClick={runAnalysis} variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> إعادة التحليل
                </Button>
              </div>

              {analysis.topPriority && (
                <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardContent className="p-3 flex items-start gap-3">
                    <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">أهم إجراء الآن</p>
                      <p className="text-sm font-medium mt-0.5">{analysis.topPriority}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysis.alerts?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> التنبيهات ({analysis.alerts.length})</h3>
                  {analysis.alerts.map((a, i) => (
                    <div key={i} className={cn("border rounded-xl p-3 flex items-start gap-2.5", alertBg(a.type))}>
                      {alertIcon(a.type)}
                      <div>
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.errors?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4" /> أخطاء مكتشفة ({analysis.errors.length})</h3>
                  {analysis.errors.map((e, i) => (
                    <Card key={i} className="border-red-200 dark:border-red-800">
                      <CardContent className="p-3">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">{e.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-medium">الحل: {e.solution}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {analysis.duties?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-600" /> الواجبات ({analysis.duties.length})</h3>
                  {analysis.duties.map((d, i) => (
                    <div key={i} className="border rounded-xl p-3 flex items-start gap-2.5">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5", priorityColor(d.priority))}>{priorityLabel(d.priority)}</span>
                      <div>
                        <p className="text-sm font-semibold">{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.sections?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold">التحليل التفصيلي</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {analysis.sections.map((s, i) => (
                      <Card key={i}>
                        <CardContent className="p-3">
                          <p className="text-sm font-bold mb-2 flex items-center gap-1.5"><span>{s.icon}</span> {s.title}</p>
                          <div className="space-y-1.5">
                            {s.items?.map((item, j) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span className={cn("w-2 h-2 rounded-full", statusDot(item.status))} />
                                  {item.label}
                                </span>
                                <span className="font-medium">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {analysis.predictions?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-600" /> التوقعات</h3>
                  {analysis.predictions.map((p, i) => (
                    <Card key={i} className="border-purple-200/50 dark:border-purple-800/50">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{p.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                          </div>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0",
                            p.confidence === "high" ? "bg-emerald-100 text-emerald-700" :
                            p.confidence === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
                          )}>{p.confidence === "high" ? "ثقة عالية" : p.confidence === "medium" ? "ثقة متوسطة" : "تقدير"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={loadEncyclopedia} className="gap-1.5 text-xs" disabled={encLoading}>
              {encLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              الموسوعة
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> جديدة
              </Button>
            )}
          </div>

          {showEncyclopedia && (
            <Card className="mb-3 border-emerald-500/20 max-h-64 overflow-y-auto">
              <CardContent className="p-3">
                <h3 className="font-bold text-xs mb-2 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-emerald-600" /> موسوعة الدواجن (6000+ مرجع)</h3>
                <div className="space-y-1.5">
                  {encyclopedia.map(section => (
                    <div key={section.id} className="border rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)} className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/50 transition-colors">
                        <span className="flex items-center gap-2 text-xs font-medium"><span>{section.icon}</span>{section.title}</span>
                        {expandedSection === section.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {expandedSection === section.id && (
                        <div className="px-2.5 pb-2 space-y-1">
                          {section.topics.map((topic, i) => (
                            <button key={i} onClick={() => askAboutTopic(topic.title)} className="w-full text-start p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group">
                              <p className="text-xs font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{topic.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{topic.summary}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pb-3 min-h-0">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                  <Stethoscope className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-base font-bold mb-1">مرحباً! أنا الدكتور نصار 🐔🩺</h2>
                <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
                  خبير بيطري بـ 30 سنة خبرة ودرست 6000+ مرجع علمي.
                  اسألني أي سؤال عن الدواجن وسأحلل مزرعتك مع كل إجابة!
                </p>
                <div className="grid grid-cols-2 gap-1.5 max-w-md w-full">
                  {quickQuestions.map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 100); }}
                      className="text-start text-[11px] p-2.5 rounded-xl border hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all">
                      <Sparkles className="w-3 h-3 text-emerald-500 mb-0.5" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={cn("max-w-[85%] md:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/60 border rounded-bl-md")}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-0.5">{formatContent(msg.content)}</div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={cn("text-[10px] mt-1.5 opacity-50", msg.role === "user" ? "text-primary-foreground" : "text-muted-foreground")}>
                    {new Date(msg.timestamp).toLocaleTimeString(isRtl ? "ar" : "sv", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-muted/60 border rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-muted-foreground">الدكتور نصار يفكر...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t pt-2.5 mt-auto">
            <div className="flex gap-2 items-end">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="اسأل الدكتور نصار..."
                rows={1}
                className={cn("flex-1 resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500",
                  "placeholder:text-muted-foreground/60 min-h-[42px] max-h-28")}
                style={{ direction: isRtl ? "rtl" : "ltr" }}
                disabled={loading}
              />
              <Button onClick={sendMessage} disabled={!input.trim() || loading} size="icon"
                className="h-[42px] w-[42px] rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-1.5 opacity-50">
              الدكتور نصار — خبير 6000+ مرجع علمي | الإجابات استرشادية
            </p>
          </div>
        </>
      )}
    </div>
  );
}
