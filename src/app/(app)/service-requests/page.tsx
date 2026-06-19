"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import {
  Plus, Sparkles, CheckCircle2, XCircle, ArrowRight, Clock,
  AlertTriangle, ListChecks, ClipboardList, Users2, BarChart3,
} from "lucide-react";

// مركز طلبات الخدمات — مُلكي OS (بيانات ثابتة متسقة)

type SRStatus = "new" | "pending_manager" | "approved" | "rejected" | "in_progress" | "completed" | "closed";
type SRPriority = "low" | "normal" | "high" | "urgent";
type SRCategory = "hr" | "finance" | "it" | "maintenance" | "procurement" | "general";

const STATUS_LABELS: Record<SRStatus, string> = {
  new: "جديد", pending_manager: "بانتظار المدير", approved: "معتمد", rejected: "مرفوض",
  in_progress: "قيد التنفيذ", completed: "منفّذ", closed: "مغلق",
};
const PRIORITY_LABELS: Record<SRPriority, string> = { low: "منخفض", normal: "عادي", high: "عالٍ", urgent: "عاجل" };
const CATEGORY_LABELS: Record<SRCategory, string> = {
  hr: "الموارد البشرية", finance: "المالية", it: "تقنية المعلومات",
  maintenance: "الصيانة", procurement: "المشتريات", general: "عام",
};
const TYPES: Record<SRCategory, string[]> = {
  hr: ["طلب إجازة", "تعريف بالراتب", "خطاب تعريف"],
  finance: ["صرف مستحقات", "سلفة", "عهدة"],
  it: ["دعم فني", "جهاز جديد", "صلاحية وصول"],
  maintenance: ["صيانة مكتب", "تكييف", "كهرباء"],
  procurement: ["شراء أصناف", "عرض سعر"],
  general: ["استفسار", "طلب آخر"],
};

const STATUS_TONE: Record<SRStatus, string> = {
  new: "bg-muted text-muted-foreground",
  pending_manager: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  rejected: "bg-destructive/15 text-destructive border border-destructive/30",
  in_progress: "bg-accent/15 text-accent border border-accent/30",
  completed: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
  closed: "bg-primary/15 text-primary border border-primary/30",
};
const PRIORITY_TONE: Record<SRPriority, string> = {
  low: "bg-muted text-muted-foreground", normal: "bg-blue-500/15 text-blue-400",
  high: "bg-amber-500/15 text-amber-500", urgent: "bg-destructive/15 text-destructive",
};

type SR = {
  id: string; title: string; category: SRCategory; type: string; status: SRStatus;
  priority: SRPriority; requester: string; manager: string; unit: string; executor: string;
  cost?: number; created: string; progress: number; description?: string; scope: ("mine" | "to_approve" | "assigned")[];
};

const SEED: SR[] = [
  { id: "SR-1042", title: "طلب إجازة سنوية (10 أيام)", category: "hr", type: "طلب إجازة", status: "pending_manager", priority: "normal", requester: "أحمد محمد", manager: "محمد العتيبي", unit: "الموارد البشرية", executor: "—", created: "2024/05/20 09:12", progress: 0, description: "إجازة من 1 يونيو إلى 10 يونيو.", scope: ["mine", "to_approve"] },
  { id: "SR-1041", title: "صرف بدل انتداب", category: "finance", type: "صرف مستحقات", status: "approved", priority: "high", requester: "سارة القحطاني", manager: "مدير الإدارة المالية", unit: "المالية", executor: "قسم الرواتب", cost: 3200, created: "2024/05/19 14:30", progress: 40, description: "بدل انتداب لمدينة جدة.", scope: ["assigned"] },
  { id: "SR-1040", title: "جهاز حاسب محمول جديد", category: "it", type: "جهاز جديد", status: "in_progress", priority: "normal", requester: "ناصر المطيري", manager: "محمد العتيبي", unit: "تقنية المعلومات", executor: "خالد الحربي", cost: 5500, created: "2024/05/18 11:05", progress: 65, description: "استبدال جهاز قديم.", scope: ["assigned"] },
  { id: "SR-1039", title: "صيانة مكيّف الدور الثاني", category: "maintenance", type: "تكييف", status: "completed", priority: "urgent", requester: "عبدالله السبيعي", manager: "مدير العمليات", unit: "التشغيل", executor: "فريق الصيانة", created: "2024/05/17 08:40", progress: 100, description: "عطل في وحدة التبريد.", scope: ["mine"] },
  { id: "SR-1038", title: "عهدة هاتف عمل", category: "procurement", type: "شراء أصناف", status: "new", priority: "low", requester: "ريم العبيدي", manager: "محمد العتيبي", unit: "المشتريات", executor: "—", cost: 1800, created: "2024/05/16 16:20", progress: 0, scope: ["mine"] },
  { id: "SR-1037", title: "خطاب تعريف للبنك", category: "hr", type: "خطاب تعريف", status: "closed", priority: "normal", requester: "علي الزهراني", manager: "محمد العتيبي", unit: "الموارد البشرية", executor: "قسم شؤون الموظفين", created: "2024/05/15 10:00", progress: 100, scope: ["mine"] },
];

