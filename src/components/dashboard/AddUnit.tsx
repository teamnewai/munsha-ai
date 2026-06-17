"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const UNIT_TYPES = [
  { v: "apartment", l: "شقة" }, { v: "room", l: "غرفة" }, { v: "studio", l: "استوديو" },
  { v: "villa", l: "فيلا" }, { v: "shop", l: "محل" }, { v: "office", l: "مكتب" },
  { v: "land", l: "أرض" }, { v: "warehouse", l: "مستودع" },
];

// مُلكي إدراك — إضافة وحدة حقيقية (تابعة لعقار) ضمن منشأة المستخدم (RLS)
export function AddUnit() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [unitType, setUnitType] = useState("apartment");
  const [area, setArea] = useState("");
  const [occupancy, setOccupancy] = useState("vacant");

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!open || !configured) return;
    (async () => {
      const supabase = createClient()!;
      const { data } = await supabase.from("properties").select("id, name").order("created_at", { ascending: false });
      const list = (data as { id: string; name: string }[]) ?? [];
      setProperties(list);
      if (list[0]) setPropertyId(list[0].id);
    })();
  }, [open, configured]);

  async function save() {
    setErr(null);
    if (!configured) { setErr("الوضع التجريبي: اربط Supabase وسجّل الدخول للحفظ فعلياً."); return; }
    if (!propertyId) { setErr("اختر عقاراً أولاً (أضِف عقاراً إن لم يوجد)."); return; }
    if (!unitNo.trim()) { setErr("رقم الوحدة مطلوب."); return; }
    setSaving(true);
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setErr("سجّل الدخول أولاً."); return; }
    const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!m?.org_id) { setSaving(false); setErr("لا توجد منشأة مرتبطة بحسابك."); return; }

    const { error } = await supabase.from("units").insert({
      org_id: m.org_id,
      property_id: propertyId,
      unit_no: unitNo.trim(),
      unit_type: unitType,
      area: area ? Number(area) : null,
      occupancy,
    });
    setSaving(false);
    if (error) { setErr("تعذّر الحفظ: " + error.message); return; }
    setUnitNo(""); setArea(""); setOccupancy("vacant");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90">
        + إضافة وحدة
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-fg">إضافة وحدة جديدة</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">العقار *</label>
                <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={selCls}>
                  {properties.length === 0 && <option value="">— لا توجد عقارات —</option>}
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">رقم الوحدة *</label>
                  <input value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="A-204" className={selCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">النوع</label>
                  <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className={selCls}>
                    {UNIT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">المساحة (م²)</label>
                  <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="120" className={selCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">الإشغال</label>
                  <select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className={selCls}>
                    <option value="vacant">شاغرة</option>
                    <option value="occupied">مشغولة</option>
                  </select>
                </div>
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

const selCls = "w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none";
