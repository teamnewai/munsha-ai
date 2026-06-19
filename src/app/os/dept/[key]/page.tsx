"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { deptKnowledge, PERM_LABELS } from "@/lib/deptKnowledge";

type Dept = { dept_key: string; name: string; icon: string | null; mission: string | null };
type Member = { id: string; full_name: string; job_title: string | null; section: string | null; present: boolean; status: string };
type Agent = { name: string; persona: string | null; enabled: boolean };
type Role = { title: string; perms: string[] | null };

export default function DeptOfficePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dept, setDept] = useState<Dept | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);

  // نموذج إضافة موظف
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [job, setJob] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const supabase = createClient()!;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: m } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!m?.org_id) { setLoading(false); return; }
    setOrgId(m.org_id);

    const [{ data: d }, { data: secs }, { data: rls }, { data: mem }, { data: ag }] = await Promise.all([
      supabase.from("org_departments").select("dept_key, name, icon, mission").eq("org_id", m.org_id).eq("dept_key", key).maybeSingle(),
      supabase.from("org_sections").select("name").eq("org_id", m.org_id).eq("dept_key", key).order("sort"),
      supabase.from("org_roles").select("title, perms").eq("org_id", m.org_id).eq("dept_key", key).order("sort"),
      supabase.from("dept_members").select("id, full_name, job_title, section, present, status").eq("org_id", m.org_id).eq("dept_key", key).order("full_name"),
      supabase.from("ai_agents").select("name, persona, enabled").eq("org_id", m.org_id).eq("dept_key", key).eq("scope", "department").maybeSingle(),
    ]);
    setDept(d as Dept | null);
    setSections((secs ?? []).map((x) => x.name));
    setRoles((rls ?? []).map((x) => ({ title: x.title, perms: (x.perms as string[] | null) })) as Role[]);
    setMembers((mem ?? []) as Member[]);
    setAgent(ag as Agent | null);
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);

  // معرفة القسم: مهام · دورة مستندية · سياسات · حوكمة
  const k = dept ? deptKnowledge(dept.dept_key, dept.name) : null;

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!orgId || !name.trim()) { setMsg("اكتب اسم الموظف."); return; }
    setSaving(true);
    const supabase = createClient()!;
    const { error } = await supabase.from("dept_members").insert({
      org_id: orgId, dept_key: key, full_name: name.trim(),
      email: email.trim() || null, job_title: job || null, section: section || null,
      status: "active", present: false,
    });
    setSaving(false);
    if (error) { setMsg("تعذّر الحفظ: " + error.message); return; }
    setName(""); setEmail(""); setJob(""); setSection(""); setShowAdd(false);
    load();
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/os" className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 hover:bg-white/10" title="رجوع">→</Link>
            <span className="text-sm font-extrabold">{dept ? `${dept.icon ?? "🏢"} ${dept.name}` : "المكتب"}</span>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">🏠 لوحة التحكم</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-center text-slate-400">جارٍ التحميل...</p>
        ) : !dept ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">لم نجد هذا القسم في منشأتك.</p>
            <Link href="/os" className="mt-4 inline-block font-bold text-gold-400 hover:underline">← العودة للمكاتب</Link>
          </div>
        ) : (
          <>
            {/* رأس المكتب */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{dept.icon ?? "🏢"}</span>
                <div>
                  <h1 className="text-2xl font-extrabold">{dept.name}</h1>
                  {dept.mission && <p className="text-sm text-slate-400">{dept.mission}</p>}
                </div>
              </div>
              {agent && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <span className="text-lg">🤖</span>
                  <div>
                    <div className="font-bold text-emerald-300">{agent.name}</div>
                    {agent.persona && <div className="text-xs text-slate-300">{agent.persona}</div>}
                  </div>
                  <span className={`mr-auto rounded-full px-2 py-0.5 text-xs font-bold ${agent.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>
                    {agent.enabled ? "نشط" : "متوقف"}
                  </span>
                </div>
              )}
            </div>

            {/* الأقسام الفرعية */}
            <div className="mt-6">
              <Panel title={`الأقسام الفرعية (${sections.length})`}>
                {sections.length ? (
                  <div className="flex flex-wrap gap-2">
                    {sections.map((s) => <Chip key={s}>{s}</Chip>)}
                  </div>
                ) : <Empty>لا أقسام فرعية.</Empty>}
              </Panel>
            </div>

            {/* المناصب والصلاحيات */}
            <div className="mt-4">
              <Panel title={`المناصب الوظيفية والصلاحيات (${roles.length})`}>
                {roles.length ? (
                  <div className="space-y-2">
                    {roles.map((r) => (
                      <div key={r.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-bold">👤 {r.title}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(r.perms ?? []).length
                            ? (r.perms ?? []).map((p) => (
                                <span key={p} className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-bold text-gold-300">
                                  {PERM_LABELS[p] ?? p}
                                </span>
                              ))
                            : <span className="text-[11px] text-slate-500">لا صلاحيات محدّدة</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty>لا مناصب.</Empty>}
              </Panel>
            </div>

            {/* المهام · الدورة المستندية · السياسات · الحوكمة */}
            {k && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Panel title="المهام والواجبات">
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {k.duties.map((d) => <li key={d} className="flex gap-2"><span className="text-gold-400">✓</span>{d}</li>)}
                  </ul>
                </Panel>
                <Panel title="الدورة المستندية">
                  <ol className="space-y-1.5 text-sm text-slate-300">
                    {k.documentCycle.map((s, idx) => (
                      <li key={s} className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-500/15 text-[11px] font-bold text-gold-300">{idx + 1}</span>
                        {s}{idx < k.documentCycle.length - 1 && <span className="text-slate-600">→</span>}
                      </li>
                    ))}
                  </ol>
                </Panel>
                <Panel title="لائحة السياسات الداخلية">
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {k.policies.map((p) => <li key={p} className="flex gap-2"><span className="text-gold-400">§</span>{p}</li>)}
                  </ul>
                </Panel>
                <Panel title="الحوكمة">
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {k.governance.map((g) => <li key={g} className="flex gap-2"><span className="text-gold-400">⚖</span>{g}</li>)}
                  </ul>
                </Panel>
              </div>
            )}

            {/* محادثة وكيل القسم */}
            {agent && <AgentChat deptKey={dept.dept_key} deptName={dept.name} agentName={agent.name} />}

            {/* الموظفون + إضافة */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300">موظفو القسم ({members.length})</h3>
                <button onClick={() => setShowAdd((v) => !v)} className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-brand-950 hover:bg-gold-600">
                  {showAdd ? "إغلاق" : "＋ إضافة موظف"}
                </button>
              </div>

              {showAdd && (
                <form onSubmit={addMember} className="mb-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" className={inp} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد (اختياري)" className={inp} />
                  <select value={job} onChange={(e) => setJob(e.target.value)} className={inp}>
                    <option value="">— المسمى الوظيفي —</option>
                    {roles.map((r) => <option key={r.title} value={r.title} className="bg-[#0a0f1e]">{r.title}</option>)}
                  </select>
                  <select value={section} onChange={(e) => setSection(e.target.value)} className={inp}>
                    <option value="">— القسم الفرعي —</option>
                    {sections.map((s) => <option key={s} value={s} className="bg-[#0a0f1e]">{s}</option>)}
                  </select>
                  {msg && <p className="text-sm text-rose-300 sm:col-span-2">{msg}</p>}
                  <button type="submit" disabled={saving} className="rounded-lg bg-gold-500 py-2 text-sm font-bold text-brand-950 hover:bg-gold-600 disabled:opacity-60 sm:col-span-2">
                    {saving ? "جارٍ الحفظ..." : "حفظ الموظف"}
                  </button>
                </form>
              )}

              {members.length ? (
                <div className="space-y-2">
                  {members.map((mb) => (
                    <div key={mb.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                      <div>
                        <div className="text-sm font-medium">{mb.full_name}</div>
                        <div className="text-xs text-slate-400">{mb.job_title ?? "—"}{mb.section ? ` · ${mb.section}` : ""}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${mb.present ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}>
                        {mb.present ? "حاضر" : "غير حاضر"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <Empty>لا يوجد موظفون بعد — أضف أول موظف.</Empty>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inp = "rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-gold-500 focus:outline-none";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 text-sm font-bold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">{children}</span>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

// محادثة حيّة مع وكيل القسم
function AgentChat({ deptKey, deptName, agentName }: { deptKey: string; deptName: string; agentName: string }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deptKey, deptName, agentName, messages: next }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data?.reply || "تعذّر الرد." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "تعذّر الاتصال بالوكيل." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-white/5 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-300">💬 محادثة {agentName}</h3>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <p className="text-sm text-slate-500">اسأل وكيل القسم عن المهام أو الإجراءات أو السياسات…</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "bg-white/10 text-slate-100" : "bg-emerald-500/15 text-emerald-100"
            }`}>
              {m.role === "assistant" && <span className="mb-0.5 block text-[10px] text-emerald-300">🤖 {agentName}</span>}
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-end text-xs text-emerald-300">يكتب…</p>}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب رسالتك للوكيل…"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          إرسال
        </button>
      </form>
    </div>
  );
}
