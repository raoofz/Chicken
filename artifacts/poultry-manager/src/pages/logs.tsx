import { useState } from "react";
import { useListActivityLogs, getListActivityLogsQueryKey, useCreateActivityLog } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, BookOpen, Utensils, Heart, Egg, Sparkles, Eye, Brush } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CAT_CONFIG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  feeding: { label: "تغذية", Icon: Utensils, color: "text-amber-600", bg: "bg-amber-100" },
  health: { label: "صحة", Icon: Heart, color: "text-red-500", bg: "bg-red-100" },
  hatching: { label: "تفقيس", Icon: Egg, color: "text-emerald-600", bg: "bg-emerald-100" },
  cleaning: { label: "نظافة", Icon: Brush, color: "text-blue-500", bg: "bg-blue-100" },
  observation: { label: "ملاحظة", Icon: Eye, color: "text-violet-500", bg: "bg-violet-100" },
  other: { label: "أخرى", Icon: Sparkles, color: "text-gray-500", bg: "bg-gray-100" },
};

function LogForm({ onSubmit, onClose }: { onSubmit: (d: any) => void; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ title: "", description: "", category: "observation", date: today });
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>العنوان</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثل: لاحظت أعراض زكام على 3 طيور" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التصنيف</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CAT_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>التاريخ</Label>
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>التفاصيل (اختياري)</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="تفاصيل إضافية..." rows={3} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        <Button type="submit">تسجيل</Button>
      </div>
    </form>
  );
}

export default function Logs() {
  const { data: logs, isLoading } = useListActivityLogs({ query: { queryKey: getListActivityLogsQueryKey() } });
  const createLog = useCreateActivityLog();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: getListActivityLogsQueryKey() });

  const grouped = logs?.reduce<Record<string, typeof logs>>((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {}) ?? {};

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">سجل النشاط</h1>
          <p className="text-muted-foreground text-sm">توثيق أحداث وملاحظات المزرعة اليومية</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />تسجيل حدث</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>تسجيل حدث جديد</DialogTitle></DialogHeader>
            <LogForm onSubmit={async d => { await createLog.mutateAsync({ data: d }); toast({ title: "تم التسجيل" }); setOpen(false); refresh(); }} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
      ) : logs?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">السجل فارغ</h3>
            <p className="text-muted-foreground text-sm">ابدأ بتسجيل أحداث مزرعتك اليومية</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                {date}
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="space-y-2">
                {grouped[date].map(log => {
                  const cfg = CAT_CONFIG[log.category];
                  const Icon = cfg.Icon;
                  return (
                    <Card key={log.id} className="border-border/60">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{log.title}</p>
                            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          {log.description && <p className="text-sm text-muted-foreground mt-1">{log.description}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
