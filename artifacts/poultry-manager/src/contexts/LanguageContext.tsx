import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Lang, t as translate } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("app-lang");
      if (saved === "sv" || saved === "ar") return saved;
    } catch {}
    return "ar";
  });

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === "ar" ? "sv" : "ar";
      try { localStorage.setItem("app-lang", next); } catch {}
      return next;
    });
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
