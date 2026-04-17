/**
 * MobileBottomNav — Native-style bottom tab bar for mobile.
 * Shown only on mobile (md:hidden). Tabs filtered by user role.
 */
import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquareText, Bird, Wallet, Layers, Menu, Egg, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Tab {
  href: string;
  icon: React.ElementType;
  labelAr: string;
  labelSv: string;
  exact?: boolean;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { href: "/",            icon: LayoutDashboard,  labelAr: "الرئيسية",  labelSv: "Hem",       exact: true },
  { href: "/smart-input", icon: MessageSquareText, labelAr: "إدخال",     labelSv: "Inmatning"  },
  { href: "/flocks",      icon: Bird,              labelAr: "القطعان",   labelSv: "Flockar"    },
  { href: "/feed",        icon: Wheat,             labelAr: "العلف",     labelSv: "Foder"      },
  { href: "/finance",     icon: Wallet,            labelAr: "المالية",   labelSv: "Ekonomi",   adminOnly: true },
  { href: "/operations",  icon: Layers,            labelAr: "العمليات",  labelSv: "Drift"      },
];

interface Props {
  onMenuOpen: () => void;
}

export default function MobileBottomNav({ onMenuOpen }: Props) {
  const [location] = useLocation();
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const ar = lang === "ar";

  // Filter tabs based on role — workers don't see admin-only tabs
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin).slice(0, 5);

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
        {visibleTabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 relative",
                "transition-all duration-200 active:scale-95",
                "min-h-[44px] select-none touch-manipulation",
              )}
            >
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

        {/* More menu button */}
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] active:scale-95 transition-all duration-200 touch-manipulation"
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
