/**
 * MobileBottomNav — Native-style bottom tab bar for mobile.
 * Shown only on mobile (md:hidden). Provides instant access to the 5 most-used pages.
 * The hamburger menu in the top header remains for all other pages.
 */
import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquareText, Bird, Wallet, Layers, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Tab {
  href: string;
  icon: React.ElementType;
  labelAr: string;
  labelSv: string;
  exact?: boolean;
}

const TABS: Tab[] = [
  { href: "/",            icon: LayoutDashboard,  labelAr: "الرئيسية",  labelSv: "Hem",       exact: true },
  { href: "/smart-input", icon: MessageSquareText, labelAr: "إدخال",     labelSv: "Inmatning"  },
  { href: "/flocks",      icon: Bird,              labelAr: "القطعان",   labelSv: "Flockar"    },
  { href: "/finance",     icon: Wallet,            labelAr: "المالية",   labelSv: "Ekonomi"    },
  { href: "/operations",  icon: Layers,            labelAr: "العمليات",  labelSv: "Drift"      },
];

interface Props {
  onMenuOpen: () => void;
}

export default function MobileBottomNav({ onMenuOpen }: Props) {
  const [location] = useLocation();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const isActive = (tab: Tab) => {
    if (tab.exact) return location === tab.href;
    return location.startsWith(tab.href);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "bg-card/95 backdrop-blur-xl border-t border-border/60",
        "shadow-[0_-4px_24px_rgba(0,0,0,0.08)]",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-[60px]">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 relative",
                "transition-all duration-200 active:scale-95",
                "min-h-[44px] select-none",
              )}
            >
              {/* Active indicator pill */}
              {active && (
                <span className="absolute top-1.5 w-8 h-1 rounded-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 transition-all duration-200",
                  active ? "text-primary scale-110" : "text-muted-foreground/70"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors duration-200 leading-none",
                  active ? "text-primary" : "text-muted-foreground/60"
                )}
              >
                {ar ? tab.labelAr : tab.labelSv}
              </span>
            </Link>
          );
        })}

        {/* Menu button — opens sidebar for all other pages */}
        <button
          onClick={onMenuOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] active:scale-95 transition-all duration-200"
        >
          <Menu className="w-5 h-5 text-muted-foreground/70" />
          <span className="text-[10px] font-medium text-muted-foreground/60 leading-none">
            {ar ? "المزيد" : "Mer"}
          </span>
        </button>
      </div>
    </nav>
  );
}
