"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { getGovernanceData, type AuditEntry } from "@/app/actions/structure";
import { ShieldCheck, ScrollText, CheckCircle2, Ban, KeyRound, RefreshCw } from "lucide-react";

type Counts = { audits: number; approvals: number; suspensions: number; accessReqs: number };

const ACTION_MAP: Record<string, { label: string; cls: string }> = {
  approve: { label: "اعتماد", cls: "bg-green-500/15 text-green-600 border border-green-500/30" },
  reject: { label: "رفض", cls: "bg-destructive/15 text-destructive border border-destructive/30" },
  create: { label: "إنشاء", cls: "bg-blue-500/15 text-blue-600 border border-blue-500/30" },
  update: { label: "تحديث", cls: "bg-amber-500/15 text-amber-600 border border-amber-500/30" },
  suspend: { label: "تعليق", cls: "bg-destructive/15 text-destructive border border-destructive/30" },
};

function actionBadge(action: string) {
  const m = ACTION_MAP[action];
  return m ?? { label: action, cls: "border border-border text-muted-foreground" };
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
      <span className="size-2 rounded-full bg-green-500 animate-pulse" />
      بيانات حقيقية
    </span>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof ScrollText; label: string; value: number }) {
  return (
    <Card className="mulki-card p-4 flex items-center gap-3">
      <div className="grid place-items-center size-10 rounded-lg mulki-gold-bg shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-display font-semibold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

export default function GovernancePage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ audits: 0, approvals: 0, suspensions: 0, accessReqs: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await getGovernanceData();
      if (!res.ok) {
        toast.error("تعذّر تحميل بيانات الحوكمة");
        return;
      }
      setAudits(res.audits);
      setCounts(res.counts);
    } catch {
      toast.error("حدث خطأ أثناء التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" /> الحوكمة
          </h1>
          {!loading && <LiveBadge />}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4 ms-2", loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {loading ? (
        <Card className="mulki-card p-12 text-center text-muted-foreground">جاري التحميل…</Card>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={ScrollText} label="سجلات التدقيق" value={counts.audits} />
            <StatCard icon={CheckCircle2} label="الاعتمادات" value={counts.approvals} />
            <StatCard icon={Ban} label="الإيقافات" value={counts.suspensions} />
            <StatCard icon={KeyRound} label="طلبات الوصول" value={counts.accessReqs} />
          </div>

          {/* Audit log */}
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <ScrollText className="size-5 text-primary" /> سجل التدقيق
            </h2>
            {audits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ScrollText className="size-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد سجلات تدقيق.</p>
              </div>
            ) : (
              <ol className="relative space-y-4">
                {audits.map((a) => {
                  const b = actionBadge(a.action);
                  return (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-4"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0 mt-0.5",
                          b.cls,
                        )}
                      >
                        {b.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="font-medium">{a.actorName}</span>
                          <span className="text-xs text-muted-foreground">{a.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{a.detail}</p>
                        {a.table_name && (
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">
                            {a.table_name}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
