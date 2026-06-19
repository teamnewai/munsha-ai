"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast";

type BatchReport = {
  fromPage: number;
  toPage: number;
  rowsUpserted: number;
  errors: number;
  durationMs: number;
};

function fmtDuration(ms: number) {
  if (ms <= 0 || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}د ${r}ث` : `${r}ث`;
}

// static example data (DB seeding is disabled in this visual port)
const STORED_TOTAL = 1420;

const EXAMPLE_REPORTS: BatchReport[] = [
  { fromPage: 1, toPage: 5, rowsUpserted: 50, errors: 0, durationMs: 4200 },
  { fromPage: 6, toPage: 10, rowsUpserted: 48, errors: 1, durationMs: 4600 },
];

const EXAMPLE_LOG: string[] = [
  "━━━ انتهت العملية: +98 نشاط · 9ث · أخطاء: 1",
  "✓ صفحات 6–10: +48 نشاط · 5ث · أخطاء: 1",
  "  ✗ صفحة 8: تعذّر قراءة صف غير مكتمل",
  "✓ صفحات 1–5: +50 نشاط · 4ث",
];

export default function Isic4SeedPage() {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [batchSize, setBatchSize] = useState(5);
  const [reports] = useState<BatchReport[]>(EXAMPLE_REPORTS);
  const [log] = useState<string[]>(EXAMPLE_LOG);

  const progress = { done: 10, total: 10 };
  const elapsed = 8800;
  const avgPerPage = 880;
  const eta = 0;
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const busy = false;
  const countTotal = STORED_TOTAL;

  const run = () => {
    if (to < from) return;
    toast.info("تشغيل التحميل معطّل في هذا العرض التجريبي.");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">تحميل الأنشطة الاقتصادية من وزارة التجارة</h1>
          <p className="text-sm text-muted-foreground">
            المصدر الرسمي: 2,767 نشاطاً موزّعة على 277 صفحة.
          </p>
        </div>
        <Link href="/admin/isic4-seed/history">
          <Button variant="outline" size="sm">سجل التشغيل</Button>
        </Link>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>
            إجمالي الأنشطة المخزّنة:{" "}
            <span className="font-mono text-primary">{countTotal}</span> / 2767
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {((countTotal / 2767) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (countTotal / 2767) * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">من صفحة</label>
            <Input type="number" value={from} min={1} max={277} onChange={(e) => setFrom(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">إلى صفحة</label>
            <Input type="number" value={to} min={1} max={277} onChange={(e) => setTo(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">حجم الدفعة</label>
            <Input type="number" value={batchSize} min={1} max={20} onChange={(e) => setBatchSize(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={run} disabled={busy || to < from} className="flex-1">
            {busy ? "جاري التحميل..." : "تشغيل الدفعة"}
          </Button>
        </div>
      </Card>

      {(busy || progress.total > 0) && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">تقدّم الدفعة الحالية</span>
            <span className="font-mono text-xs">
              {progress.done} / {progress.total} صفحة
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-muted/50 rounded p-2">
              <div className="text-muted-foreground">المنقضي</div>
              <div className="font-mono text-sm font-semibold mt-1">{fmtDuration(elapsed)}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-muted-foreground">المتبقي (تقديري)</div>
              <div className="font-mono text-sm font-semibold mt-1">
                {busy && eta > 0 ? fmtDuration(eta) : "—"}
              </div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-muted-foreground">متوسط/صفحة</div>
              <div className="font-mono text-sm font-semibold mt-1">
                {avgPerPage > 0 ? fmtDuration(avgPerPage) : "—"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {reports.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold mb-2">تقرير الدفعات</div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground border-b pb-1">
              <span>الصفحات</span>
              <span className="text-center">أنشطة</span>
              <span className="text-center">أخطاء</span>
              <span className="text-end">المدة</span>
            </div>
            {reports.map((r, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 text-xs font-mono">
                <span>{r.fromPage}–{r.toPage}</span>
                <span className="text-center text-primary">+{r.rowsUpserted}</span>
                <span className={`text-center ${r.errors > 0 ? "text-destructive" : ""}`}>{r.errors}</span>
                <span className="text-end">{fmtDuration(r.durationMs)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {log.length > 0 && (
        <Card className="p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1" dir="ltr">
          {log.map((line, i) => (
            <div key={i} className={line.startsWith("  ✗") || line.startsWith("✗") ? "text-destructive" : line.startsWith("━") ? "font-bold text-primary" : ""}>
              {line}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
