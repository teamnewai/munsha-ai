"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مُلكي إدراك — إضافة عقد حقيقي: يربط وحدة + مستأجر (يُنشأ المستأجر تلقائياً في parties)
export function AddContract() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [units, setUnits] = useState<{ id: string; unit_no: string | null }[]>([]);

  const [unitId, setUnitId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [rent, setRent] = useState("");
  const [period, setPeriod] = useState("سنوي");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const configured = isSupabaseConfigured();

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
    if (!tenantName.trim()) { setErr("اسم المستأجر مطلوب."); return; }
    if (!unitId) { setErr("اختر وحدة (أضِف وحدة إن لم توجد)."); return; }
    setSaving(true);
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setErr("سجّل الدخول أولاً."); return; }
    const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!m?.org_id) { setSaving(false); setErr("لا توجد منشأة مرتبطة بحسابك."); return; }
    const orgId = m.org_id;

    // 1) إنشاء المستأجر (party)
    const { data: party, error: pErr } = await supabase
      .from("parties")
      .insert({ org_id: orgId, party_type: "tenant", full_name: tenantName.trim(), phone: tenantPhone.trim() || null })
      .select("id")
      .single();
    if (pErr || !party) { setSaving(false); setErr("تعذّر إنشاء المستأجر: " + (pErr?.message ?? "")); return; }

    // 2) إنشاء العقد
    const { error: cErr } = await supabase.from("contracts").insert({
      org_id: orgId,
      unit_id: unitId,
      tenant_id: party.id,
      annual_rent: rent ? Number(rent) : null,
      period,
      start_date: start || null,
      end_date: end || null,
      status: "active",
    });
    setSaving(false);
    if (cErr) { setErr("تعذّر حفظ العقد: " + cErr.message); return; }
    setTenantName(""); setTenantPhone(""); setRent(""); setStart(""); setEnd("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90">
        + عقد جديد
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-fg">عقد إيجار جديد</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-mut">الوحدة *</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={cls}>
                  {units.length === 0 && <option value="">— لا توجد وحدات —</option>}
                  {units.map((u) => <option key={u.id} value={u.id}>{u.unit_no ?? u.id.slice(0, 6)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">اسم المستأجر *</label>
                  <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="محمد العتيبي" className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">جوال المستأجر</label>
                  <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="05xxxxxxxx" className={cls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">الإيجار السنوي</label>
                  <input type="number" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="48000" className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">الفترة</label>
                  <input value={period} onChange={(e) => setPeriod(e.target.value)} className={cls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">البداية</label>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">النهاية</label>
                  <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={cls} />
                </div>
              </div>
              {err && <p className="text-sm text-bad">{err}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-mut hover:bg-card2">إلغاء</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-gold px-5 py-2 text-sm font-bold text-golddark hover:bg-gold/90 disabled:opacity-50">
                {saving ? "جارٍ الحفظ..." : "حفظ العقد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const cls = "w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg placeholder:text-mut/60 focus:border-gold focus:outline-none";
