import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bird, Egg, CheckSquare, Target, BookOpen,
  Menu, X, LogOut, User, ShieldCheck, Shield, MessageCircle, Settings,
  Languages, BrainCircuit, FileText, FlaskConical, NotebookPen, Wallet, Microscope,
  Activity, Database, MessageSquareText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const WHATSAPP_GROUP_URL = "https://wa.me";

const NAV_KEYS = [
  { href: "/",            key: "nav.dashboard",   descKey: "nav.dashboard.desc",   icon: LayoutDashboard, adminOnly: false },
  { href: "/smart-input", key: "nav.smartInput",  descKey: "nav.smartInput.desc",  icon: MessageSquareText, adminOnly: false },
  { href: "/flocks",      key: "nav.flocks",       descKey: "nav.flocks.desc",      icon: Bird,            adminOnly: false },
  { href: "/hatching",    key: "nav.hatching",     descKey: "nav.hatching.desc",    icon: Egg,             adminOnly: false },
  { href: "/tasks",       key: "nav.tasks",        descKey: "nav.tasks.desc",       icon: CheckSquare,     adminOnly: false },
  { href: "/goals",       key: "nav.goals",        descKey: "nav.goals.desc",       icon: Target,          adminOnly: false },
  { href: "/notes",       key: "nav.notes",        descKey: "nav.notes.desc",       icon: NotebookPen,     adminOnly: false },
  { href: "/finance",     key: "nav.finance",      descKey: "nav.finance.desc",     icon: Wallet,          adminOnly: false },
  { href: "/analytics",   key: "nav.analytics",    descKey: "nav.analytics.desc",   icon: Activity,        adminOnly: false },
  { href: "/brain",       key: "nav.brain",        descKey: "nav.brain.desc",       icon: Database,        adminOnly: false },
  { href: "/farm-lab",    key: "nav.farmLab",      descKey: "nav.farmLab.desc",     icon: Microscope,      adminOnly: false },
  { href: "/ai/advanced", key: "nav.aiAdvanced",   descKey: "nav.aiAdvanced.desc",  icon: FlaskConical,    adminOnly: true  },
  { href: "/ai/precision",key: "nav.aiPrecision",  descKey: "nav.aiPrecision.desc", icon: BrainCircuit,    adminOnly: true  },
  { href: "/logs",        key: "nav.logs",         descKey: "nav.logs.desc",        icon: BookOpen,        adminOnly: false },
  { href: "/settings",    key: "nav.settings",     descKey: "nav.settings.desc",    icon: Settings,        adminOnly: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { t, dir, lang, toggleLang } = useLanguage();
  const { toast } = useToast();

  const isRtl = dir === "rtl";
  const visibleNav = NAV_KEYS.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    toast({ title: t("sidebar.loggedOut") });
  };

  return (
    <div className="min-h-screen bg-background flex" dir={dir}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 h-full z-30 w-64 flex flex-col transition-transform duration-300",
        "bg-[#1A1208]",
        isRtl ? "right-0 border-l border-white/8" : "left-0 border-r border-white/8",
        "md:translate-x-0 md:static md:z-auto",
        sidebarOpen
          ? "translate-x-0"
          : isRtl ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center px-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">{t("app.name")}</h1>
              <p className="text-xs text-white/50">{t("app.subtitle")}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={cn("md:hidden text-white/50 hover:text-white transition-colors p-1", isRtl ? "mr-auto" : "ml-auto") }>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/8 space-y-2">
          <div className={cn(
            "flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
            isAdmin ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
          )}>
            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            <span className="font-medium">{isAdmin ? t("role.admin.account") : t("role.worker.account")}</span>
          </div>

          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="font-medium">{t("lang.switch")}</span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, key, descKey, icon: Icon, adminOnly }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  setSidebarOpen(false);
                  if (active) {
                    window.dispatchEvent(new CustomEvent("nav-reset", { detail: href }));
                  }
                }}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-white/65 hover:bg-white/8 hover:text-white",
                  adminOnly && "border border-amber-500/20"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", active ? "text-white" : "text-white/50")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold leading-tight">{t(key)}</span>
                    {adminOnly && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded shrink-0">{t("role.admin.badge")}</span>
                    )}
                  </div>
                  <p className={cn(
                    "text-[10px] leading-tight mt-0.5 truncate",
                    active ? "text-white/70" : "text-white/35"
                  )}>{t(descKey)}</p>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/8 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40 truncate">{user?.username}</p>
            </div>
          </div>

          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-green-400/90 hover:text-green-400 hover:bg-green-500/10 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            {t("sidebar.whatsapp")}
          </a>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            {t("sidebar.logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 md:hidden sticky top-0 z-10 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-sm">{t("app.name")}</span>
          </div>
          <div className={cn("flex items-center gap-2", isRtl ? "mr-auto" : "ml-auto") }>
            <button onClick={toggleLang} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted">
              {t("lang.switch")}
            </button>
            <span className="text-xs text-muted-foreground">{user?.name}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
