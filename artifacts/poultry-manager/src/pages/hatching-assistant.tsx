import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Egg, Sparkles, RefreshCw, Thermometer, MessageCircle, Send, Bot,
  ArrowLeft, AlertTriangle, Stethoscope, BookOpen, Droplets, Clock,
  Zap, ShieldAlert, Baby, Scale, GraduationCap
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
        if (line.startsWith("## ")) return (
          <h3 key={i} className="font-bold text-lg text-primary mt-6 mb-2 flex items-center gap-2 border-b border-primary/20 pb-2">
            {line.replace("## ", "")}
          </h3>
        );
        if (line.startsWith("### ")) return <h4 key={i} className="font-semibold text-base text-foreground mt-4 mb-1">{line.replace("### ", "")}</h4>;
        if (line.startsWith("| ")) {
          const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
          const isHeader = lines[i + 1]?.includes("---");
          const isSeparator = line.includes("---");
          if (isSeparator) return null;
          return (
            <div key={i} className={cn(
              "grid gap-1 text-xs py-2 px-3 rounded-md border",
              isHeader ? "bg-primary/10 font-bold border-primary/20" : "bg-muted/30 border-transparent odd:bg-muted/50"
            )} style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
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

const QUICK_PROBLEMS_AR = [
  { icon: Zap, label: "انقطعت الكهرباء", problem: "انقطعت الكهرباء عن الحاضنة" },
  { icon: Thermometer, label: "الحرارة مرتفعة", problem: "درجة الحرارة ارتفعت فجأة" },
  { icon: Droplets, label: "الرطوبة منخفضة", problem: "الرطوبة انخفضت كثيراً" },
  { icon: Egg, label: "البيض لم يفقس", problem: "وصلنا يوم 21 والبيض لم يفقس بعد" },
  { icon: ShieldAlert, label: "رائحة كريهة", problem: "هناك رائحة كريهة من إحدى البيضات" },
  { icon: Baby, label: "كتكوت عالق", problem: "الكتكوت ثقب القشرة لكن لا يستطيع الخروج" },
  { icon: AlertTriangle, label: "حلقة دموية", problem: "رأيت حلقة دموية عند الفحص بالشمعة" },
  { icon: Scale, label: "البيض لا يفقد وزن", problem: "البيض لا يفقد وزناً كافياً أثناء التحضين" },
];

const QUICK_PROBLEMS_SV = [
  { icon: Zap, label: "Strömavbrott", problem: "Strömmen gick i kläckmaskinen" },
  { icon: Thermometer, label: "Hög temperatur", problem: "Temperaturen steg plötsligt" },
  { icon: Droplets, label: "Låg fuktighet", problem: "Luftfuktigheten sjönk kraftigt" },
  { icon: Egg, label: "Ägg kläcktes inte", problem: "Vi nådde dag 21 och äggen har inte kläckts" },
  { icon: ShieldAlert, label: "Dålig lukt", problem: "Det luktar illa från ett ägg" },
  { icon: Baby, label: "Kyckling fast", problem: "Kycklingen har pickat hål men kan inte ta sig ut" },
  { icon: AlertTriangle, label: "Blodring", problem: "Jag såg en blodring vid genomlysning" },
  { icon: Scale, label: "Ingen viktförlust", problem: "Äggen förlorar inte tillräckligt med vikt" },
];

export default function HatchingAssistant() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [followups, setFollowups] = useState<Array<{ q: string; a: string }>>([]);
  const [followupQ, setFollowupQ] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("plan");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagProblem, setDiagProblem] = useState("");

  const [form, setForm] = useState({
    machineType: "",
    machineModel: "",
    eggType: "chicken",
    eggCount: "",
    eggSource: "own",
    experience: "beginner",
    concerns: "",
    currentDay: "",
    environmentTemp: "",
    environmentHumidity: "",
  });

  const isAr = lang === "ar";
  const quickProblems = isAr ? QUICK_PROBLEMS_AR : QUICK_PROBLEMS_SV;

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
        body: JSON.stringify({ question, context: guide?.slice(0, 3000), lang }),
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

  const handleDiagnose = async (problem: string) => {
    setDiagnosing(true);
    setDiagnosis(null);
    setDiagProblem(problem);
    try {
      const res = await fetch("/api/ai/hatching-diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problem,
          eggType: form.eggType,
          currentDay: form.currentDay,
          machineType: form.machineType,
          symptoms: "",
          lang,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiagnosis(data.diagnosis);
    } catch {
      toast({ title: t("hatchAssist.error"), variant: "destructive" });
    } finally {
      setDiagnosing(false);
    }
  };

  if (guide) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-primary" />
              {isAr ? "دكتور التفقيس — الدليل الكامل" : "Doktor Kläckning — Komplett guide"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isAr ? "دليل علمي مخصص بناءً على بياناتك" : "Vetenskaplig guide anpassad efter dina uppgifter"}
            </p>
          </div>
          <Button variant="outline" onClick={() => { setGuide(null); setFollowups([]); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t("hatchAssist.newPlan")}
          </Button>
        </div>

        <Card className="border-primary/20 shadow-lg">
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
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              {isAr ? "اسأل دكتور التفقيس" : "Fråga Doktor Kläckning"}
            </Label>
            <div className="flex gap-2">
              <Input
                value={followupQ}
                onChange={e => setFollowupQ(e.target.value)}
                placeholder={isAr ? "مثال: ماذا أفعل إذا انقطعت الكهرباء في اليوم 19؟" : "T.ex: Vad gör jag vid strömavbrott dag 19?"}
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
          <GraduationCap className="w-7 h-7 text-primary" />
          {isAr ? "دكتور التفقيس" : "Doktor Kläckning"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAr ? "مرجعك العلمي الشامل لتفقيس البيض — مدعوم بقاعدة معرفية ضخمة وذكاء اصطناعي" : "Din kompletta vetenskapliga referens för äggkläckning — med stor kunskapsbas och AI"}
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-amber-50/50 shadow-md">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/12 flex items-center justify-center mb-4 ring-4 ring-primary/10">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-bold text-xl mb-2">
            {isAr ? "خبير التفقيس بالذكاء الاصطناعي" : "AI-kläckningsexpert"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xl">
            {isAr
              ? "مبني على قاعدة معرفية علمية شاملة تغطي: تطور الجنين يوماً بيوم، معايير دقيقة لكل نوع بيض (دجاج، بط، سمّان، ديك رومي، إوز)، تشخيص أكثر من 20 مشكلة شائعة، رعاية ما بعد الفقس، وتغذية قطيع التربية"
              : "Byggd på en omfattande vetenskaplig kunskapsbas: embryoutveckling dag för dag, exakta parametrar för varje äggtyp (höns, anka, vaktel, kalkon, gås), diagnostik av 20+ vanliga problem, skötsel efter kläckning och utfodring av avelsflock"}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              { icon: BookOpen, label: isAr ? "11 فصلاً علمياً" : "11 vetenskapliga kapitel" },
              { icon: Stethoscope, label: isAr ? "تشخيص فوري" : "Omedelbar diagnos" },
              { icon: Clock, label: isAr ? "جدول 21 يوم" : "21-dagars schema" },
            ].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="plan" className="gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            {isAr ? "خطة تفقيس كاملة" : "Komplett kläckningsplan"}
          </TabsTrigger>
          <TabsTrigger value="diagnose" className="gap-2 text-sm">
            <Stethoscope className="w-4 h-4" />
            {isAr ? "تشخيص مشكلة" : "Diagnostisera problem"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Thermometer className="w-5 h-5 text-primary" />
                {isAr ? "معلومات التفقيس" : "Kläckningsinformation"}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border border-dashed border-primary/20">
                <div className="space-y-2">
                  <Label className="font-semibold text-primary flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {isAr ? "اليوم الحالي (اختياري)" : "Nuvarande dag (valfritt)"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={35}
                    value={form.currentDay}
                    onChange={e => setForm(f => ({ ...f, currentDay: e.target.value }))}
                    placeholder={isAr ? "مثال: 7" : "T.ex: 7"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-primary flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4" />
                    {isAr ? "حرارة الغرفة °م" : "Rumstemperatur °C"}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.environmentTemp}
                    onChange={e => setForm(f => ({ ...f, environmentTemp: e.target.value }))}
                    placeholder={isAr ? "مثال: 25" : "T.ex: 25"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-primary flex items-center gap-1.5">
                    <Droplets className="w-4 h-4" />
                    {isAr ? "رطوبة الغرفة %" : "Rumsfuktighet %"}
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.environmentHumidity}
                    onChange={e => setForm(f => ({ ...f, environmentHumidity: e.target.value }))}
                    placeholder={isAr ? "مثال: 50" : "T.ex: 50"}
                  />
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
                {loading
                  ? (isAr ? "دكتور التفقيس يحلل بياناتك... (30-60 ثانية)" : "Doktor Kläckning analyserar... (30-60 sek)")
                  : (isAr ? "أنشئ الدليل العلمي الكامل" : "Skapa komplett vetenskaplig guide")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnose" className="mt-4 space-y-4">
          <Card className="border-red-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-red-700">
                <Stethoscope className="w-5 h-5" />
                {isAr ? "تشخيص سريع — اضغط على مشكلتك" : "Snabbdiagnos — klicka på ditt problem"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickProblems.map((qp, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-auto py-3 px-3 flex flex-col items-center gap-2 text-center border-red-200 hover:bg-red-50 hover:border-red-300 transition-all"
                    onClick={() => handleDiagnose(qp.problem)}
                    disabled={diagnosing}
                  >
                    <qp.icon className="w-6 h-6 text-red-500" />
                    <span className="text-xs font-medium leading-tight">{qp.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {isAr ? "أو اكتب مشكلتك بالتفصيل" : "Eller beskriv ditt problem i detalj"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <Label className="font-semibold">{isAr ? "اليوم الحالي" : "Nuvarande dag"}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={35}
                    value={form.currentDay}
                    onChange={e => setForm(f => ({ ...f, currentDay: e.target.value }))}
                    placeholder={isAr ? "مثال: 19" : "T.ex: 19"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">{t("hatchAssist.machineType")}</Label>
                  <Input
                    value={form.machineType}
                    onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}
                    placeholder={t("hatchAssist.machineType.placeholder")}
                  />
                </div>
              </div>
              <Textarea
                value={diagProblem}
                onChange={e => setDiagProblem(e.target.value)}
                placeholder={isAr ? "اشرح المشكلة بالتفصيل... مثال: الحرارة ارتفعت إلى 39 درجة في اليوم 15 ولم أنتبه إلا بعد 3 ساعات" : "Beskriv problemet i detalj... T.ex: Temperaturen steg till 39°C dag 15 och jag märkte inte förrän efter 3 timmar"}
                rows={3}
                className="resize-none"
              />
              <Button
                onClick={() => diagProblem.trim() && handleDiagnose(diagProblem)}
                disabled={diagnosing || !diagProblem.trim()}
                className="w-full gap-2 h-11"
                variant="destructive"
              >
                {diagnosing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                {diagnosing
                  ? (isAr ? "جارٍ التشخيص..." : "Diagnostiserar...")
                  : (isAr ? "تشخيص المشكلة فوراً" : "Diagnostisera problemet nu")}
              </Button>
            </CardContent>
          </Card>

          {diagnosis && (
            <Card className="border-red-200 shadow-lg animate-in fade-in duration-300">
              <CardHeader className="bg-red-50/50 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Stethoscope className="w-5 h-5" />
                  {isAr ? "نتيجة التشخيص" : "Diagnosresultat"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <GuideContent text={diagnosis} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
