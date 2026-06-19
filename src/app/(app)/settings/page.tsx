"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Mail, Send, CheckCircle2, XCircle } from "lucide-react";

type TestLog = { time: string; ok: boolean; detail: string };

const NOTIFICATION_KINDS = [
  "workflow_assigned",
  "workflow_approved",
  "workflow_rejected",
  "workflow_escalated",
  "form_submitted",
  "task_assigned",
  "task_due",
  "mention",
  "system",
  "info",
] as const;

const KIND_LABELS: Record<string, string> = {
  workflow_assigned: "تكليف بسير عمل أو طلب اعتماد",
  workflow_approved: "اعتماد طلب",
  workflow_rejected: "رفض طلب",
  workflow_escalated: "تصعيد مهمة متأخرة",
  form_submitted: "إرسال نموذج جديد",
  task_assigned: "تكليف بمهمة",
  task_due: "تنبيه استحقاق مهمة",
  mention: "ذكر/منشن",
  system: "إشعارات النظام",
  info: "إشعارات معلوماتية",
};

// inline label
function Label({ htmlFor, className, children }: { htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium leading-none", className)}>
      {children}
    </label>
  );
}

// inline switch
function Switch({ checked, onCheckedChange, disabled, "aria-label": ariaLabel }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input border-border",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow ring-0 transition-transform",
          checked ? "translate-x-[-20px]" : "translate-x-[-2px]",
        )}
      />
    </button>
  );
}

// inline checkbox
function Checkbox({ checked, onCheckedChange, disabled }: {
  checked: boolean; onCheckedChange: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "size-4 shrink-0 rounded-sm border border-primary grid place-items-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary text-primary-foreground" : "bg-transparent",
      )}
    >
      {checked && <CheckCircle2 className="size-3" />}
    </button>
  );
}

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [testTo, setTestTo] = useState("");
  const [kinds, setKinds] = useState<string[]>([
    "workflow_assigned",
    "workflow_approved",
    "task_assigned",
  ]);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);

  const pushLog = (entry: TestLog) =>
    setTestLogs((prev) => [entry, ...prev].slice(0, 10));

  const toggleKind = (k: string) =>
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const save = () => {
    toast.success("تم حفظ إعدادات البريد");
  };

  const sendTest = () => {
    pushLog({ time: new Date().toLocaleString("ar-EG"), ok: true, detail: "تم القبول — معرّف: msg_demo_001" });
    toast.success(`تم إرسال رسالة اختبار إلى ${testTo.trim() || "بريدك"}`);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl" dir="rtl">
      <Card className="mulki-card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Mail className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold">إشعارات البريد الإلكتروني</h2>
            <p className="text-sm text-muted-foreground mt-1">
              أرسل نسخة من إشعارات النظام إلى بريد المستخدم عبر Resend عند تغيّر حالات سير العمل.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="تفعيل البريد"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="from-name">اسم المُرسِل</Label>
            <Input
              id="from-name"
              placeholder="مُلكي OS"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={!enabled}
            />
          </div>
          <div>
            <Label htmlFor="from-email">بريد المُرسِل</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="notify@yourdomain.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              اتركه فارغًا لاستخدام عنوان Resend الافتراضي للاختبار. للإنتاج استخدم نطاقًا موثّقًا في Resend.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Label className="mb-3 block">أنواع الإشعارات التي تُرسَل بالبريد</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {NOTIFICATION_KINDS.map((k) => (
              <label
                key={k}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-accent/30"
              >
                <Checkbox
                  checked={kinds.includes(k)}
                  onCheckedChange={() => toggleKind(k)}
                  disabled={!enabled}
                />
                <span className="text-sm">{KIND_LABELS[k] ?? k}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <Label htmlFor="test-to">بريد المستلِم للاختبار</Label>
          <Input
            id="test-to"
            type="email"
            placeholder="أدخل بريدًا مختلفًا (اختياري)"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            disabled={!enabled}
            dir="rtl"
          />
          <p className="text-xs text-muted-foreground mt-1">
            اتركه فارغًا لإرسال الاختبار إلى بريد حسابك المسجّل.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save}>حفظ التغييرات</Button>
          <Button
            variant="outline"
            onClick={sendTest}
            disabled={!enabled}
          >
            <Send className="size-4" />
            إرسال رسالة اختبار
          </Button>
        </div>

        {testLogs.length > 0 && (
          <div className="mt-6 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">سجل محاولات الاختبار</Label>
              <button
                type="button"
                onClick={() => setTestLogs([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                مسح السجل
              </button>
            </div>
            <ul className="space-y-2">
              {testLogs.map((l, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm"
                >
                  {l.ok ? (
                    <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={l.ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                        {l.ok ? "نجح" : "فشل"}
                      </span>
                      <span className="text-xs text-muted-foreground">{l.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{l.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
