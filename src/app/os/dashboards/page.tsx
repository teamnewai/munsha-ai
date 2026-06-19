"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { AiChat } from "@/components/os/AiChat";

type Dept = { dept_key: string; name: string; icon: string | null; operation_type: string | null; perf: number | null };
type Member = { full_name: string; dept_key: string; job_title: string | null; present: boolean; status: string };
type Agent = { name: string; dept_key: string | null; enabled: boolean };

const OP_LABEL: Record<string, string> = { human: "بشري", hybrid: "هجين", ai: "ذكاء اصطناعي" };

export default function DashboardsPage() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hasOrg, setHasOrg] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setLoading(false); return; }
      const supabase = createClient()!;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m?.org_id) { setLoading(false); return; }
      setHasOrg(true);
      const [{ data: org }, { data: d }, { data: mem }, { data: ag }] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", m.org_id).maybeSingle(),
        supabase.from("org_departments").select("dept_key, name, icon, operation_type, perf").eq("org_id", m.org_id).order("sort"),
        supabase.from("dept_members").select("full_name, dept_key, job_title, present, status").eq("org_id", m.org_id),
        supabase.from("ai_agents").select("name, dept_key, enabled").eq("org_id", m.org_id).eq("scope", "department"),
      ]);
      setOrgName(org?.name ?? null);
      setDepts(d ?? []);
      setMembers(mem ?? []);
      setAgents(ag ?? []);
      setLoading(false);
    })();
  }, []);

  const present = members.filter((m) => m.present).length;
  const activeAgents = agents.filter((a) => a.enabled).length;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/os" className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 hover:bg-white/10" title="رجوع">→</Link>
            <span className="text-sm font-extrabold">📊 لوحات التحكم الهرمية</span>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">🏠 لوحة التحكم</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-center text-slate-400">جارٍ التحميل...</p>
        ) : !hasOrg || depts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl">📊</div>
            <h1 className="mt-4 text-xl font-extrabold">لا توجد لوحات بعد</h1>
            <p className="mx-auto mt-2 max-w-md text-slate-300">أنشئ مكتبك ليتولّد الهيكل واللوحات الهرمية المرتبطة بالأدوار.</p>
            <Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-gold-500 px-6 py-3 font-bold text-brand-950 hover:bg-gold-600">أنشئ مكتبك ←</Link>
          </div>
        ) : (
          <>
            {orgName && <p className="text-sm text-slate-400">منشأة: <span className="font-bold text-slate-100">{orgName}</span></p>}

            {/* 1) لوحة المالك */}
            <Level badge="١" title="لوحة المالك" desc="رؤية شاملة لكل المكتب">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi icon="🏛️" value={depts.length} label="الإدارات" />
                <Kpi icon="👥" value={members.length} label="الموظفون" />
                <Kpi icon="🤖" value={agents.length} label="وكلاء AI" />
                <Kpi icon="🟢" value={members.length ? `${Math.round((present / members.length) * 100)}%` : "—"} label="الحضور" />
              </div>
            </Level>

            {/* مساعد المالك الذكي */}
            <div className="mt-4">
              <AiChat
                endpoint="/api/ai/owner"
                title="🧠 مساعد المالك الذكي — تحليل وتوصيات"
                placeholder="اسأل عن أداء منشأتك أو اطلب توصية…"
                emptyHint="مثال: ما أهم 3 مخاطر في منشأتي؟ · كيف أحسّن الحضور؟ · أي إدارة تحتاج دعماً؟"
                accent="gold"
                payload={{
                  orgName: orgName ?? "منشأتي",
                  summary:
                    `الإدارات (${depts.length}): ${depts.map((d) => `${d.name}${d.operation_type ? ` [${OP_LABEL[d.operation_type] ?? d.operation_type}]` : ""}`).join("، ")}\n` +
                    `الموظفون: ${members.length} (حاضرون ${present})\n` +
                    `وكلاء AI: ${agents.length} (نشطون ${activeAgents})`,
                }}
              />
            </div>

            {/* 2) اللوحة التنفيذية */}
            <Level badge="٢" title="اللوحة التنفيذية" desc="مؤشرات الأداء والمتابعة">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi icon="✅" value={`${activeAgents}/${agents.length}`} label="وكلاء AI نشطون" />
                <Kpi icon="🟢" value={present} label="حاضرون الآن" />
                <Kpi icon="📈" value={depts.length ? `${Math.round(depts.reduce((s, d) => s + (d.perf ?? 0), 0) / depts.length)}%` : "—"} label="متوسط الأداء" />
              </div>
            </Level>

            {/* 3) لوحات الإدارات */}
            <Level badge="٣" title="لوحات الإدارات" desc="كل إدارة ولوحتها — اضغط للدخول">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {depts.map((d) => {
                  const cnt = members.filter((m) => m.dept_key === d.dept_key).length;
                  return (
                    <Link key={d.dept_key} href={`/os/dept/${d.dept_key}`}
                      className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{d.icon ?? "🏢"}</span>
                        {d.operation_type && (
                          <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-slate-300">{OP_LABEL[d.operation_type] ?? d.operation_type}</span>
                        )}
                      </div>
                      <div className="mt-2 font-bold">{d.name}</div>
                      <div className="text-xs text-slate-400">{cnt} موظف</div>
                      <span className="mt-2 inline-block text-xs font-bold text-gold-400 group-hover:underline">فتح اللوحة ←</span>
                    </Link>
                  );
                })}
              </div>
            </Level>

            {/* 4) لوحة الموظفين */}
            <Level badge="٤" title="لوحة الموظفين" desc="كل الموظفين عبر الإدارات">
              {members.length ? (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                  <table className="w-full text-sm">
                    <thead className="text-slate-400">
                      <tr className="border-b border-white/10 text-right">
                        <th className="p-3">الاسم</th><th>الإدارة</th><th>المنصب</th><th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((mb, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="p-3 font-medium">{mb.full_name}</td>
                          <td className="text-slate-300">{depts.find((d) => d.dept_key === mb.dept_key)?.name ?? mb.dept_key}</td>
                          <td className="text-slate-300">{mb.job_title ?? "—"}</td>
                          <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${mb.present ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}>{mb.present ? "حاضر" : "غير حاضر"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty>لا يوجد موظفون بعد.</Empty>}
            </Level>

            {/* 5) لوحة وكلاء AI */}
            <Level badge="٥" title="لوحة وكلاء الذكاء الاصطناعي" desc="الوكلاء المولّدون لكل إدارة">
              {agents.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {agents.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <div>
                          <div className="text-sm font-bold">{a.name}</div>
                          <div className="text-xs text-slate-400">{depts.find((d) => d.dept_key === a.dept_key)?.name ?? a.dept_key}</div>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${a.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}>
                        {a.enabled ? "نشط" : "متوقف"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <Empty>لا وكلاء AI (نوع التشغيل بشري).</Empty>}
            </Level>
          </>
        )}
      </div>
    </div>
  );
}

function Level({ badge, title, desc, children }: { badge: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-500 text-sm font-extrabold text-brand-950">{badge}</span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Kpi({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-3xl font-extrabold text-gold-400">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-500">{children}</p>;
}
