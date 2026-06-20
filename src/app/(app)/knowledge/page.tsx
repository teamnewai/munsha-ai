"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Brain, Plus, Search, FileText, Loader2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { getKnowledgeDocs, addKnowledgeDoc } from "@/app/actions/org";
import type { KnowledgeDoc } from "@/app/actions/org";

const SOURCE_LABEL: Record<string, string> = {
  policy: "سياسة",
  manual: "دليل",
  procedure: "إجراء",
  standard: "معيار",
  system: "نظام",
};

const SOURCE_COLORS: Record<string, string> = {
  policy: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  manual: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  procedure: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  standard: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function SourceBadge({ source }: { source: string | null }) {
  const s = source ?? "system";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", SOURCE_COLORS[s] ?? SOURCE_COLORS.system)}>
      {SOURCE_LABEL[s] ?? s}
    </span>
  );
}

function DocCard({ doc }: { doc: KnowledgeDoc }) {
  const [expanded, setExpanded] = useState(false);
  const excerpt = doc.raw_text ? doc.raw_text.slice(0, 120) : null;
  const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString("ar-EG") : null;

  return (
    <Card className="p-4 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="size-8 rounded-lg bg-[hsl(217_91%_60%/0.1)] text-[hsl(217_91%_50%)] grid place-items-center shrink-0 mt-0.5">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-snug">{doc.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <SourceBadge source={doc.source} />
              {doc.dept_key && (
                <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{doc.dept_key}</span>
              )}
              {doc.status && (
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded",
                  doc.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                )}>
                  {doc.status === "active" ? "نشط" : doc.status}
                </span>
              )}
              {date && <span className="text-[11px] text-muted-foreground">{date}</span>}
            </div>
          </div>
        </div>
      </div>

      {excerpt && (
        <div className="mr-10">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {expanded ? doc.raw_text : (excerpt.length < (doc.raw_text?.length ?? 0) ? `${excerpt}...` : excerpt)}
          </p>
          {doc.raw_text && doc.raw_text.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-[11px] text-[hsl(217_91%_50%)] mt-1 hover:underline"
            >
              {expanded ? <><ChevronUp className="size-3" /> عرض أقل</> : <><ChevronDown className="size-3" /> عرض الكامل</>}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

const EMPTY_FORM = {
  title: "",
  source: "policy",
  dept_key: "",
  raw_text: "",
};

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [liveData, setLiveData] = useState(false);

  useEffect(() => {
    getKnowledgeDocs().then((res) => {
      if (res.ok) {
        setDocs(res.docs);
        setLiveData(true);
      }
      setLoading(false);
    });
  }, []);

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || (d.raw_text ?? "").toLowerCase().includes(q);
    const matchSource = !filterSource || d.source === filterSource;
    const matchDept = !filterDept || d.dept_key === filterDept;
    return matchSearch && matchSource && matchDept;
  });

  // Stats
  const bySource = Object.entries(SOURCE_LABEL).map(([key, label]) => ({
    key, label, count: docs.filter((d) => d.source === key).length,
  })).filter((s) => s.count > 0);

  const depts = Array.from(new Set(docs.map((d) => d.dept_key).filter(Boolean)));

  async function handleAdd() {
    if (!form.title.trim()) {
      toast.error("عنوان الوثيقة مطلوب");
      return;
    }
    setSaving(true);
    const res = await addKnowledgeDoc({
      title: form.title,
      source: form.source,
      dept_key: form.dept_key || undefined,
      raw_text: form.raw_text || "",
    });
    if (res.ok) {
      toast.success("تمت إضافة الوثيقة بنجاح");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      const fresh = await getKnowledgeDocs();
      if (fresh.ok) setDocs(fresh.docs);
    } else {
      toast.error(res.error ?? "حدث خطأ أثناء الإضافة");
    }
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_50%)] grid place-items-center">
              <Brain className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-primary">العقل المعرفي — قاعدة المعرفة</h1>
              {liveData && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  وثائق حقيقية من قاعدة البيانات
                </span>
              )}
            </div>
          </div>
          <Button
            className="gap-1 bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)]"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" /> إضافة وثيقة
          </Button>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="flex flex-wrap gap-3">
            <Card className="px-4 py-2 flex items-center gap-2 text-sm">
              <FileText className="size-4 text-[hsl(217_91%_50%)]" />
              <span className="text-muted-foreground">إجمالي الوثائق:</span>
              <span className="font-bold">{docs.length}</span>
            </Card>
            {bySource.map((s) => (
              <Card key={s.key} className="px-3 py-2 flex items-center gap-2 text-xs">
                <SourceBadge source={s.key} />
                <span className="font-medium">{s.count}</span>
              </Card>
            ))}
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث في الوثائق..."
              className="pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="size-4 text-muted-foreground" />
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="">كل المصادر</option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {depts.length > 0 && (
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">كل الأقسام</option>
              {depts.map((d) => (
                <option key={d} value={d ?? ""}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" /> جارٍ التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="mulki-card p-12 text-center">
            <Brain className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search || filterSource || filterDept ? "لا توجد نتائج للبحث المحدد" : "لا توجد وثائق بعد"}
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => <DocCard key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة وثيقة معرفية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">العنوان *</label>
              <Input
                placeholder="عنوان الوثيقة"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">النوع</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                >
                  {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">القسم</label>
                <Input
                  placeholder="مثال: finance"
                  value={form.dept_key}
                  onChange={(e) => setForm((f) => ({ ...f, dept_key: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">المحتوى</label>
              <Textarea
                placeholder="نص الوثيقة..."
                rows={5}
                value={form.raw_text}
                onChange={(e) => setForm((f) => ({ ...f, raw_text: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              disabled={saving}
              onClick={handleAdd}
              className="bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)] gap-1"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
