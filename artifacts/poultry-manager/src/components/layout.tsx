import { Link, useLocation } from "wouter";
import { LayoutDashboard, Bird, Egg, ListTodo, Target, ActivitySquare, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "لوحة القيادة", icon: LayoutDashboard },
  { href: "/flocks", label: "القطعان", icon: Bird },
  { href: "/hatching", label: "دورات التفقيس", icon: Egg },
  { href: "/tasks", label: "المهام", icon: ListTodo },
  { href: "/goals", label: "الأهداف", icon: Target },
  { href: "/logs", label: "سجل النشاط", icon: ActivitySquare },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const NavLinks = () => (
    <div className="flex flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={`justify-start gap-3 w-full text-right ${
                isActive ? "bg-primary/10 text-primary hover:bg-primary/20 font-bold" : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setOpen(false)}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-l bg-card p-4 h-screen sticky top-0 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="bg-primary/20 p-2 rounded-lg text-primary">
            <Bird className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">مدير المزرعة</h1>
            <p className="text-xs text-muted-foreground">دفترك اليومي</p>
          </div>
        </div>
        <nav className="flex-1">
          <NavLinks />
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Bird className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-foreground">مدير المزرعة</h1>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-4 border-l">
              <div className="flex items-center gap-3 mb-8 px-2 mt-4">
                <div className="bg-primary/20 p-2 rounded-lg text-primary">
                  <Bird className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-foreground">مدير المزرعة</h1>
                </div>
              </div>
              <nav className="flex flex-col gap-2">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}