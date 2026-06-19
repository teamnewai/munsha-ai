"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Isic4SeedError = { page: number; error: string };
type Isic4SeedRun = {
  id: string;
  created_at: string;
  status: string;
  from_page: number;
  to_page: number;
  batch_size: number | null;
  rows_upserted: number;
  errors_count: number;
  errors: Isic4SeedError[];
  duration_ms: number;
  stop_reason: string | null;
};

// inline Badge
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
function Badge({ variant = "default", className, children }: { variant?: BadgeVariant; className?: string; children: React.ReactNode }) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border text-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

function fmtDuration(ms: number) {
  if (ms <= 0 || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}د ${r}ث` : `${r}ث`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: "مكتملة", variant: "default" },
  partial: { label: "مكتملة مع أخطاء", variant: "secondary" },
  cancelled: { label: "متوقفة يدوياً", variant: "outline" },
  failed: { label: "فشلت", variant: "destructive" },
};

const EXAMPLE_RUNS: Isic4SeedRun[] = [
  {
    id: "run-1",
    created_at: "2026-06-18T09:14:00.000Z",
    status: "completed",
    from_page: 1,
    to_page: 50,
    batch_size: 5,
    rows_upserted: 500,
    errors_count: 0,
    errors: [],
    duration_ms: 42000,
    stop_reason: null,
  },
  {
    id: "run-2",
    created_at: "2026-06-18T10:02:00.000Z",
    status: "partial",
    from_page: 51,
    to_page: 100,
    batch_size: 5,
    rows_upserted: 487,
    errors_count: 3,
    errors: [
      { page: 64, error: "incomplete row skipped" },
      { page: 77, error: "timeout fetching page" },
      { page: 92, error: "duplicate code conflict" },
    ],
    duration_ms: 51000,
    stop_reason: null,
  },
  {
    id: "run-3",
    created_at: "2026-06-18T11:30:00.000Z",
    status: "cancelled",
    from_page: 101,
    to_page: 110,
    batch_size: 5,
    rows_upserted: 96,
    errors_count: 0,
    errors: [],
    duration_ms: 9000,
    stop_reason: "أوقفها المستخدم يدوياً",
  },
  {
    id: "run-4",
    created_at: "2026-06-18T12:05:00.000Z",
    status: "failed",
    from_page: 111,
    to_page: 130,
    batch_size: 5,
    rows_upserted: 40,
    errors_count: 1,
    errors: [{ page: 116, error: "network error: ECONNRESET" }],
    duration_ms: 6000,
    stop_reason: "فشلت دفعة 116–120: network error: ECONNRESET",
  },
];

export default function Isic4SeedHistoryPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const runs = EXAMPLE_RUNS;
  const isLoading = false;
  const isFetching = false;

  const refetch = () => toast.info("التحديث معطّل في هذا العرض التجريبي.");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">سجل دفعات تحميل ISIC4</h1>
          <p className="text-sm text-muted-foreground">
            آخر 200 عملية تشغيل مع تفاصيل المدة، الأنشطة المضافة، والأخطاء.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
            {isFetching ? "..." : "تحديث"}
          </Button>
          <Link href="/admin/isic4-seed">
            <Button variant="outline" size="sm">عودة للتشغيل</Button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <Card className="p-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</Card>
      )}

      {!isLoading && runs.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          لا توجد عمليات تشغيل سابقة بعد.
        </Card>
      )}

      {runs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr_0.4fr] gap-2 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
            <span>التاريخ</span>
            <span>الحالة</span>
            <span>الصفحات</span>
            <span className="text-center">أنشطة</span>
            <span className="text-center">أخطاء</span>
            <span className="text-center">المدة</span>
            <span></span>
          </div>
          <div className="divide-y">
            {runs.map((r) => {
              const meta = STATUS_META[r.status] ?? { label: r.status, variant: "outline" as const };
              const isOpen = expanded === r.id;
              return (
                <div key={r.id}>
                  <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr_0.4fr] gap-2 px-4 py-3 items-center text-sm">
                    <span className="font-mono text-xs">{fmtDate(r.created_at)}</span>
                    <span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </span>
                    <span className="font-mono text-xs">
                      {r.from_page}–{r.to_page}
                      {r.batch_size ? <span className="text-muted-foreground"> · حجم {r.batch_size}</span> : null}
                    </span>
                    <span className="text-center font-mono text-xs text-primary">+{r.rows_upserted}</span>
                    <span className={`text-center font-mono text-xs ${r.errors_count > 0 ? "text-destructive" : ""}`}>
                      {r.errors_count}
                    </span>
                    <span className="text-center font-mono text-xs">{fmtDuration(r.duration_ms)}</span>
                    <span className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        disabled={!r.stop_reason && r.errors_count === 0}
                      >
                        {isOpen ? "إخفاء" : "تفاصيل"}
                      </Button>
                    </span>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 bg-muted/20 space-y-3">
                      {r.stop_reason && (
                        <div className="text-xs">
                          <div className="text-muted-foreground mb-1">سبب التوقف</div>
                          <div className="font-mono bg-background border rounded p-2">{r.stop_reason}</div>
                        </div>
                      )}
                      {r.errors_count > 0 && (
                        <div className="text-xs">
                          <div className="text-muted-foreground mb-1">
                            الأخطاء ({r.errors_count}
                            {r.errors.length < r.errors_count ? ` — يظهر أول ${r.errors.length}` : ""})
                          </div>
                          <div className="font-mono bg-background border rounded p-2 max-h-64 overflow-y-auto space-y-1" dir="ltr">
                            {r.errors.map((e, i) => (
                              <div key={i} className="text-destructive">
                                page {e.page}: {e.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
