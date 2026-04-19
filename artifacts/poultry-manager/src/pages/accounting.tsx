import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Layers, Receipt, Sparkles, AlertTriangle, TrendingDown, CheckCircle2, Plus, Trash2, DollarSign, Wallet } from "lucide-react";

const fmtMoney = (n: number | null | undefined, locale = "ar-IQ") =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString(locale, { maximumFractionDigits: 0 });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : await res.json();
}

interface CostAnalysis {
  totalChickens: number; totalIncome: number; totalExpenses: number; netProfit: number;
  costPerChicken: number | null; feedCost: number; medicineCost: number;
  feedPctOfExpenses: number | null; feedCostPerChicken: number | null; medicineCostPerChicken: number | null;
  byBatch: Array<{ batchId:number; name:string; chickenCount:number; status:string; income:number; expenses:number; netProfit:number; costPerChicken:number|null; profitPerChicken:number|null; profitable:boolean }>;
  byCategory: Array<{ category: string; total: number; pct: number }>;
}
interface Batch { id:number; name:string; flockId:number|null; startDate:string; endDate:string|null; chickenCount:number; status:string; notes:string|null }
interface Invoice { id:number; customerName:string; totalAmount:string; paidAmount:string; remainingAmount:string; status:string; issueDate:string; dueDate:string|null; notes:string|null }
interface Payment { id:number; invoiceId:number; amount:string; date:string; method:string|null; notes:string|null }
interface Insight { id:string; severity:"low"|"medium"|"high"|"critical"; issue:string; cause:string; impact:string; recommendation:string }
interface InsightsResponse { generatedAt:string; summary:{totalIncome:number;totalExpenses:number;netProfit:number;feedPct:number}; insights: Insight[] }

const SEVERITY_STYLE: Record<string,{badge:string;icon:typeof AlertTriangle}> = {
  critical: { badge: "bg-red-600 text-white",     icon: AlertTriangle },
  high:     { badge: "bg-orange-500 text-white",  icon: TrendingDown },
  medium:   { badge: "bg-amber-400 text-amber-900", icon: AlertTriangle },
  low:      { badge: "bg-emerald-500 text-white", icon: CheckCircle2 },
};

