"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Workflow, Loader2, RefreshCw, Zap, CheckCircle2, CircleSlash } from "lucide-react";
import { getWorkflowRules, toggleWorkflowRule, type WorkflowRule } from "@/app/actions/structure";

// ---------- friendly rule labels ----------
const RULE_LABELS: Record<string, string> = {
  auto_approve_leave_under_3days: "الموافقة التلقائية على الإجازات أقل من 3 أيام",
  escalate_overdue_tasks: "تصعيد المهام المتأخرة تلقائياً",
  notify_manager_on_high_expense: "إشعار المدير عند المصروفات المرتفعة",
  auto_archive_completed_after_30d: "أرشفة المعاملات المكتملة بعد 30 يوماً",
  require_dual_approval_above_50k: "اشتراط موافقة مزدوجة فوق 50 ألف",
};
const ruleLabel = (key: string) => RULE_LABELS[key] ?? key;

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      بيانات حقيقية
    </span>
  );
}

function Switch({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span className={cn("inline-block size-5 transform rounded-full bg-background shadow transition-transform", checked ? "translate-x-0.5" : "translate-x-[1.375rem]")} />
    </button>
  );
}

export default function WorkflowsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const res = await getWorkflowRules();
    if (res.ok) setRules(res.rules);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (rule: WorkflowRule) => {
    const next = !rule.enabled;
    setPendingId(rule.id);
    // optimistic update
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
    const res = await toggleWorkflowRule(rule.id, next);
    if (res.ok) {
      toast.success(next ? "تم تفعيل القاعدة" : "تم إيقاف القاعدة");
    } else {
      // revert
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)));
      toast.error("تعذّر تحديث القاعدة");
    }
    setPendingId(null);
  };

  const enabledCount = rules.filter((r) => r.enabled).length;
  const disabledCount = rules.length - enabledCount;

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">سير العمل والأتمتة</h1>
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
          {/* stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="إجمالي القواعد" value={rules.length} Icon={Zap} color="text-primary" />
            <StatCard label="القواعد المفعّلة" value={enabledCount} Icon={CheckCircle2} color="text-emerald-500" />
            <StatCard label="القواعد الموقوفة" value={disabledCount} Icon={CircleSlash} color="text-muted-foreground" />
          </div>

          {/* rules list */}
          {rules.length === 0 ? (
            <Card className="mulki-card p-10 text-center text-muted-foreground">لا توجد قواعد أتمتة.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((r) => (
                <Card key={r.id} className="mulki-card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "grid place-items-center size-10 shrink-0 rounded-lg",
                      r.enabled ? "mulki-gold-bg text-white" : "bg-muted text-muted-foreground",
                    )}>
                      <Workflow className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{ruleLabel(r.rule_key)}</div>
                      <div className="font-mono text-xs text-muted-foreground truncate">{r.rule_key}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pendingId === r.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    <Switch checked={r.enabled} disabled={pendingId === r.id} onCheckedChange={() => toggle(r)} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color }: { label: string; value: number; Icon: typeof Workflow; color?: string }) {
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
