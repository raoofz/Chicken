import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bird, Egg, CheckCircle2, Target, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Översikt</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16 mb-1" /><Skeleton className="h-3 w-32" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const STATS = [
    { title: "Antal höns", value: summary.totalChickens, sub: `${summary.totalFlocks} flockar`, icon: Bird, color: "text-amber-600", bg: "bg-amber-100", href: "/flocks" },
    { title: "Ägg i kläckmaskin", value: summary.totalEggsIncubating, sub: `${summary.activeHatchingCycles} aktiva cykler`, icon: Egg, color: "text-emerald-600", bg: "bg-emerald-100", href: "/hatching" },
    { title: "Dagens uppgifter", value: `${summary.tasksCompletedToday} / ${summary.tasksDueToday}`, sub: "klara", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100", href: "/tasks" },
    { title: "Kläckningsgrad", value: `${Math.round(summary.overallHatchRate)}%`, sub: "genomsnitt", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", href: "/hatching" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Välkommen till din gård</h1>
        <p className="text-muted-foreground">Översikt av flockar, kläckning och dagliga uppgifter.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={i} href={stat.href}>
              <Card className="border-border/50 shadow-sm hover-elevate transition-all duration-300 relative overflow-hidden group cursor-pointer hover:shadow-md hover:border-primary/30">
                <div className="absolute right-0 top-0 w-1 h-full bg-primary/20 group-hover:bg-primary/60 transition-colors"></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-full ${stat.bg} ${stat.color}`}><Icon className="h-4 w-4" /></div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/0 group-hover:text-primary/60 transition-all duration-200 translate-x-1 group-hover:translate-x-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Link href="/goals">
          <Card className="border-border/50 shadow-sm cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-300 group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Mål</CardTitle>
              <CardDescription>Framsteg mot uppsatta mål</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                <div>
                  <p className="font-medium text-foreground">Uppnådda mål</p>
                  <p className="text-sm text-muted-foreground">{summary.goalsCompleted} av {summary.totalGoals} mål</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-primary">{summary.totalGoals > 0 ? Math.round((summary.goalsCompleted / summary.totalGoals) * 100) : 0}%</div>
                  <ArrowRight className="w-4 h-4 text-primary/0 group-hover:text-primary transition-all duration-200" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/hatching">
          <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20 flex flex-col items-center justify-center min-h-[200px] text-center p-6 cursor-pointer hover:shadow-md hover:bg-primary/10 transition-all duration-300 group">
            <Egg className="w-12 h-12 text-primary/40 mb-4 group-hover:text-primary/60 transition-colors" />
            <h3 className="font-semibold text-primary mb-2">Kläckningscykler</h3>
            <p className="text-sm text-primary/70">Se alla kläckningsomgångar och detaljer</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-primary/60 group-hover:text-primary transition-colors">
              <span>Visa kläckning</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