export default function AccountingPage() {
  const { t, lang } = useTranslation();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const tab = new URLSearchParams(window.location.search).get("tab") ?? "overview";
  const [activeTab, setActiveTab] = useState(tab);

  return (
    <div className="space-y-6 p-4 md:p-6" dir={dir}>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("accounting.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("accounting.subtitle")}</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-1">
          <TabsTrigger value="overview">{t("accounting.tab.overview")}</TabsTrigger>
          <TabsTrigger value="costs">{t("accounting.tab.costs")}</TabsTrigger>
          <TabsTrigger value="batches">{t("accounting.tab.batches")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("accounting.tab.invoices")}</TabsTrigger>
          <TabsTrigger value="insights">{t("accounting.tab.insights")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="costs"    className="mt-4"><CostsTab /></TabsContent>
        <TabsContent value="batches"  className="mt-4"><BatchesTab /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab /></TabsContent>
        <TabsContent value="insights" className="mt-4"><InsightsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab() {
  const { t } = useTranslation();
  const { data: cost, isLoading } = useQuery<CostAnalysis>({
    queryKey: ["finance/cost-analysis"],
    queryFn: () => api("/api/finance/cost-analysis"),
  });
  const { data: daily } = useQuery<{days:number; series:Array<{date:string;income:number;expense:number;netProfit:number}>}>({
    queryKey: ["finance/daily-totals"],
    queryFn: () => api("/api/finance/daily-totals?days=30"),
  });

  if (isLoading || !cost) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  const profitColor = cost.netProfit >= 0 ? "text-emerald-600" : "text-red-600";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("accounting.kpi.income")}      value={fmtMoney(cost.totalIncome)}   icon={DollarSign} tone="emerald" />
        <Kpi label={t("accounting.kpi.expenses")}    value={fmtMoney(cost.totalExpenses)} icon={Wallet}     tone="red" />
        <Kpi label={t("accounting.kpi.netProfit")}   value={fmtMoney(cost.netProfit)}     icon={TrendingDown} tone={cost.netProfit>=0?"emerald":"red"} />
        <Kpi label={t("accounting.kpi.chickens")}    value={String(cost.totalChickens)}   icon={Layers}     tone="blue" />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("accounting.daily.title")}</CardTitle></CardHeader>
        <CardContent>
          {!daily || daily.series.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("accounting.daily.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr><th className="text-start py-1">{t("accounting.col.date")}</th>
                      <th className="text-end py-1">{t("accounting.col.income")}</th>
                      <th className="text-end py-1">{t("accounting.col.expense")}</th>
                      <th className="text-end py-1">{t("accounting.col.net")}</th></tr>
                </thead>
                <tbody>
                  {daily.series.slice().reverse().map(d => (
                    <tr key={d.date} className="border-t">
                      <td className="py-1">{d.date}</td>
                      <td className="py-1 text-end text-emerald-600">{fmtMoney(d.income)}</td>
                      <td className="py-1 text-end text-red-600">{fmtMoney(d.expense)}</td>
                      <td className={`py-1 text-end font-semibold ${d.netProfit>=0?"text-emerald-600":"text-red-600"}`}>{fmtMoney(d.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className={profitColor}>
          {cost.netProfit >= 0 ? t("accounting.bottomline.profit") : t("accounting.bottomline.loss")}: {fmtMoney(Math.abs(cost.netProfit))}
        </CardTitle></CardHeader>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "emerald"|"red"|"blue" }) {
  const toneCls = { emerald: "text-emerald-600 bg-emerald-50", red: "text-red-600 bg-red-50", blue: "text-blue-600 bg-blue-50" }[tone];
  return (
    <Card><CardContent className="p-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${toneCls}`}><Icon className="w-5 h-5" /></div>
      <div><div className="text-xs text-muted-foreground">{label}</div>
           <div className="text-lg font-bold">{value}</div></div>
    </CardContent></Card>
  );
}

// ── Cost Analysis ─────────────────────────────────────────────────────────────
function CostsTab() {
  const { t } = useTranslation();
  const { data: cost, isLoading } = useQuery<CostAnalysis>({
    queryKey: ["finance/cost-analysis"],
    queryFn: () => api("/api/finance/cost-analysis"),
  });
  if (isLoading || !cost) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("accounting.cost.perChicken")}      value={fmtMoney(cost.costPerChicken)} />
        <Stat label={t("accounting.cost.feedPerChicken")}  value={fmtMoney(cost.feedCostPerChicken)} />
        <Stat label={t("accounting.cost.medPerChicken")}   value={fmtMoney(cost.medicineCostPerChicken)} />
        <Stat label={t("accounting.cost.feedPct")}         value={cost.feedPctOfExpenses === null ? "—" : `${cost.feedPctOfExpenses.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("accounting.cost.byCategory")}</CardTitle></CardHeader>
        <CardContent>
          {cost.byCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("accounting.empty")}</p>
          ) : (
            <div className="space-y-2">
              {cost.byCategory.map(c => (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="w-32 text-sm">{c.category}</div>
                  <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${Math.min(100, c.pct)}%` }} />
                  </div>
                  <div className="w-24 text-end text-sm tabular-nums">{fmtMoney(c.total)}</div>
                  <div className="w-14 text-end text-xs text-muted-foreground">{c.pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("accounting.cost.byBatch")}</CardTitle></CardHeader>
        <CardContent>
          {cost.byBatch.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("accounting.batches.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr><th className="text-start py-1">{t("accounting.col.batch")}</th>
                      <th className="text-end py-1">{t("accounting.col.chickens")}</th>
                      <th className="text-end py-1">{t("accounting.col.income")}</th>
                      <th className="text-end py-1">{t("accounting.col.expense")}</th>
                      <th className="text-end py-1">{t("accounting.col.costPer")}</th>
                      <th className="text-end py-1">{t("accounting.col.net")}</th></tr>
                </thead>
                <tbody>
                  {cost.byBatch.map(b => (
                    <tr key={b.batchId} className="border-t">
                      <td className="py-1">{b.name} <Badge variant="outline" className="ms-1">{b.status}</Badge></td>
                      <td className="py-1 text-end">{b.chickenCount}</td>
                      <td className="py-1 text-end text-emerald-600">{fmtMoney(b.income)}</td>
                      <td className="py-1 text-end text-red-600">{fmtMoney(b.expenses)}</td>
                      <td className="py-1 text-end">{fmtMoney(b.costPerChicken)}</td>
                      <td className={`py-1 text-end font-semibold ${b.profitable?"text-emerald-600":"text-red-600"}`}>{fmtMoney(b.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-bold tabular-nums">{value}</div></CardContent></Card>;
}

// ── Batches ───────────────────────────────────────────────────────────────────
function BatchesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: batches = [] } = useQuery<Batch[]>({ queryKey: ["batches"], queryFn: () => api("/api/batches") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: new Date().toISOString().slice(0,10), chickenCount: "", status: "active", notes: "" });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["batches"] }); qc.invalidateQueries({ queryKey: ["finance/cost-analysis"] }); };

  const createMut = useMutation({
    mutationFn: () => api<Batch>("/api/batches", { method: "POST", body: JSON.stringify({ ...form, chickenCount: Number(form.chickenCount) }) }),
    onSuccess: () => { toast({ title: t("accounting.batch.created") }); setOpen(false); setForm({ name:"", startDate:new Date().toISOString().slice(0,10), chickenCount:"", status:"active", notes:"" }); refresh(); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id:number) => api(`/api/batches/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t("accounting.batches.title")}</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 me-1" />{t("accounting.batch.add")}</Button>
      </div>
      {batches.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("accounting.batches.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {batches.map(b => (
            <Card key={b.id}><CardContent className="p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{b.name} <Badge variant="outline" className="ms-2">{b.status}</Badge></div>
                <div className="text-xs text-muted-foreground">{b.startDate} • {b.chickenCount} {t("accounting.units.chicken")}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) delMut.mutate(b.id); }}>
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("accounting.batch.add")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t("accounting.batch.name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("accounting.batch.startDate")}</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>{t("accounting.batch.chickens")}</Label><Input type="number" min="1" value={form.chickenCount} onChange={e => setForm({ ...form, chickenCount: e.target.value })} /></div>
            </div>
            <div><Label>{t("accounting.batch.status")}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("accounting.batch.active")}</SelectItem>
                  <SelectItem value="closed">{t("accounting.batch.closed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.chickenCount || createMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Invoices ──────────────────────────────────────────────────────────────────
function InvoicesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: () => api("/api/invoices") });
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [form, setForm] = useState({ customerName: "", totalAmount: "", issueDate: new Date().toISOString().slice(0,10), dueDate: "", notes: "" });
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0,10), method: "cash", notes: "" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["invoices"] });

  const createMut = useMutation({
    mutationFn: () => api<Invoice>("/api/invoices", { method: "POST", body: JSON.stringify({ ...form, totalAmount: Number(form.totalAmount), dueDate: form.dueDate || null }) }),
    onSuccess: () => { toast({ title: t("accounting.invoice.created") }); setOpen(false); setForm({ customerName:"", totalAmount:"", issueDate:new Date().toISOString().slice(0,10), dueDate:"", notes:"" }); refresh(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({ mutationFn: (id:number) => api(`/api/invoices/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const payMut = useMutation({
    mutationFn: () => api(`/api/payments`, { method: "POST", body: JSON.stringify({ invoiceId: payOpen!.id, amount: Number(payForm.amount), date: payForm.date, method: payForm.method, notes: payForm.notes || null }) }),
    onSuccess: () => { toast({ title: t("accounting.payment.recorded") }); setPayOpen(null); setPayForm({ amount:"", date:new Date().toISOString().slice(0,10), method:"cash", notes:"" }); refresh(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => s === "paid" ? "bg-emerald-500" : s === "partial" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t("accounting.invoices.title")}</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 me-1" />{t("accounting.invoice.add")}</Button>
      </div>

      {invoices.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("accounting.invoices.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {invoices.map(inv => (
            <Card key={inv.id}><CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{inv.customerName}</span>
                    <Badge className={`${statusColor(inv.status)} text-white`}>{t(`accounting.status.${inv.status}`)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("accounting.invoice.total")}: {fmtMoney(Number(inv.totalAmount))} • {t("accounting.invoice.paid")}: {fmtMoney(Number(inv.paidAmount))} • {t("accounting.invoice.remaining")}: <strong>{fmtMoney(Number(inv.remainingAmount))}</strong>
                  </div>
                  <div className="text-xs text-muted-foreground">{inv.issueDate}{inv.dueDate ? ` → ${inv.dueDate}` : ""}</div>
                </div>
                <div className="flex gap-1">
                  {inv.status !== "paid" && (
                    <Button size="sm" variant="outline" onClick={() => setPayOpen(inv)}>{t("accounting.payment.add")}</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) delMut.mutate(inv.id); }}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("accounting.invoice.add")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t("accounting.invoice.customer")}</Label><Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("accounting.invoice.total")}</Label><Input type="number" min="0" step="0.01" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} /></div>
              <div><Label>{t("accounting.invoice.issueDate")}</Label><Input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} /></div>
            </div>
            <div><Label>{t("accounting.invoice.dueDate")}</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.customerName || !form.totalAmount || createMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={o => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("accounting.payment.title")}: {payOpen?.customerName}</DialogTitle></DialogHeader>
          {payOpen && (
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                {t("accounting.invoice.remaining")}: <strong>{fmtMoney(Number(payOpen.remainingAmount))}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t("accounting.payment.amount")}</Label><Input type="number" min="0.01" max={Number(payOpen.remainingAmount)} step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                <div><Label>{t("accounting.payment.date")}</Label><Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
              </div>
              <div><Label>{t("accounting.payment.method")}</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("accounting.payment.cash")}</SelectItem>
                    <SelectItem value="bank">{t("accounting.payment.bank")}</SelectItem>
                    <SelectItem value="other">{t("accounting.payment.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.notes")}</Label><Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => payMut.mutate()} disabled={!payForm.amount || payMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────
function InsightsTab() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, isFetching } = useQuery<InsightsResponse>({
    queryKey: ["finance/insights"],
    queryFn: () => api("/api/finance/insights"),
  });

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{t("accounting.insights.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("accounting.insights.subtitle")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>{t("common.refresh")}</Button>
      </div>

      {data.insights.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("accounting.insights.empty")}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.insights.map(ins => {
            const sty = SEVERITY_STYLE[ins.severity];
            const Icon = sty.icon;
            return (
              <Card key={ins.id}><CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${sty.badge}`}><Icon className="w-4 h-4" /></div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={sty.badge}>{t(`accounting.severity.${ins.severity}`)}</Badge>
                      <h4 className="font-semibold">{ins.issue}</h4>
                    </div>
                    <Field label={t("accounting.insight.cause")}          text={ins.cause} />
                    <Field label={t("accounting.insight.impact")}         text={ins.impact} />
                    <Field label={t("accounting.insight.recommendation")} text={ins.recommendation} highlight />
                  </div>
                </div>
              </CardContent></Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Field({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "bg-primary/5 border-s-4 border-primary p-2 rounded" : ""}>
      <span className="text-xs font-semibold text-muted-foreground">{label}: </span>
      <span className="text-sm">{text}</span>
    </div>
  );
}
