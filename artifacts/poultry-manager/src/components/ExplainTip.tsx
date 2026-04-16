/**
 * ExplainTip — اضغط على ؟ لشرح مبسط
 * Tap "?" to get a simple explanation for any metric.
 */
import { useState, useEffect } from "react";
import { X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExplainTipProps {
  titleAr: string;
  titleSv: string;
  textAr: string;
  textSv: string;
  className?: string;
  size?: "xs" | "sm" | "md";
}

export function ExplainTip({ titleAr, titleSv, textAr, textSv, className, size = "xs" }: ExplainTipProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const iconSize = size === "md" ? "w-4 h-4" : size === "sm" ? "w-3.5 h-3.5" : "w-3 h-3";
  const btnSize = size === "md" ? "w-6 h-6" : size === "sm" ? "w-5 h-5" : "w-4 h-4";

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={ar ? "شرح" : "Förklaring"}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.stopPropagation(), setOpen(true))}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "bg-primary/10 text-primary hover:bg-primary/20",
          "transition-colors cursor-pointer shrink-0",
          btnSize, className
        )}
      >
        <HelpCircle className={iconSize} />
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setOpen(false)}
        >
          <div
            dir={ar ? "rtl" : "ltr"}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <p className="font-bold text-foreground text-sm">
                  {ar ? titleAr : titleSv}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ar ? textAr : textSv}
              </p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setOpen(false)}
                className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                {ar ? "فهمت ✓" : "Förstått ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
