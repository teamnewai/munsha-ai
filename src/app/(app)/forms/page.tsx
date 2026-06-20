"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { FileText, Inbox, Loader2, RefreshCw, Layers, Clock } from "lucide-react";
import { getForms, type FormTemplate, type FormEntry } from "@/app/actions/structure";

// ---------- dept name map ----------
const DEPT_NAMES: Record<string, string> = {
  management: "الإدارة التنفيذية",
  sales: "المبيعات وتطوير الأعمال",
  maintenance: "الصيانة والمرافق",
  finance: "المالية والمحاسبة",
  hr: "الموارد البشرية",
  ops: "العمليات",
  legal: "الشؤون القانونية والامتثال",
  realestate: "العقارات",
};
const deptName = (key: string) => DEPT_NAMES[key] ?? key;

// ---------- status map ----------
const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "مسودة", className: "bg-muted text-muted-foreground" },
  submitted: { label: "مُقدّم", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved: { label: "معتمد", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "مرفوض", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", meta.className)}>{meta.label}</span>;
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      بيانات حقيقية
    </span>
  );
}

type TabKey = "templates" | "entries";

export default function FormsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [tab, setTab] = useState<TabKey>("templates");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const res = await getForms();
    if (res.ok) {
      setTemplates(res.templates);
      setEntries(res.entries);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const pendingCount = entries.filter((e) => e.status === "submitted").length;

  const tabs: { key: TabKey; label: string; Icon: typeof FileText }[] = [
    { key: "templates", label: "النماذج", Icon: FileText },
    { key: "entries", label: "الطلبات المقدّمة", Icon: Inbox },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">النماذج والطلبات</h1>
          {!loading && <LiveBadge />}
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={cn("size-4 ms-2", refreshing && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ms-2" />
          جارٍ التحميل…
        </div>
      ) : (
        <>
          {/* stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="إجمالي النماذج" value={templates.length} Icon={FileText} color="text-primary" />
            <StatCard label="إجمالي الطلبات" value={entries.length} Icon={Inbox} color="text-blue-500" />
            <StatCard label="بانتظار المراجعة" value={pendingCount} Icon={Clock} color="text-amber-500" />
          </div>

          {/* tabs */}
          <div className="grid grid-cols-2 w-full max-w-md rounded-lg bg-muted p-1 text-muted-foreground">
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  tab === key ? "bg-background text-foreground shadow" : "hover:text-foreground",
                )}
              >
                <Icon className="size-4 ms-2" />
                {label}
              </button>
            ))}
          </div>

          {tab === "templates" && <TemplatesSection templates={templates} />}
          {tab === "entries" && <EntriesSection entries={entries} />}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color }: { label: string; value: number; Icon: typeof FileText; color?: string }) {
  return (
    <Card className="mulki-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-4", color)} />
        {label}
      </div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function TemplatesSection({ templates }: { templates: FormTemplate[] }) {
  if (templates.length === 0) {
    return <Card className="mulki-card p-10 text-center text-muted-foreground">لا توجد نماذج.</Card>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => (
        <Card key={t.id} className="mulki-card p-5 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid place-items-center size-9 shrink-0 rounded-lg mulki-gold-bg text-white">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground">{deptName(t.dept_key)}</div>
              </div>
            </div>
            <span className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0",
              t.active ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
            )}>
              {t.active ? "مفعّل" : "موقوف"}
            </span>
          </div>
          {t.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{t.description}</p>}
          <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            {t.fields.length} حقل
          </div>
        </Card>
      ))}
    </div>
  );
}

function EntriesSection({ entries }: { entries: FormEntry[] }) {
  if (entries.length === 0) {
    return <Card className="mulki-card p-10 text-center text-muted-foreground">لا توجد طلبات مقدّمة.</Card>;
  }
  return (
    <Card className="mulki-card p-2 sm:p-4">
      <div className="divide-y divide-border">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 p-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-medium truncate">{e.title}</div>
              <div className="text-xs text-muted-foreground">{deptName(e.dept_key)}</div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {e.doc_no && <span className="font-mono text-xs text-muted-foreground">{e.doc_no}</span>}
              <StatusBadge status={e.status} />
              <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <Clock className="size-3.5" />
                {e.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
