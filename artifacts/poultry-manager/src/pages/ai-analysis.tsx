import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Send, ShieldAlert, Trash2, Loader2, Stethoscope,
  BookOpen, ChevronDown, ChevronUp, Sparkles, Bot, User,
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

export default function AiAnalysis() {
  const { isAdmin } = useAuth();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const isRtl = dir === "rtl";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [encyclopedia, setEncyclopedia] = useState<EncSection[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [encLoading, setEncLoading] = useState(false);
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
    try {
      await fetch("/api/ai/clear", { method: "POST", credentials: "include" });
    } catch {}
    setMessages([]);
  };

  const loadEncyclopedia = async () => {
    if (encyclopedia.length > 0) {
      setShowEncyclopedia(!showEncyclopedia);
      return;
    }
    setEncLoading(true);
    try {
      const res = await fetch("/api/ai/encyclopedia", { credentials: "include" });
      const data = await res.json();
      setEncyclopedia(data.sections);
      setShowEncyclopedia(true);
    } catch {
      toast({ title: "خطأ", description: "فشل تحميل الموسوعة", variant: "destructive" });
    } finally {
      setEncLoading(false);
    }
  };

  const askAboutTopic = (topic: string) => {
    setInput(`اشرح لي بالتفصيل عن: ${topic}`);
    setShowEncyclopedia(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const quickQuestions = [
    "ما هي درجة الحرارة المثالية للتفقيس؟",
    "كيف أعالج الكوكسيديا؟",
    "ما هو برنامج التحصينات؟",
    "حلل بيانات مزرعتي",
    "كيف أزيد نسبة الفقس؟",
    "ما هي علامات المرض؟",
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              الدكتور نصار
              <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">خبير دواجن</span>
            </h1>
            <p className="text-xs text-muted-foreground">مستشارك الشخصي في تربية الدجاج والتفقيس</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadEncyclopedia} className="gap-1.5 text-xs" disabled={encLoading}>
            {encLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
            الموسوعة
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
              محادثة جديدة
            </Button>
          )}
        </div>
      </div>

      {showEncyclopedia && (
        <Card className="mb-4 border-emerald-500/20 max-h-80 overflow-y-auto">
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              موسوعة الدواجن الشاملة
            </h3>
            <div className="space-y-2">
              {encyclopedia.map(section => (
                <div key={section.id} className="border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{section.icon}</span>
                      {section.title}
                    </span>
                    {expandedSection === section.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSection === section.id && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {section.topics.map((topic, i) => (
                        <button
                          key={i}
                          onClick={() => askAboutTopic(topic.title)}
                          className="w-full text-start p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
                        >
                          <p className="text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{topic.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{topic.summary}</p>
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

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
              <Stethoscope className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold mb-2">مرحباً! أنا الدكتور نصار 🐔</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
              خبير بيطري متخصص في الدواجن. اسألني أي سؤال عن التفقيس، التربية، الأمراض، التسمين، البيض، الذبح، أو أي شيء يخص مزرعتك!
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 100); }}
                  className="text-start text-xs p-3 rounded-xl border hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-200"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 mb-1" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={cn(
              "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted/60 border rounded-bl-md"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-1">
                  {formatContent(msg.content)}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className={cn(
                "text-[10px] mt-2 opacity-50",
                msg.role === "user" ? "text-primary-foreground" : "text-muted-foreground"
              )}>
                {new Date(msg.timestamp).toLocaleTimeString(isRtl ? "ar" : "sv", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted/60 border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">الدكتور نصار يحلل...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t pt-3 mt-auto">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="اسأل الدكتور نصار عن أي شيء يخص الدواجن..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500",
              "placeholder:text-muted-foreground/60 min-h-[44px] max-h-32"
            )}
            style={{ direction: isRtl ? "rtl" : "ltr" }}
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-60">
          الدكتور نصار مدعوم بالذكاء الاصطناعي — الإجابات استرشادية وليست بديلاً عن الاستشارة البيطرية المباشرة
        </p>
      </div>
    </div>
  );
}
