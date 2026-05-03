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
import { useLanguage as useTranslation } from "@/contexts/LanguageContext";
import { Layers, Receipt, Sparkles, AlertTriangle, TrendingDown, CheckCircle2, Plus, Trash2, DollarSign, Wallet, Package, ShoppingCart, Egg, Pill, Wheat } from "lucide-react";

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
interface ReceivablesSummary {
  totalOutstanding: number;
  overdueAmount: number;
  unpaidCount: number;
  partialCount: number;
  overdueCount: number;
}
interface Batch { id:number; name:string; flockId:number|null; startDate:string; endDate:string|null; chickenCount:number; status:string; notes:string|null }
interface Invoice { id:number; customerName:string; totalAmount:string; paidAmount:string; remainingAmount:string; status:string; issueDate:string; dueDate:string|null; notes:string|null }
interface Payment { id:number; invoiceId:number; amount:string; date:string; method:string|null; notes:string|null }
interface Insight { id:string; severity:"low"|"medium"|"high"|"critical"; issue:string; cause:string; impact:string; recommendation:string }
interface InsightsResponse { generatedAt:string; summary:{totalIncome:number;totalExpenses:number;netProfit:number;feedPct:number}; insights: Insight[] }
interface InventoryItem { id:number; sku:string|null; name:string; category:"feed"|"medicine"|"equipment"|"other"; unit:string; quantityOnHand:string; unitCost:string; reorderLevel:string; notes:string|null }
interface InventoryMovement { id:number; itemId:number; type:"in"|"out"|"adjustment"; quantity:string; unitCost:string|null; totalCost:string|null; date:string; batchId:number|null; transactionId:number|null; referenceType:string|null; notes:string|null }

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
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-1">
          <TabsTrigger value="overview">{t("accounting.tab.overview")}</TabsTrigger>
          <TabsTrigger value="costs">{t("accounting.tab.costs")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("accounting.tab.inventory")}</TabsTrigger>
          <TabsTrigger value="batches">{t("accounting.tab.batches")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("accounting.tab.invoices")}</TabsTrigger>
          <TabsTrigger value="insights">{t("accounting.tab.insights")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"  className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="costs"     className="mt-4"><CostsTab /></TabsContent>
        <TabsContent value="inventory" className="mt-4"><InventoryTab /></TabsContent>
        <TabsContent value="batches"   className="mt-4"><BatchesTab /></TabsContent>
        <TabsContent value="invoices"  className="mt-4"><InvoicesTab /></TabsContent>
        <TabsContent value="insights"  className="mt-4"><InsightsTab /></TabsContent>
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
  const { data: receivables } = useQuery<ReceivablesSummary>({
    queryKey: ["finance/receivables-summary"],
    queryFn: () => api("/api/finance/receivables-summary"),
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
      {receivables && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("accounting.receivables.outstanding")} value={fmtMoney(receivables.totalOutstanding)} icon={Receipt} tone={receivables.totalOutstanding > 0 ? "amber" : "emerald"} />
          <Kpi label={t("accounting.receivables.overdue")} value={fmtMoney(receivables.overdueAmount)} icon={AlertTriangle} tone={receivables.overdueAmount > 0 ? "red" : "emerald"} />
          <Kpi label={t("accounting.receivables.unpaid")} value={String(receivables.unpaidCount)} icon={Receipt} tone="blue" />
          <Kpi label={t("accounting.receivables.partial")} value={String(receivables.partialCount)} icon={Wallet} tone="amber" />
        </div>
      )}

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

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "emerald"|"red"|"blue"|"amber" }) {
  const toneCls = { emerald: "text-emerald-600 bg-emerald-50", red: "text-red-600 bg-red-50", blue: "text-blue-600 bg-blue-50", amber: "text-amber-600 bg-amber-50" }[tone];
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
  const { data: receivables } = useQuery<ReceivablesSummary>({ queryKey: ["finance/receivables-summary"], queryFn: () => api("/api/finance/receivables-summary") });
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Invoice | null>(null);
  const [form, setForm] = useState({ customerName: "", totalAmount: "", issueDate: new Date().toISOString().slice(0,10), dueDate: "", notes: "" });
  const [payForm, setPayForm] = useState({ amount: "", date: new Date().toISOString().slice(0,10), method: "cash", notes: "" });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["finance/receivables-summary"] });
    qc.invalidateQueries({ queryKey: ["finance/insights"] });
    qc.invalidateQueries({ queryKey: ["finance/cost-analysis"] });
  };

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
      {receivables && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={t("accounting.receivables.outstanding")} value={fmtMoney(receivables.totalOutstanding)} icon={Receipt} tone={receivables.totalOutstanding > 0 ? "amber" : "emerald"} />
          <Kpi label={t("accounting.receivables.overdue")} value={fmtMoney(receivables.overdueAmount)} icon={AlertTriangle} tone={receivables.overdueAmount > 0 ? "red" : "emerald"} />
          <Kpi label={t("accounting.receivables.unpaid")} value={String(receivables.unpaidCount)} icon={Receipt} tone="blue" />
          <Kpi label={t("accounting.receivables.partial")} value={String(receivables.partialCount)} icon={Wallet} tone="amber" />
        </div>
      )}

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

