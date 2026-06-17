"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — إضافة طرف (مالك/مستأجر) حقيقي (CRUD)
// تكتب في parties ضمن منشأة المستخدم. المطلوب فعلياً: org_id + party_type.
// RLS: «parties org» (is_org_member(org_id)).

export function AddParty({ partyType }: { partyType: "owner" | "tenant" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");

  const configured = isSupabaseConfigured();
  const label = partyType === "owner" ? "مالك" : "مستأجر";

  async function save() {
    setErr(null);
    if (!name.trim()) {
      setErr(`اسم ال${label} مطلوب.`);
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
    const { error } = await supabase.from("parties").insert({
      org_id: m.org_id,
      party_type: partyType,
      full_name: name.trim(),
      national_id: nationalId.trim() || null,
      phone: phone.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErr("تعذّر الحفظ: " + error.message);
      return;
    }
    setName(""); setNationalId(""); setPhone("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90"
      >
        + إضافة {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-fg">إضافة {label} جديد</h2>
            <div className="mt-4 space-y-3">
              <Field label="الاسم الكامل *" value={name} onChange={setName} placeholder={partyType === "owner" ? "مثال: شركة العليا العقارية" : "مثال: عبدالله الشهري"} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="الهوية / السجل" value={nationalId} onChange={setNationalId} placeholder="1xxxxxxxxx" />
                <Field label="الجوال" value={phone} onChange={setPhone} placeholder="05xxxxxxxx" />
              </div>
              {err && <p className="text-sm text-bad">{err}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-mut hover:bg-card2">إلغاء</button>
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
