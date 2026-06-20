"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Plus, CheckCircle2, Clock, ClipboardList, RefreshCw, Wrench, Tag, AlignLeft,
} from "lucide-react";
import { getServiceRequests, createServiceRequest, type ServiceReq } from "@/app/actions/structure";

// مركز طلبات الخدمات — مُلكي OS (بيانات حقيقية)

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  offers: "عروض",
  approved: "معتمد",
  scheduled: "مجدول",
  done: "منتهي",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const STATUS_TONE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  offers: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  approved: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
  scheduled: "bg-accent/15 text-accent border border-accent/30",
  done: "bg-primary/15 text-primary border border-primary/30",
  rejected: "bg-destructive/15 text-destructive border border-destructive/30",
  cancelled: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
};

const CATEGORIES = ["صيانة", "تقنية", "مشتريات", "إداري"];

function statusTone(status: string) {
  return STATUS_TONE[status] ?? "bg-muted text-muted-foreground";
}

export default function ServiceRequestsPage() {
  const [rows, setRows] = useState<ServiceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // new request form
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [faultType, setFaultType] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await getServiceRequests();
    if (res.ok) {
      setRows(res.requests);
      setLoaded(true);
    } else {
      toast.error("تعذّر تحميل الطلبات");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return {
      total: rows.length,
      new: counts.new ?? 0,
      offers: counts.offers ?? 0,
      approved: counts.approved ?? 0,
      scheduled: counts.scheduled ?? 0,
      done: counts.done ?? 0,
    };
  }, [rows]);

  async function submit() {
    if (!details.trim()) {
      toast.error("الرجاء إدخال تفاصيل الطلب");
      return;
    }
    setSubmitting(true);
    const res = await createServiceRequest({
      category,
      faultType: faultType.trim() || undefined,
      details: details.trim(),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("تم إنشاء الطلب");
      setShowNew(false);
      setCategory(CATEGORIES[0]);
      setFaultType("");
      setDetails("");
      await load();
    } else {
      toast.error(res.error ?? "تعذّر إنشاء الطلب");
    }
  }

  const kpiItems = [
    { Icon: ClipboardList, label: "إجمالي الطلبات", value: stats.total, tone: "text-primary" },
    { Icon: Clock, label: "جديد", value: stats.new, tone: "text-muted-foreground" },
    { Icon: Tag, label: "عروض", value: stats.offers, tone: "text-blue-400" },
    { Icon: CheckCircle2, label: "معتمد", value: stats.approved, tone: "text-emerald-500" },
    { Icon: Clock, label: "مجدول", value: stats.scheduled, tone: "text-accent" },
    { Icon: CheckCircle2, label: "منتهي", value: stats.done, tone: "text-primary" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="size-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">مركز طلبات الخدمات</h1>
        </div>
        <div className="flex items-center gap-3">
          {loaded && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              بيانات حقيقية
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-4 ms-1", loading && "animate-spin")} /> تحديث
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4 ms-1" /> طلب جديد
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpiItems.map((it) => (
          <Card key={it.label} className="mulki-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <it.Icon className={cn("size-4", it.tone)} /> {it.label}
            </div>
            <div className="font-display text-2xl font-semibold mt-1 tabular-nums">{it.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mulki-card p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">جارٍ التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">لا توجد طلبات.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex items-start gap-3 px-2">
                <span className={cn("text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap", statusTone(r.status))}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.category}</span>
                    {r.faultType && (
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Tag className="size-3" /> {r.faultType}
                      </span>
                    )}
                  </div>
                  {r.details && (
                    <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlignLeft className="size-3.5 mt-0.5 shrink-0" />
                      <span className="break-words">{r.details}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="size-3" /> {r.time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء طلب خدمة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">التصنيف</span>
              <select
                className="mulki-input mt-1"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">نوع العطل</span>
              <Input
                className="mt-1"
                placeholder="نوع العطل (اختياري)"
                value={faultType}
                onChange={(e) => setFaultType(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">التفاصيل</span>
              <Textarea
                className="mt-1"
                placeholder="تفاصيل الطلب"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button disabled={submitting || !details.trim()} onClick={submit}>
              {submitting ? "جارٍ الإرسال…" : "إنشاء الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
