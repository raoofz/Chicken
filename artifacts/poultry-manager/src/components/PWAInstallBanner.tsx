/**
 * PWAInstallBanner — شريط تثبيت التطبيق الذكي
 *
 * يظهر فقط عندما:
 * 1. التطبيق غير مثبّت بعد
 * 2. المتصفح يدعم BeforeInstallPromptEvent
 * 3. المستخدم لم يرفضه خلال الـ 7 أيام الماضية
 */
import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

export default function PWAInstallBanner() {
  const { canInstall, isInstalling, triggerInstall } = usePWAInstall();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canInstall) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const daysAgo = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysAgo < DISMISS_DAYS) return;
    }
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, [canInstall]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    const result = await triggerInstall();
    if (result === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className={cn(
        "fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-400",
        "rounded-2xl border border-amber-300/30 shadow-2xl shadow-black/40",
        "bg-gradient-to-br from-amber-700 to-amber-900 text-white",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <span className="text-xl">🐔</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight">
            {ar ? "ثبّت تطبيق مدير المزرعة" : "Installera Farm Manager"}
          </p>
          <p className="text-[11px] text-amber-200 mt-0.5 leading-relaxed">
            {ar
              ? "احصل على تجربة تطبيق أصلي — يعمل بدون إنترنت ويُحمَّل بسرعة"
              : "Snabbare, offline-kapabel, fullständig app-upplevelse"}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label={ar ? "إغلاق" : "Stäng"}
        >
          <X className="w-4 h-4 text-amber-300" />
        </button>
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={install}
          disabled={isInstalling}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-white text-amber-900 font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {isInstalling
            ? (ar ? "جاري التثبيت..." : "Installerar...")
            : (ar ? "تثبيت الآن" : "Installera nu")}
        </button>
        <button
          onClick={dismiss}
          className="px-4 h-10 rounded-xl bg-white/10 text-sm font-medium transition-all active:scale-[0.97] hover:bg-white/20"
        >
          {ar ? "لاحقاً" : "Senare"}
        </button>
      </div>
    </div>
  );
}
