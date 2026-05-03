import { useEffect, useState } from "react";
import { apiPath } from "@/lib/api";
import { WifiOff, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    document.title = ar ? "غير متصل — مدير المزرعة" : "Offline — Farm Manager";
  }, [ar]);

  const retry = async () => {
    setChecking(true);
    try {
      const r = await fetch(apiPath("/healthz"), { cache: "no-store" });
      if (r.ok) window.location.href = "/";
    } catch {
      // still offline
    }
    setChecking(false);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="text-center space-y-6 max-w-sm">
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center animate-pulse">
            <WifiOff className="w-10 h-10 text-slate-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm">
            🐔
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black mb-2">
            {ar ? "أنت غير متصل بالإنترنت" : "Du är offline"}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {ar
              ? "تحقق من اتصالك بالشبكة. سيتم عرض آخر البيانات المحفوظة."
              : "Kontrollera din nätverksanslutning. Senast synkad data visas."}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 text-sm text-slate-300">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <span>📦</span>
            {ar ? "البيانات المتاحة بدون إنترنت:" : "Tillgängligt offline:"}
          </p>
          <ul className="space-y-1 text-slate-400 text-xs">
            <li>✅ {ar ? "آخر بيانات القطعان" : "Senaste flock-data"}</li>
            <li>✅ {ar ? "آخر المعاملات المالية" : "Senaste transaktioner"}</li>
            <li>✅ {ar ? "المهام والأهداف" : "Uppgifter och mål"}</li>
            <li>⚠️ {ar ? "الذكاء الاصطناعي يتطلب إنترنت" : "AI kräver internet"}</li>
          </ul>
        </div>

        <Button
          onClick={retry}
          disabled={checking}
          className="w-full h-12 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl"
        >
          {checking ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {ar ? "إعادة المحاولة" : "Försök igen"}
        </Button>
      </div>
    </div>
  );
}