type Scope = "mine" | "to_approve" | "assigned" | "all";
const TABS: { key: Scope; label: string; Icon: typeof ClipboardList }[] = [
  { key: "mine", label: "طلباتي", Icon: ClipboardList },
  { key: "to_approve", label: "بانتظار اعتمادي", Icon: CheckCircle2 },
  { key: "assigned", label: "مُسندة إليّ", Icon: ListChecks },
  { key: "all", label: "كل الطلبات", Icon: Users2 },
];

export default function ServiceRequestsPage() {
  const [tab, setTab] = useState<Scope>("mine");
  const [rows, setRows] = useState<SR[]>(SEED);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const kpi = useMemo(() => {
    const total = rows.length;
    const closed = rows.filter((r) => r.status === "completed" || r.status === "closed").length;
    const open = total - closed - rows.filter((r) => r.status === "rejected").length;
    const overdue = rows.filter((r) => r.priority === "urgent" && r.status !== "completed" && r.status !== "closed").length;
    return { total, open, closed, overdue, avgHours: 18, delayRate: total ? Math.round((overdue / total) * 100) : 0 };
  }, [rows]);

  const filtered = rows.filter((r) => tab === "all" || r.scope.includes(tab));
  const active = rows.find((r) => r.id === openId) ?? null;

  function setStatus(id: string, status: SRStatus, progress?: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, progress: progress ?? r.progress } : r)));
  }

  const kpiItems = [
    { Icon: ClipboardList, label: "إجمالي الطلبات", value: kpi.total, tone: "text-primary" },
    { Icon: Clock, label: "مفتوحة", value: kpi.open, tone: "text-accent" },
    { Icon: CheckCircle2, label: "مغلقة/منتهية", value: kpi.closed, tone: "text-emerald-500" },
    { Icon: AlertTriangle, label: "متأخرة", value: kpi.overdue, tone: "text-amber-500" },
    { Icon: BarChart3, label: "متوسط الإنجاز", value: `${kpi.avgHours} س`, tone: "text-blue-500" },
    { Icon: AlertTriangle, label: "نسبة التأخير", value: `${kpi.delayRate}%`, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpiItems.map((it) => (
          <Card key={it.label} className="mulki-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <it.Icon className={`size-4 ${it.tone}`} />{it.label}
            </div>
            <div className="font-display text-2xl font-semibold mt-1 tabular-nums">{it.value}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <t.Icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="size-4 ms-1" /> طلب جديد</Button>
      </div>

      <Card className="mulki-card p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">لا توجد طلبات.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.id} onClick={() => setOpenId(r.id)}
                className="py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/20 px-2 rounded-lg transition-colors">
                <ArrowRight className="size-4 text-muted-foreground" />
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${STATUS_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${PRIORITY_TONE[r.priority]}`}>{PRIORITY_LABELS[r.priority]}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{CATEGORY_LABELS[r.category]}</span>
                <div className="flex-1 min-w-0 text-end">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.requester} • {r.created}</div>
                </div>
                {r.progress > 0 && (
                  <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden hidden sm:block">
                    <div className="h-full bg-primary" style={{ width: `${r.progress}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* تفاصيل الطلب */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-md ${STATUS_TONE[active.status]}`}>{STATUS_LABELS[active.status]}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md ${PRIORITY_TONE[active.priority]}`}>{PRIORITY_LABELS[active.priority]}</span>
                  <span>{active.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <FieldBox label="الفئة" value={CATEGORY_LABELS[active.category]} />
                <FieldBox label="النوع" value={active.type} />
                <FieldBox label="صاحب الطلب" value={active.requester} />
                <FieldBox label="المدير" value={active.manager} />
                <FieldBox label="الإدارة المنفذة" value={active.unit} />
                <FieldBox label="المنفذ" value={active.executor} />
                <FieldBox label="التكلفة المتوقعة" value={active.cost ? `${active.cost} ر.س` : "—"} />
                <FieldBox label="التاريخ" value={active.created} />
              </div>
              {active.description && (
                <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">{active.description}</div>
              )}
              {active.progress > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                    <span className="tabular-nums">{active.progress}%</span><span>التقدّم</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden"><div className="h-full bg-primary" style={{ width: `${active.progress}%` }} /></div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {(active.status === "pending_manager" || active.status === "new") && (
                  <>
                    <Button size="sm" onClick={() => { setStatus(active.id, "approved"); toast.success("تم الاعتماد"); }}>
                      <CheckCircle2 className="size-4 ms-1" /> اعتماد
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setStatus(active.id, "rejected"); toast.error("تم الرفض"); }}>
                      <XCircle className="size-4 ms-1" /> رفض
                    </Button>
                  </>
                )}
                {(active.status === "approved" || active.status === "in_progress") && (
                  <Button size="sm" onClick={() => { setStatus(active.id, "completed", 100); toast.success("تم إنهاء التنفيذ"); }}>
                    إنهاء التنفيذ
                  </Button>
                )}
                {active.status === "completed" && (
                  <Button size="sm" onClick={() => { setStatus(active.id, "closed"); toast.success("تم إغلاق الطلب"); }}>إغلاق الطلب</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => toast.info("تمت إضافة ملاحظة")}>إضافة ملاحظة</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {showNew && <NewRequest onClose={() => setShowNew(false)} onCreate={(r) => { setRows((p) => [r, ...p]); setShowNew(false); toast.success("تم إنشاء الطلب"); }} />}
    </div>
  );
}

function FieldBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/40 border border-border p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function NewRequest({ onClose, onCreate }: { onClose: () => void; onCreate: (r: SR) => void }) {
  const [category, setCategory] = useState<SRCategory>("hr");
  const [type, setType] = useState(TYPES.hr[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SRPriority>("normal");
  const [cost, setCost] = useState("");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader><DialogTitle>إنشاء طلب خدمة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="عنوان الطلب" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="تفاصيل الطلب" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          <Button type="button" variant="outline" size="sm" disabled={!title}
            onClick={() => toast.info("نور AI: تم تصنيف الطلب تلقائياً")}>
            <Sparkles className="size-4 ms-1" /> تصنيف ذكي بواسطة نور AI
          </Button>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-muted-foreground">الفئة</span>
              <select className="mulki-input mt-1" value={category}
                onChange={(e) => { const c = e.target.value as SRCategory; setCategory(c); setType(TYPES[c][0]); }}>
                {(Object.keys(CATEGORY_LABELS) as SRCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">النوع</span>
              <select className="mulki-input mt-1" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES[category].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">الأولوية</span>
              <select className="mulki-input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as SRPriority)}>
                {(Object.keys(PRIORITY_LABELS) as SRPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">التكلفة المتوقعة</span>
              <Input className="mt-1" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button disabled={!title} onClick={() => onCreate({
            id: `SR-${Math.floor(1043 + Math.random() * 900)}`, title, category, type, status: "pending_manager",
            priority, requester: "أحمد محمد", manager: "محمد العتيبي", unit: CATEGORY_LABELS[category], executor: "—",
            cost: cost ? Number(cost) : undefined, created: new Date().toLocaleString("ar-SA"), progress: 0,
            description: description || undefined, scope: ["mine", "to_approve"],
          })}>إرسال للمدير</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
