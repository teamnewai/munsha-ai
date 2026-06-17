"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — إصدار فاتورة حقيقية (الضريبة 15% تُحتسب في قاعدة البيانات)
export function AddInvoice() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("pending");

  const configured = isSupabaseConfigured();
  const amt = Number(amount) || 0;
  const withVat = (amt * 1.15).toLocaleString("ar-SA", { maximumFractionDigits: 2 });

  async function save() {
    setErr(null);
    if (!configured) { setErr("الوضع التجريبي: اربط Supabase وسجّل الدخول للحفظ فعلياً."); return; }
    if (amt <= 0) { setErr("أدخل مبلغاً صحيحاً."); return; }
    setSaving(true);
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setErr("سجّل الدخول أولاً."); return; }
    const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!m?.org_id) { setSaving(false); setErr("لا توجد منشأة مرتبطة بحسابك."); return; }

    const { error } = await supabase.from("invoices").insert({
      org_id: m.org_id,
      amount: amt,
      due_date: dueDate || null,
      status,
    });
    setSaving(false);
    if (error) { setErr("تعذّر الحفظ: " + error.message); return; }
    setAmount(""); setDueDate(""); setStatus("pending");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90">
        + فاتورة جديدة
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-fg">إصدار فاتورة</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">المبلغ (قبل الضريبة) *</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" className={cls} />
                <p className="mt-1 text-xs text-mut">الإجمالي شامل الضريبة 15%: <span className="font-bold text-gold">{withVat} ر.س</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">تاريخ الاستحقاق</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">الحالة</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={cls}>
                    <option value="pending">معلّقة</option>
                    <option value="paid">مدفوعة</option>
                    <option value="overdue">متأخرة</option>
                  </select>
                </div>
              </div>
              {err && <p className="text-sm text-bad">{err}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-mut hover:bg-card2">إلغاء</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-gold px-5 py-2 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
                {saving ? "جارٍ..." : "إصدار"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const cls = "w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none";
