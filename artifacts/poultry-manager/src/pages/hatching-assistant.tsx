import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Egg, Sparkles, RefreshCw, Thermometer, ChevronDown, ChevronUp,
  MessageCircle, Send, Bot, ArrowLeft
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function GuideContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith("## ")) return <h3 key={i} className="font-bold text-lg text-primary mt-6 mb-2 flex items-center gap-2">{line.replace("## ", "")}</h3>;
        if (line.startsWith("### ")) return <h4 key={i} className="font-semibold text-base text-foreground mt-4 mb-1">{line.replace("### ", "")}</h4>;
        if (line.startsWith("| ")) {
          const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
          const isHeader = lines[i + 1]?.includes("---");
          const isSeparator = line.includes("---");
          if (isSeparator) return null;
          return (
            <div key={i} className={cn("grid gap-1 text-xs py-1.5 px-2 rounded", isHeader ? "bg-primary/10 font-bold" : "bg-muted/30 even:bg-muted/50")} style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
              {cells.map((cell, j) => <span key={j} className="truncate">{cell}</span>)}
            </div>
          );
        }
        if (line.match(/^[-*•]\s/)) {
          const content = line.replace(/^[-*•]\s/, "");
          const parts = content.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className="flex gap-2 items-start py-0.5">
              <span className="text-primary mt-1 shrink-0">•</span>
              <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{p}</strong> : p)}</span>
            </p>
          );
        }
        if (/^\d+\./.test(line)) {
          const match = line.match(/^(\d+)\.\s*(.*)/);
          if (match) {
            const parts = match[2].split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} className="flex gap-2 items-start py-0.5">
                <span className="bg-primary/15 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-xs mt-0.5">{match[1]}</span>
                <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{p}</strong> : p)}</span>
              </p>
            );
          }
        }
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold text-foreground mt-2">{line.slice(2, -2)}</p>;
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} className="text-muted-foreground">{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-foreground">{p}</strong> : p)}</p>;
      })}
    </div>
  );
}

export default function HatchingAssistant() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [followups, setFollowups] = useState<Array<{ q: string; a: string }>>([]);
  const [followupQ, setFollowupQ] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);

  const [form, setForm] = useState({
    machineType: "",
    machineModel: "",
    eggType: "chicken",
    eggCount: "",
    eggSource: "own",
    experience: "beginner",
    concerns: "",
  });

  const handleGenerate = async () => {
    if (!form.machineType.trim()) {
      toast({ title: t("hatchAssist.required"), variant: "destructive" });
      return;
    }
    setLoading(true);
    setGuide(null);
    setFollowups([]);
    try {
      const res = await fetch("/api/ai/hatching-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, lang }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuide(data.guide);
    } catch {
      toast({ title: t("hatchAssist.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFollowup = async () => {
    if (!followupQ.trim()) return;
    setFollowupLoading(true);
    const question = followupQ;
    setFollowupQ("");
    try {
      const res = await fetch("/api/ai/hatching-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question, context: guide?.slice(0, 2000), lang }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFollowups(prev => [...prev, { q: question, a: data.answer }]);
    } catch {
      toast({ title: t("hatchAssist.error"), variant: "destructive" });
    } finally {
      setFollowupLoading(false);
    }
  };

  if (guide) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Egg className="w-7 h-7 text-primary" />
              {t("hatchAssist.result.title")}
            </h1>
          </div>
          <Button variant="outline" onClick={() => { setGuide(null); setFollowups([]); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t("hatchAssist.newPlan")}
          </Button>
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <GuideContent text={guide} />
          </CardContent>
        </Card>

        {followups.length > 0 && (
          <div className="space-y-3">
            {followups.map((fu, i) => (
              <div key={i} className="space-y-2">
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{fu.q}</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Bot className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm leading-relaxed">
                      <GuideContent text={fu.a} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <Label className="text-sm font-semibold mb-2 block">{t("hatchAssist.followup")}</Label>
            <div className="flex gap-2">
              <Input
                value={followupQ}
                onChange={e => setFollowupQ(e.target.value)}
                placeholder={t("hatchAssist.followup.placeholder")}
                onKeyDown={e => e.key === "Enter" && !followupLoading && handleFollowup()}
                disabled={followupLoading}
                className="flex-1"
              />
              <Button onClick={handleFollowup} disabled={followupLoading || !followupQ.trim()} className="gap-2 shrink-0">
                {followupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {followupLoading ? t("hatchAssist.followup.sending") : t("hatchAssist.followup.send")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Egg className="w-7 h-7 text-primary" />
          {t("hatchAssist.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("hatchAssist.subtitle")}</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-amber-50/50">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/12 flex items-center justify-center mb-4 ring-4 ring-primary/10">
            <Egg className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-bold text-xl mb-2">{t("hatchAssist.welcome.title")}</h3>
          <p className="text-muted-foreground text-sm max-w-lg">{t("hatchAssist.welcome.desc")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Thermometer className="w-5 h-5 text-primary" />
            {lang === "ar" ? "معلومات التفقيس" : "Kläckningsinformation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.machineType")} *</Label>
              <Input
                value={form.machineType}
                onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}
                placeholder={t("hatchAssist.machineType.placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.machineModel")}</Label>
              <Input
                value={form.machineModel}
                onChange={e => setForm(f => ({ ...f, machineModel: e.target.value }))}
                placeholder={t("hatchAssist.machineModel.placeholder")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.eggType")}</Label>
              <Select value={form.eggType} onValueChange={v => setForm(f => ({ ...f, eggType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chicken">{t("hatchAssist.eggType.chicken")}</SelectItem>
                  <SelectItem value="broiler">{t("hatchAssist.eggType.broiler")}</SelectItem>
                  <SelectItem value="duck">{t("hatchAssist.eggType.duck")}</SelectItem>
                  <SelectItem value="quail">{t("hatchAssist.eggType.quail")}</SelectItem>
                  <SelectItem value="turkey">{t("hatchAssist.eggType.turkey")}</SelectItem>
                  <SelectItem value="goose">{t("hatchAssist.eggType.goose")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.eggCount")}</Label>
              <Input
                type="number"
                min={1}
                value={form.eggCount}
                onChange={e => setForm(f => ({ ...f, eggCount: e.target.value }))}
                placeholder={t("hatchAssist.eggCount.placeholder")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.eggSource")}</Label>
              <Select value={form.eggSource} onValueChange={v => setForm(f => ({ ...f, eggSource: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">{t("hatchAssist.eggSource.own")}</SelectItem>
                  <SelectItem value="market">{t("hatchAssist.eggSource.market")}</SelectItem>
                  <SelectItem value="online">{t("hatchAssist.eggSource.online")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">{t("hatchAssist.experience")}</Label>
              <Select value={form.experience} onValueChange={v => setForm(f => ({ ...f, experience: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">{t("hatchAssist.experience.beginner")}</SelectItem>
                  <SelectItem value="some">{t("hatchAssist.experience.some")}</SelectItem>
                  <SelectItem value="experienced">{t("hatchAssist.experience.experienced")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">{t("hatchAssist.concerns")}</Label>
            <Textarea
              value={form.concerns}
              onChange={e => setForm(f => ({ ...f, concerns: e.target.value }))}
              placeholder={t("hatchAssist.concerns.placeholder")}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2 h-12 text-base shadow-lg" size="lg">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? t("hatchAssist.generating") : t("hatchAssist.generate")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
