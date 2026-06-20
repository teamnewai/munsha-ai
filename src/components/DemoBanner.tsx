import { AlertTriangle } from "lucide-react";

// شريط موحّد يوضّح أن المعروض «بيانات تجريبية» تُستبدل تلقائياً ببيانات المنشأة الحقيقية.
export function DemoBanner({ note }: { note?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        {note ?? "هذه "}
        <b>بيانات تجريبية</b> لعرض الخدمة. ستُستبدل تلقائياً ببيانات منشأتك فور إضافتها.
      </span>
    </div>
  );
}
