"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { CheckCircle2, XCircle, ShieldCheck, RefreshCw, Clock, FileText } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { getAllAccessRequests, decideAccessReq, type AccessReqRow } from "@/app/actions/structure";

type Filter = "all" | "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

function statusClass(status: string) {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border";
  if (status === "approved") return cn(base, "bg-emerald-500/15 text-emerald-500 border-emerald-500/30");
  if (status === "rejected") return cn(base, "bg-destructive/15 text-destructive border-destructive/30");
  return cn(base, "bg-amber-500/15 text-amber-500 border-amber-500/30");
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "موافق عليها" },
  { key: "rejected", label: "مرفوضة" },
];

export default function AccessRequestsPage() {
  const [rows, setRows] = useState<AccessReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setLoading(true);
    const res = await getAllAccessRequests();
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
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return { pending, approved, rejected };
  }, [rows]);

  const filtered = useMemo(
    () => rows.filter((r) => filter === "all" || r.status === filter),
    [rows, filter]
  );

  async function decide(id: string, decision: "approved" | "rejected") {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: decision } : r)));
    const res = await decideAccessReq(id, decision);
    if (res.ok) {
      toast.success(decision === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب");
    } else {
      setRows(prev);
      toast.error("تعذّر تحديث الطلب");
    }
  }

  const statItems = [
    { label: "قيد المراجعة", value: stats.pending, Icon: Clock, tone: "text-amber-500" },
    { label: "موافق عليها", value: stats.approved, Icon: CheckCircle2, tone: "text-emerald-500" },
    { label: "مرفوضة", value: stats.rejected, Icon: XCircle, tone: "text-destructive" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="font-display text-xl font-semibold">إدارة طلبات الوصول للبيانات</h1>
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statItems.map((it) => (
          <Card key={it.label} className="mulki-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <it.Icon className={cn("size-4", it.tone)} /> {it.label}
            </div>
            <div className="font-display text-2xl font-semibold mt-1 tabular-nums">{it.value}</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="mulki-card p-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</Card>
      ) : filtered.length === 0 ? (
        <Card className="mulki-card p-10 text-center text-sm text-muted-foreground">لا توجد طلبات حتى الآن</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="mulki-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.from}</span>
                    <span className={statusClass(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    <span className="text-foreground">النطاق:</span> {r.scope}
                  </div>
                  {r.reason && (
                    <div className="text-xs text-muted-foreground">
                      <span className="text-foreground">السبب:</span> {r.reason}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>المرحلة {r.stage}/{r.totalStages}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {r.time}
                    </span>
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, "approved")}>
                      <CheckCircle2 className="size-4 ms-1" /> موافقة
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(r.id, "rejected")}>
                      <XCircle className="size-4 ms-1" /> رفض
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
