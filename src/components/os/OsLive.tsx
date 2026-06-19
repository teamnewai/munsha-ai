"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Dept = { dept_key: string; name: string; icon: string | null; members: number };
type Agent = { dept_key: string | null; name: string; enabled: boolean };

export function OsLive() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [empCount, setEmpCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
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

      const [{ data: org }, { data: d }, { data: ag }, { data: mem }] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", m.org_id).maybeSingle(),
        supabase.from("org_departments").select("dept_key, name, icon").eq("org_id", m.org_id).order("sort"),
        supabase.from("ai_agents").select("dept_key, name, enabled").eq("org_id", m.org_id).eq("scope", "department"),
        supabase.from("dept_members").select("dept_key, present").eq("org_id", m.org_id),
      ]);

      setOrgName(org?.name ?? null);
      const members = mem ?? [];
      setEmpCount(members.length);
      setPresentCount(members.filter((x) => x.present).length);
      const byDept = new Map<string, number>();
      members.forEach((x) => byDept.set(x.dept_key, (byDept.get(x.dept_key) ?? 0) + 1));
      setDepts((d ?? []).map((x) => ({ ...x, members: byDept.get(x.dept_key) ?? 0 })));
      setAgents(ag ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="mt-8 text-center text-slate-400">جارٍ تحميل مكتبك...</p>;

  // لا توجد منشأة بعد → دعوة لإنشاء المكتب
  if (!hasOrg || depts.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-4xl">🏗️</div>
        <h2 className="mt-4 text-xl font-extrabold">لم تُنشئ مكتبك بعد</h2>
        <p className="mx-auto mt-2 max-w-md text-slate-300">
          أنشئ منشأتك ليتولّد الهيكل التنظيمي والإدارات ووكلاء الذكاء الاصطناعي والمكاتب الافتراضية تلقائياً.
        </p>
        <Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-gold-500 px-6 py-3 font-bold text-brand-950 hover:bg-gold-600">
          أنشئ مكتبك ←
        </Link>
      </div>
    );
  }

  const kpis = [
    { label: "الإدارات", value: String(depts.length), icon: "🏛️" },
    { label: "الموظفون", value: String(empCount), icon: "👥" },
    { label: "وكلاء AI", value: String(agents.length), icon: "🤖" },
    { label: "الحضور", value: empCount ? `${Math.round((presentCount / empCount) * 100)}%` : "—", icon: "🟢" },
  ];

  return (
    <>
      {orgName && <p className="mt-6 text-sm text-slate-400">منشأة: <span className="font-bold text-slate-100">{orgName}</span></p>}

      {/* مؤشرات فعلية */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">{k.icon}</div>
            <div className="mt-3 text-3xl font-extrabold text-gold-400">{k.value}</div>
            <div className="mt-1 text-sm text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      {/* المكاتب الافتراضية للإدارات */}
      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">المكاتب الافتراضية للإدارات</h2>
        <span className="text-xs text-slate-400">{depts.length} مكتب</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {depts.map((d) => {
          const agent = agents.find((a) => a.dept_key === d.dept_key);
          return (
            <Link
              key={d.dept_key}
              href={`/os/dept/${d.dept_key}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition-transform hover:-translate-y-1 hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{d.icon ?? "🏢"}</span>
                <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-slate-300">{d.members} موظف</span>
              </div>
              <h3 className="mt-3 font-bold">{d.name}</h3>
              {agent && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-300">🤖 {agent.name}</p>
              )}
              <span className="mt-3 inline-block text-sm font-bold text-gold-400 group-hover:underline">دخول المكتب ←</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
