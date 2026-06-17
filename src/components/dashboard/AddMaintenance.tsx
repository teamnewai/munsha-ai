"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — إضافة طلب صيانة حقيقي (مستوى الموافقة يُحتسب تلقائياً في قاعدة البيانات)
export function AddMaintenance() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [units, setUnits] = useState<{ id: string; unit_no: string | null }[]>([]);

  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");

  const configured = isSupabaseConfigured();
  const costNum = Number(cost) || 0;
  const level = costNum <= 500 ? "تلقائي ✅" : costNum <= 2000 ? "موافقة مدير" : "موافقة مالك";

  useEffect(() => {
    if (!open || !configured) return;
    (async () => {
      const supabase = createClient()!;
      const { data } = await supabase.from("units").select("id, unit_no").limit(500);
      const list = (data as { id: string; unit_no: string | null }[]) ?? [];
      setUnits(list);
      if (list[0]) setUnitId(list[0].id);
    })();
  }, [open, configured]);

  async function save() {
    setErr(null);
    if (!configured) { setErr("الوضع التجريبي: اربط Supabase وسجّل الدخول للحفظ فعلياً."); return; }
    if (!title.trim()) { setErr("عنوان الطلب مطلوب."); return; }
    setSaving(true);
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setErr("سجّل الدخول أولاً."); return; }
    const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!m?.org_id) { setSaving(false); setErr("لا توجد منشأة مرتبطة بحسابك."); return; }

    const { error } = await supabase.from("maintenance_requests").insert({
      org_id: m.org_id,
      unit_id: unitId || null,
      title: title.trim(),
      description: description.trim() || null,
      estimated_cost: cost ? Number(cost) : null,
      status: "open",
    });
    setSaving(false);
    if (error) { setErr("تعذّر الحفظ: " + error.message); return; }
    setTitle(""); setDescription(""); setCost("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90">
        + طلب صيانة
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-fg">طلب صيانة جديد</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">الوحدة (اختياري)</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={cls}>
                  <option value="">— بدون وحدة —</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.unit_no ?? u.id.slice(0, 6)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">عنوان الطلب *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عطل تكييف" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">الوصف</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">التكلفة التقديرية (ر.س)</label>
                <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={cls} />
                <p className="mt-1 text-xs text-mut">مستوى الموافقة: <span className="font-bold text-gold">{level}</span></p>
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

const cls = "w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none";
