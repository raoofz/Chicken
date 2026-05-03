/**
 * OfflineBanner — شريط الوضع غير المتصل
 * يظهر شريطاً خفيفاً في الأعلى عندما يكون المستخدم دون إنترنت
 */
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(t);
    }
    return;
  }, [isOnline, wasOffline]);

  if (isOnline && !showRestored) return null;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold",
        isOnline
          ? "bg-emerald-600 text-white animate-in slide-in-from-top-2"
          : "bg-slate-900 text-amber-300 animate-in slide-in-from-top-2",
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="w-3 h-3" />
          {ar ? "تمت استعادة الاتصال بالإنترنت" : "Anslutning återställd"}
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          {ar ? "أنت غير متصل — يتم عرض آخر البيانات المحفوظة" : "Offline — visar senast synkad data"}
        </>
      )}
    </div>
  );
}