// ── Inventory & Operations ───────────────────────────────────────────────────
function InventoryTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = () => new Date().toISOString().slice(0, 10);

  const { data: items = [] }     = useQuery<InventoryItem[]>({ queryKey: ["inv/items"],     queryFn: () => api("/api/inventory/items") });
  const { data: movements = [] } = useQuery<InventoryMovement[]>({ queryKey: ["inv/movements"], queryFn: () => api("/api/inventory/movements") });
  const { data: batches = [] }   = useQuery<Batch[]>({ queryKey: ["batches"],     queryFn: () => api("/api/batches") });
  const { data: invoices = [] }  = useQuery<Invoice[]>({ queryKey: ["invoices"],  queryFn: () => api("/api/invoices") });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inv/items"] });
    qc.invalidateQueries({ queryKey: ["inv/movements"] });
    qc.invalidateQueries({ queryKey: ["finance/cost-analysis"] });
    qc.invalidateQueries({ queryKey: ["finance/daily-totals"] });
    qc.invalidateQueries({ queryKey: ["finance/insights"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  // Dialogs
  const [itemOpen, setItemOpen]     = useState(false);
  const [purchaseOf, setPurchaseOf] = useState<InventoryItem | null>(null);
  const [useOf, setUseOf]           = useState<InventoryItem | null>(null);
  const [eggOpen, setEggOpen]       = useState(false);

  const [itemForm, setItemForm] = useState({ name:"", category:"feed", unit:"kg", quantityOnHand:"0", unitCost:"0", reorderLevel:"0" });
  const addItemMut = useMutation({
    mutationFn: () => api<InventoryItem>("/api/inventory/items", { method:"POST", body: JSON.stringify({ ...itemForm, quantityOnHand:Number(itemForm.quantityOnHand), unitCost:Number(itemForm.unitCost), reorderLevel:Number(itemForm.reorderLevel) }) }),
    onSuccess: () => { toast({ title: t("accounting.op.success") }); setItemOpen(false); setItemForm({ name:"", category:"feed", unit:"kg", quantityOnHand:"0", unitCost:"0", reorderLevel:"0" }); refresh(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });
  const delItemMut = useMutation({ mutationFn: (id:number) => api(`/api/inventory/items/${id}`, { method:"DELETE" }), onSuccess: refresh });

  const lowStock = (it: InventoryItem) =>
    Number(it.reorderLevel) > 0 && Number(it.quantityOnHand) <= Number(it.reorderLevel);

  const catLabel = (c: string) => t(`accounting.inv.cat.${c}`);
  const catIcon = (c: string) => c === "feed" ? Wheat : c === "medicine" ? Pill : Package;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-primary" />{t("accounting.inv.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("accounting.inv.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setEggOpen(true)}><Egg className="w-4 h-4 me-1" />{t("accounting.inv.actions.eggSale")}</Button>
          <Button size="sm" onClick={() => setItemOpen(true)}><Plus className="w-4 h-4 me-1" />{t("accounting.inv.addItem")}</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t("accounting.inv.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {items.map(it => {
            const Icon = catIcon(it.category);
            const low = lowStock(it);
            return (
              <Card key={it.id}><CardContent className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{it.name}</span>
                      <Badge variant="outline">{catLabel(it.category)}</Badge>
                      {low && <Badge className="bg-amber-500 text-white">{t("accounting.inv.lowStock")}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {t("accounting.inv.qtyOnHand")}: <strong>{Number(it.quantityOnHand)} {it.unit}</strong> •{" "}
                      {t("accounting.inv.unitCost")}: {fmtMoney(Number(it.unitCost))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setPurchaseOf(it)}>
                      <ShoppingCart className="w-4 h-4 me-1" />{t("accounting.inv.actions.purchase")}
                    </Button>
                    {(it.category === "feed" || it.category === "medicine") && (
                      <Button size="sm" variant="outline" onClick={() => setUseOf(it)}>
                        {it.category === "feed"
                          ? <><Wheat className="w-4 h-4 me-1" />{t("accounting.inv.actions.useFeed")}</>
                          : <><Pill  className="w-4 h-4 me-1" />{t("accounting.inv.actions.useMed")}</>}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) delItemMut.mutate(it.id); }}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent></Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("accounting.movements.title")}</CardTitle></CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("accounting.movements.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr><th className="text-start py-1">{t("accounting.col.date")}</th>
                      <th className="text-start py-1">{t("accounting.inv.itemName")}</th>
                      <th className="text-start py-1">—</th>
                      <th className="text-end py-1">{t("accounting.op.qty")}</th>
                      <th className="text-end py-1">{t("accounting.invoice.total")}</th></tr>
                </thead>
                <tbody>
                  {movements.slice(0, 30).map(m => {
                    const item = items.find(i => i.id === m.itemId);
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="py-1">{m.date}</td>
                        <td className="py-1">{item?.name ?? `#${m.itemId}`}</td>
                        <td className="py-1">
                          <Badge variant="outline" className={
                            m.type === "in" ? "bg-emerald-50 text-emerald-700" :
                            m.type === "out" ? "bg-red-50 text-red-700" : ""
                          }>
                            {t(`accounting.movements.${m.type}`)}
                            {m.referenceType ? ` · ${m.referenceType}` : ""}
                          </Badge>
                        </td>
                        <td className="py-1 text-end tabular-nums">{Number(m.quantity)} {item?.unit ?? ""}</td>
                        <td className="py-1 text-end tabular-nums">{m.totalCost ? fmtMoney(Number(m.totalCost)) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("accounting.inv.addItem")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t("accounting.inv.itemName")}</Label><Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("accounting.inv.category")}</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm({ ...itemForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feed">{t("accounting.inv.cat.feed")}</SelectItem>
                    <SelectItem value="medicine">{t("accounting.inv.cat.medicine")}</SelectItem>
                    <SelectItem value="equipment">{t("accounting.inv.cat.equipment")}</SelectItem>
                    <SelectItem value="other">{t("accounting.inv.cat.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("accounting.inv.unit")}</Label><Input value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>{t("accounting.inv.qtyOnHand")}</Label><Input type="number" min="0" step="0.01" value={itemForm.quantityOnHand} onChange={e => setItemForm({ ...itemForm, quantityOnHand: e.target.value })} /></div>
              <div><Label>{t("accounting.inv.unitCost")}</Label><Input type="number" min="0" step="0.01" value={itemForm.unitCost} onChange={e => setItemForm({ ...itemForm, unitCost: e.target.value })} /></div>
              <div><Label>{t("accounting.inv.reorder")}</Label><Input type="number" min="0" step="0.01" value={itemForm.reorderLevel} onChange={e => setItemForm({ ...itemForm, reorderLevel: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => addItemMut.mutate()} disabled={!itemForm.name || !itemForm.unit || addItemMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurchaseDialog item={purchaseOf} onClose={() => setPurchaseOf(null)} onDone={refresh} today={today} />
      <UseDialog     item={useOf}      onClose={() => setUseOf(null)}      onDone={refresh} today={today} batches={batches} />
      <EggSaleDialog open={eggOpen}    onClose={() => setEggOpen(false)}   onDone={refresh} today={today} batches={batches} invoices={invoices} />
    </div>
  );
}

function PurchaseDialog({ item, onClose, onDone, today }: { item: InventoryItem | null; onClose: () => void; onDone: () => void; today: () => string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ quantity:"", unitCost:"", date:today(), supplier:"" });
  useEffect(() => { if (item) setForm({ quantity:"", unitCost:String(item.unitCost ?? 0), date:today(), supplier:"" }); /* eslint-disable-next-line */ }, [item?.id]);

  const mut = useMutation({
    mutationFn: () => api("/api/operations/inventory-purchase", {
      method:"POST",
      body: JSON.stringify({ itemId:item!.id, quantity:Number(form.quantity), unitCost:Number(form.unitCost), date:form.date, supplier:form.supplier || null }),
    }),
    onSuccess: () => { toast({ title: t("accounting.op.success") }); onDone(); onClose(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!item} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("accounting.op.purchase.title")}: {item?.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t("accounting.op.purchase.help")}</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("accounting.op.qty")} ({item?.unit})</Label><Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label>{t("accounting.inv.unitCost")}</Label><Input type="number" min="0" step="0.01" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} /></div>
          <div><Label>{t("accounting.op.date")}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>{t("accounting.op.supplier")}</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.quantity || !form.unitCost || mut.isPending}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UseDialog({ item, onClose, onDone, today, batches }: { item: InventoryItem | null; onClose: () => void; onDone: () => void; today: () => string; batches: Batch[] }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isFeed = item?.category === "feed";
  const [form, setForm] = useState<{quantity:string; date:string; batchId:string; dosage:string; notes:string}>({ quantity:"", date:today(), batchId:"", dosage:"", notes:"" });
  useEffect(() => { if (item) setForm({ quantity:"", date:today(), batchId:"", dosage:"", notes:"" }); /* eslint-disable-next-line */ }, [item?.id]);

  const mut = useMutation({
    mutationFn: () => api(isFeed ? "/api/operations/feed-usage" : "/api/operations/medicine-usage", {
      method:"POST",
      body: JSON.stringify({
        itemId:item!.id,
        quantity:Number(form.quantity),
        date:form.date,
        batchId: form.batchId ? Number(form.batchId) : null,
        ...(isFeed ? {} : { dosage: form.dosage || null }),
        notes: form.notes || null,
      }),
    }),
    onSuccess: () => { toast({ title: t("accounting.op.success") }); onDone(); onClose(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });

  const estCost = item && form.quantity ? Number(form.quantity) * Number(item.unitCost) : 0;

  return (
    <Dialog open={!!item} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isFeed ? t("accounting.op.feedUsage.title") : t("accounting.op.medUsage.title")}: {item?.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{isFeed ? t("accounting.op.feedUsage.help") : t("accounting.op.medUsage.help")}</p>
        <div className="text-xs text-muted-foreground">
          {t("accounting.inv.qtyOnHand")}: <strong>{item ? Number(item.quantityOnHand) : 0} {item?.unit}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("accounting.op.qty")} ({item?.unit})</Label><Input type="number" min="0.01" step="0.01" max={item?.quantityOnHand} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label>{t("accounting.op.date")}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <div><Label>{t("accounting.op.batch")}</Label>
          <Select value={form.batchId || "none"} onValueChange={v => setForm({ ...form, batchId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder={t("accounting.op.batch.none")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("accounting.op.batch.none")}</SelectItem>
              {batches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!isFeed && (
          <div><Label>{t("accounting.op.dosage")}</Label><Input value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} /></div>
        )}
        <div><Label>{t("common.notes")}</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="text-sm">≈ <strong>{fmtMoney(estCost)}</strong></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.quantity || mut.isPending}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EggSaleDialog({ open, onClose, onDone, today, batches, invoices }: { open: boolean; onClose: () => void; onDone: () => void; today: () => string; batches: Batch[]; invoices: Invoice[] }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ eggCount:"", unitPrice:"", date:today(), batchId:"", customer:"", invoiceId:"", notes:"" });
  useEffect(() => { if (open) setForm({ eggCount:"", unitPrice:"", date:today(), batchId:"", customer:"", invoiceId:"", notes:"" }); }, [open]);

  const mut = useMutation({
    mutationFn: () => api("/api/operations/egg-sale", {
      method:"POST",
      body: JSON.stringify({
        date:form.date,
        eggCount:Number(form.eggCount),
        unitPrice:Number(form.unitPrice),
        batchId: form.batchId  ? Number(form.batchId)  : null,
        invoiceId: form.invoiceId ? Number(form.invoiceId) : null,
        customer: form.customer || null,
        notes: form.notes || null,
      }),
    }),
    onSuccess: () => { toast({ title: t("accounting.op.success") }); onDone(); onClose(); },
    onError: (e:any) => toast({ title: e.message, variant: "destructive" }),
  });

  const total = form.eggCount && form.unitPrice ? Number(form.eggCount) * Number(form.unitPrice) : 0;
  const openInvoices = invoices.filter(i => i.status !== "paid");

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("accounting.op.eggSale.title")}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t("accounting.op.eggSale.help")}</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("accounting.op.eggCount")}</Label><Input type="number" min="1" value={form.eggCount} onChange={e => setForm({ ...form, eggCount: e.target.value })} /></div>
          <div><Label>{t("accounting.op.unitPrice")}</Label><Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} /></div>
          <div><Label>{t("accounting.op.date")}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>{t("accounting.op.customer")}</Label><Input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
        </div>
        <div><Label>{t("accounting.op.batch")}</Label>
          <Select value={form.batchId || "none"} onValueChange={v => setForm({ ...form, batchId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("accounting.op.batch.none")}</SelectItem>
              {batches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t("accounting.op.invoice")}</Label>
          <Select value={form.invoiceId || "none"} onValueChange={v => setForm({ ...form, invoiceId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("accounting.op.invoice.none")}</SelectItem>
              {openInvoices.map(i => (
                <SelectItem key={i.id} value={String(i.id)}>
                  #{i.id} — {i.customerName} ({fmtMoney(Number(i.remainingAmount))})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm">{t("accounting.invoice.total")}: <strong>{fmtMoney(total)}</strong></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.eggCount || !form.unitPrice || mut.isPending}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
