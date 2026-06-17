"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { checkLimit } from "@/lib/planClient";

// مُلكي — إضافة عقار حقيقي (CRUD — أول عملية كتابة)
// تكتب في قاعدة البيانات الحقيقية ضمن منشأة المستخدم (RLS تضمن العزل).
export function AddProperty() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ref, setRef] = useState("");
  const [nationalAddr, setNationalAddr] = useState("");

  const configured = isSupabaseConfigured();

  async function save() {
    setErr(null);
    if (!name.trim()) {
      setErr("اسم العقار مطلوب.");
      return;
    }
    if (!configured) {
      setErr("الوضع التجريبي: اربط Supabase وسجّل الدخول لحفظ البيانات فعلياً.");
      return;
    }
    setSaving(true);
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setErr("سجّل الدخول أولاً.");
      return;
    }
    // منشأة المستخدم
    const { data: m } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!m?.org_id) {
      setSaving(false);
      setErr("لا توجد منشأة مرتبطة بحسابك.");
      return;
    }
    // فرض حدّ الباقة (المرحلة 13)
    const limitMsg = await checkLimit(m.org_id, "properties");
    if (limitMsg) {
      setSaving(false);
      setErr(limitMsg);
      return;
    }
    const { error } = await supabase.from("properties").insert({
      org_id: m.org_id,
      name: name.trim(),
      city: city.trim() || null,
      district: district.trim() || null,
      ref_code: ref.trim() || null,
      national_address: nationalAddr.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErr("تعذّر الحفظ: " + error.message);
      return;
    }
    // نجاح — أغلق وحدّث القائمة
    setName(""); setCity(""); setDistrict(""); setRef(""); setNationalAddr("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90"
      >
        + إضافة عقار
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-fg">إضافة عقار جديد</h2>
            <div className="mt-4 space-y-3">
              <Field label="اسم العقار *" value={name} onChange={setName} placeholder="مثال: برج العليا" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="المدينة" value={city} onChange={setCity} placeholder="الرياض" />
                <Field label="الحي" value={district} onChange={setDistrict} placeholder="العليا" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الكود المرجعي" value={ref} onChange={setRef} placeholder="P-001" />
                <Field label="العنوان الوطني" value={nationalAddr} onChange={setNationalAddr} placeholder="RRRD2929" />
              </div>
              {err && <p className="text-sm text-bad">{err}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-mut hover:bg-card2">
                إلغاء
              </button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-gold px-5 py-2 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-mut">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none"
      />
    </div>
  );
}
