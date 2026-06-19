"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// مركز التحكم — مرجع: Blueprint §2.11 (للمالك/المدير فقط)
const TABS = [
  { key: "perms", label: "سحب صلاحية", icon: "🔑" },
  { key: "services", label: "سحب الخدمات", icon: "🔌" },
  { key: "grants", label: "منح المنصّات", icon: "🎫" },
  { key: "staff", label: "إدارة الموظفين", icon: "👥" },
  { key: "seats", label: "مقاعد المكتب", icon: "💺" },
  { key: "deletes", label: "موافقات الحذف", icon: "🗑️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STAFF = [
  { n: "أحمد العتيبي", dept: "المالية", role: "محاسب أول", status: "نشط" },
  { n: "سارة القحطاني", dept: "المبيعات", role: "مدير مبيعات", status: "نشط" },
  { n: "خالد الدوسري", dept: "الصيانة", role: "مشرف صيانة", status: "موقوف" },
];

const PLATFORMS = ["Microsoft 365", "Google Workspace", "Zoom", "Slack", "Dropbox", "HubSpot", "Salesforce", "Trello"];

const DELETES = [
  { t: "حذف عقد منتهٍ — وحدة D-401", by: "سارة القحطاني", reason: "انتهى منذ سنتين" },
  { t: "حذف مزوّد خدمة مكرّر", by: "أحمد العتيبي", reason: "مدخل بالخطأ" },
];

export default function ControlCenter() {
  const [tab, setTab] = useState<TabKey>("perms");

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              🎛️
            </span>
            <span className="text-sm font-extrabold">مركز التحكم</span>
          </Link>
          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300">
            المالك / المدير العام فقط
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* التبويبات */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-gold-500 text-brand-950" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          {tab === "perms" && <PermissionsControl />}

          {tab === "services" && (
            <Section title="سحب / إيقاف / تعديل الخدمة" desc="تحكّم بحالة خدمة أعضاء الأقسام.">
              <div className="space-y-2">
                {STAFF.map((s) => (
                  <Rowline key={s.n} title={s.n} sub={`${s.dept} · ${s.role}`}>
                    <Badge tone={s.status === "نشط" ? "emerald" : "rose"}>{s.status}</Badge>
                    <Btn>{s.status === "نشط" ? "إيقاف" : "إعادة تفعيل"}</Btn>
                    <Btn danger>إنهاء الخدمة</Btn>
                  </Rowline>
                ))}
              </div>
            </Section>
          )}

          {tab === "grants" && (
            <Section title="منح المنصّات" desc="منح أو سحب وصول المنشأة للمنصّات الخارجية.">
              <div className="grid gap-3 sm:grid-cols-2">
                {PLATFORMS.map((p, i) => (
                  <Rowline key={p} title={p}>
                    <Badge tone={i < 3 ? "emerald" : "slate"}>{i < 3 ? "ممنوح" : "غير مفعّل"}</Badge>
                    <Btn>{i < 3 ? "سحب" : "منح"}</Btn>
                  </Rowline>
                ))}
              </div>
            </Section>
          )}

          {tab === "staff" && (
            <Section title="إدارة الموظفين" desc="الأدوار والصلاحيات والأقسام.">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-white/10 text-right">
                      <th className="py-2">الاسم</th><th>القسم</th><th>المنصب</th><th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAFF.map((s) => (
                      <tr key={s.n} className="border-b border-white/5">
                        <td className="py-2.5 font-medium">{s.n}</td>
                        <td className="text-slate-300">{s.dept}</td>
                        <td className="text-slate-300">{s.role}</td>
                        <td><Badge tone={s.status === "نشط" ? "emerald" : "rose"}>{s.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {tab === "seats" && (
            <Section title="مقاعد المكتب" desc="تخصيص مقاعد Microsoft 365 و Google Workspace.">
              <div className="grid gap-4 sm:grid-cols-2">
                <SeatCard platform="Microsoft 365" used={8} total={12} />
                <SeatCard platform="Google Workspace" used={3} total={5} />
              </div>
            </Section>
          )}

          {tab === "deletes" && (
            <Section title="موافقات الحذف" desc="سير عمل الحذف الآمن — لا حذف إلا بموافقة.">
              <div className="space-y-2">
                {DELETES.map((d) => (
                  <Rowline key={d.t} title={d.t} sub={`طلب بواسطة ${d.by} · ${d.reason}`}>
                    <Btn>اعتماد الحذف</Btn>
                    <Btn danger>رفض</Btn>
                  </Rowline>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── تبويب «سحب صلاحية» — مربوط بـ permission_suspensions + dept_permissions_ref ── */
const PERM_CATALOG: { key: string; label: string }[] = [
  { key: "view", label: "الاطّلاع" },
  { key: "create", label: "الإضافة" },
  { key: "edit", label: "التعديل" },
  { key: "delete", label: "الحذف" },
  { key: "approve", label: "الاعتماد" },
  { key: "finance", label: "العمليات المالية" },
  { key: "reports", label: "التقارير" },
  { key: "manage_members", label: "إدارة الموظفين" },
];
const permLabel = (action: string) =>
  action === "all" ? "جميع الصلاحيات" : PERM_CATALOG.find((p) => p.key === action)?.label ?? action;

type Member = { id: string; full_name: string; dept_key: string | null; job_title: string | null };
type Suspension = { id: string; target: string | null; action: string; reason: string | null; created_at: string };

function PermissionsControl() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [memberId, setMemberId] = useState("");
  const [action, setAction] = useState("view");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient()!;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: m } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!m?.org_id) {
      setLoading(false);
      return;
    }
    setOrgId(m.org_id);
    const [{ data: mem }, { data: sus }] = await Promise.all([
      supabase
        .from("dept_members")
        .select("id, full_name, dept_key, job_title")
        .eq("org_id", m.org_id)
        .order("full_name"),
      supabase
        .from("permission_suspensions")
        .select("id, target, action, reason, created_at")
        .eq("org_id", m.org_id)
        .order("created_at", { ascending: false }),
    ]);
    setMembers(mem ?? []);
    setSuspensions(sus ?? []);
    if (mem && mem.length > 0) setMemberId((cur) => cur || mem[0].id);
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  async function suspend() {
    setMsg(null);
    if (!orgId || !memberId) {
      setMsg("اختر موظفاً أولاً.");
      return;
    }
    setBusy(true);
    const supabase = createClient()!;
    const { error } = await supabase.from("permission_suspensions").insert({
      org_id: orgId,
      scope: "member",
      target: memberId,
      action, // صلاحية محددة أو 'all'
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg("تعذّر السحب: " + error.message);
      return;
    }
    setReason("");
    setMsg("✅ تم سحب الصلاحية.");
    load();
  }

  async function restore(id: string) {
    const supabase = createClient()!;
    const { error } = await supabase.from("permission_suspensions").delete().eq("id", id);
    if (!error) setSuspensions((s) => s.filter((x) => x.id !== id));
  }

  const nameOf = (target: string | null) =>
    members.find((m) => m.id === target)?.full_name ?? "موظف";

  if (loading) return <Section title="سحب صلاحية محددة" desc="جارٍ التحميل..."><div /></Section>;

  if (!configured || (!orgId && members.length === 0))
    return (
      <Section title="سحب صلاحية محددة" desc="سجّل الدخول وافتح مكتبك أولاً لإدارة صلاحيات الموظفين.">
        <p className="text-sm text-slate-400">لا توجد بيانات موظفين بعد.</p>
      </Section>
    );

  return (
    <Section
      title="سحب صلاحية محددة"
      desc="اسحب صلاحية واحدة بعينها (وليس كل الصلاحيات) من موظف، مع إمكانية الإرجاع."
    >
      {/* نموذج السحب */}
      <div className="grid gap-3 sm:grid-cols-12">
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm sm:col-span-4"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id} className="bg-[#0a0f1e]">
              {m.full_name}
              {m.job_title ? ` — ${m.job_title}` : ""}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm sm:col-span-3"
        >
          {PERM_CATALOG.map((p) => (
            <option key={p.key} value={p.key} className="bg-[#0a0f1e]">
              {p.label}
            </option>
          ))}
          <option value="all" className="bg-[#0a0f1e]">
            جميع الصلاحيات
          </option>
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري)"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm sm:col-span-3"
        />
        <button
          onClick={suspend}
          disabled={busy}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 sm:col-span-2"
        >
          {busy ? "..." : "سحب الصلاحية"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-slate-200">{msg}</p>}

      {/* الصلاحيات المسحوبة حالياً */}
      <div className="mt-6">
        <div className="mb-2 text-sm font-bold text-slate-300">الصلاحيات المسحوبة ({suspensions.length})</div>
        {suspensions.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد صلاحيات مسحوبة.</p>
        ) : (
          <div className="space-y-2">
            {suspensions.map((s) => (
              <Rowline
                key={s.id}
                title={nameOf(s.target)}
                sub={`${permLabel(s.action)}${s.reason ? ` · ${s.reason}` : ""}`}
              >
                <Badge tone={s.action === "all" ? "rose" : "slate"}>{permLabel(s.action)}</Badge>
                <button
                  onClick={() => restore(s.id)}
                  className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  إرجاع
                </button>
              </Rowline>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── عناصر ── */
function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{desc}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}
function Rowline({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
function Badge({ tone, children }: { tone: "emerald" | "rose" | "slate"; children: React.ReactNode }) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-300",
    rose: "bg-rose-500/15 text-rose-300",
    slate: "bg-slate-500/15 text-slate-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>{children}</span>;
}
function Btn({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
        danger ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-white/10 text-slate-200 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}
function SeatCard({ platform, used, total }: { platform: string; used: number; total: number }) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between">
        <span className="font-bold">{platform}</span>
        <span className="text-sm text-slate-400">{used} / {total}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
      </div>
      <button className="mt-4 w-full rounded-lg bg-white/10 py-2 text-xs font-bold text-slate-200 hover:bg-white/20">
        تخصيص مقعد
      </button>
    </div>
  );
}
