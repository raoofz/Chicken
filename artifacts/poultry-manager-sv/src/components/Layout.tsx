import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bird, Egg, CheckSquare, Target, BookOpen,
  Menu, X, FileText, Brain, LogOut, User, ShieldCheck, Shield, MessageCircle, Settings,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/XXXXXXXXXX";

const NAV_ITEMS = [
  { href: "/", label: "Kontrollpanel", icon: LayoutDashboard, adminOnly: false },
  { href: "/flocks", label: "Flockar", icon: Bird, adminOnly: false },
  { href: "/hatching", label: "Kl\u00e4ckning", icon: Egg, adminOnly: false },
  { href: "/tasks", label: "Dagliga uppgifter", icon: CheckSquare, adminOnly: false },
  { href: "/goals", label: "M\u00e5l", icon: Target, adminOnly: false },
  { href: "/notes", label: "Anteckningar", icon: FileText, adminOnly: true },
  { href: "/logs", label: "Aktivitetslogg", icon: BookOpen, adminOnly: false },
  { href: "/ai", label: "Smart analys", icon: Brain, adminOnly: true },
  { href: "/settings", label: "Inst\u00e4llningar", icon: Settings, adminOnly: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { toast } = useToast();

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Du har loggats ut" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full z-30 w-64 flex flex-col transition-transform duration-300",
        "bg-[#1A1208] border-r border-white/8",
        "md:translate-x-0 md:static md:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center px-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">G\u00e5rdsf\u00f6rvaltare</h1>
              <p className="text-xs text-white/50">Fj\u00e4derf\u00e4hantering</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden text-white/50 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/8">
          <div className={cn(
            "flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
            isAdmin ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
          )}>
            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            <span className="font-medium">{isAdmin ? "Administrat\u00f6r" : "Arbetare"}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon, adminOnly }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-white/65 hover:bg-white/8 hover:text-white",
                  adminOnly && "border border-amber-500/20"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-white/50")} />
                <span>{label}</span>
                {adminOnly && (
                  <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Admin</span>
                )}
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
            WhatsApp-grupp
          </a>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logga ut
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
            <span className="font-bold text-sm">G\u00e5rdsf\u00f6rvaltare</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
