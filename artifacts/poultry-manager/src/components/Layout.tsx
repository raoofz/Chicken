import { Link, useLocation } from "wouter";
import { LayoutDashboard, Bird, Egg, CheckSquare, Target, BookOpen, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "لوحة المتابعة", icon: LayoutDashboard },
  { href: "/flocks", label: "القطعان", icon: Bird },
  { href: "/hatching", label: "التفقيس", icon: Egg },
  { href: "/tasks", label: "المهام اليومية", icon: CheckSquare },
  { href: "/goals", label: "الأهداف", icon: Target },
  { href: "/logs", label: "سجل النشاط", icon: BookOpen },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full z-30 w-64 bg-sidebar border-l border-sidebar-border flex flex-col transition-transform duration-300",
          "md:translate-x-0 md:static md:z-auto",
          sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Bird className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground text-sm leading-tight">مدير المزرعة</h1>
              <p className="text-xs text-muted-foreground">إدارة الدواجن والتفقيس</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-xs text-primary font-medium">المزرعة تعمل منذ</p>
            <p className="text-lg font-bold text-primary">4 أشهر</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="h-16 bg-card border-b border-border flex items-center px-4 gap-4 md:hidden sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Bird className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">مدير المزرعة</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-6xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
