"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { checkLimit } from "@/lib/planClient";

// مُلكي إدراك — إضافة عضو فريق حقيقي (CRUD)
// تكتب في dept_members ضمن منشأة المستخدم (RLS تضمن العزل).
// المطلوب فعلياً: org_id + dept_key + full_name (الباقي اختياري بقيَم افتراضية).

interface Dept {
  dept_key: string;
  name: string;
  icon: string | null;
}

const ROLES: [string, string][] = [
  ["manager", "مدير القسم"],
  ["supervisor", "مشرف"],
  ["member", "عضو"],
];

export function AddTeamMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [job, setJob] = useState("");
  const [deptKey, setDeptKey] = useState("");
  const [role, setRole] = useState("member");
  const [section, setSection] = useState("");

  const configured = isSupabaseConfigured();

  // حمّل أقسام المنشأة لتعبئة القائمة عند فتح النموذج
  useEffect(() => {
    if (!open || !configured) return;
    (async () => {
      const supabase = createClient()!;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!m?.org_id) return;
      const { data } = await supabase
        .from("org_departments")
        .select("dept_key, name, icon")
        .eq("org_id", m.org_id)
        .order("sort", { ascending: true });
      const list = (data as Dept[]) ?? [];
      setDepts(list);
      if (list.length && !deptKey) setDeptKey(list[0].dept_key);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configured]);

  async function save() {
    setErr(null);
    if (!name.trim()) {
      setErr("اسم العضو مطلوب.");
      return;
    }
    if (!deptKey) {
      setErr("اختر القسم.");
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
    // فرض حدّ الباقة (المرحلة 13)
    const limitMsg = await checkLimit(m.org_id, "users");
    if (limitMsg) {
      setSaving(false);
      setErr(limitMsg);
      return;
    }
    const { error } = await supabase.from("dept_members").insert({
      org_id: m.org_id,
      dept_key: deptKey,
      full_name: name.trim(),
      email: email.trim() || null,
      job_title: job.trim() || null,
      role_in_dept: role,
      section: section.trim() || null,
      status: "active",
      present: false,
    });
    setSaving(false);
    if (error) {
      setErr("تعذّر الحفظ: " + error.message);
      return;
    }
    setName(""); setEmail(""); setJob(""); setSection(""); setRole("member");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-golddark hover:bg-gold/90"
      >
        + دعوة عضو
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-fg">إضافة عضو فريق</h2>
            <div className="mt-4 space-y-3">
              <Field label="الاسم الكامل *" value={name} onChange={setName} placeholder="مثال: أحمد العتيبي" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="البريد الإلكتروني" value={email} onChange={setEmail} placeholder="name@company.com" />
                <Field label="المنصب" value={job} onChange={setJob} placeholder="محاسب أول" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">القسم *</label>
                  <select
                    value={deptKey}
                    onChange={(e) => setDeptKey(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none"
                  >
                    {depts.length === 0 && <option value="">— لا توجد أقسام —</option>}
                    {depts.map((d) => (
                      <option key={d.dept_key} value={d.dept_key}>
                        {(d.icon ? d.icon + " " : "") + d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-mut">الدور</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none"
                  >
                    {ROLES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Field label="القسم الفرعي / الفريق" value={section} onChange={setSection} placeholder="المحاسبة" />
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
