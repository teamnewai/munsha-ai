"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Search, Building2, Crown, Mail, Calendar, ShieldCheck, Loader2 } from "lucide-react";
import { getOrgMembers, type OrgMember } from "@/app/actions/org";

type Agent = { id: string; name: string; title: string | null; archetype: string; system_prompt: string; avatar_url: string | null; is_active: boolean };

type Person = {
  id: string;
  name: string;
  title: string;
  kind: "agent" | "employee";
  deptKey: string | null;
  departmentName: string;
  deptColor: string;
  active: boolean;
  isHead: boolean;
};

// ============= static AI agents (always shown) =============

const AGENTS: Agent[] = [
  { id: "ag1", name: "نور", title: "المساعد التنفيذي الذكي", archetype: "executive", system_prompt: "أساعد القيادة في إدارة الأعمال اليومية واتخاذ القرارات المدعومة بالبيانات.", avatar_url: null, is_active: true },
  { id: "ag2", name: "راصد", title: "وكيل المراجعة المالية", archetype: "finance", system_prompt: "أراجع المعاملات المالية آلياً وأكشف الانحرافات والمخالفات في الوقت الحقيقي.", avatar_url: null, is_active: true },
  { id: "ag3", name: "كاشف", title: "محلل البيانات", archetype: "analytics", system_prompt: "أحلل بيانات الأداء وأقدم رؤى وتقارير ذكية لدعم القرار.", avatar_url: null, is_active: true },
  { id: "ag4", name: "فارز", title: "وكيل التوظيف الذكي", archetype: "hr", system_prompt: "أفرز السير الذاتية وأرتب المرشحين وفق معايير الوظيفة.", avatar_url: null, is_active: false },
];

export default function PeoplePage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [depts, setDepts] = useState<{ key: string; name: string; color: string }[]>([]);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "mission" | "off">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getOrgMembers().then((res) => {
      if (res.ok) {
        setMembers(res.members);
        setDepts(res.depts);
      }
      setLoading(false);
    });
  }, []);

  const people: Person[] = useMemo(() => {
    const fromAgents: Person[] = AGENTS.map((a) => ({
      id: `a:${a.id}`,
      name: a.name,
      title: a.title ?? a.archetype,
      kind: "agent",
      deptKey: null,
      departmentName: "الذكاء الاصطناعي",
      deptColor: "#C9A24B",
      active: a.is_active,
      isHead: false,
    }));
    const fromMembers: Person[] = members.map((m) => ({
      id: m.id,
      name: m.name,
      title: m.title,
      kind: "employee",
      deptKey: m.deptKey,
      departmentName: m.deptName,
      deptColor: m.deptColor,
      active: m.present && !m.suspended,
      isHead: m.roleInDept === "head",
    }));
    return [...fromAgents, ...fromMembers];
  }, [members]);

  const deptCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) {
      if (p.deptKey) m.set(p.deptKey, (m.get(p.deptKey) ?? 0) + 1);
    }
    return m;
  }, [people]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (deptFilter !== "all" && p.deptKey !== deptFilter) return false;
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "off" && p.active) return false;
      if (query && !`${p.name} ${p.title} ${p.departmentName}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [people, deptFilter, statusFilter, query]);

  const selected = useMemo(
    () => filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  return (
    <>
      <div className="bg-[#060A10] min-h-[calc(100vh-3.5rem)] p-4 lg:p-8" dir="rtl">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar — filters */}
          <aside className="col-span-12 lg:col-span-3 bg-[#0B1220] border border-[#C9A24B]/20 rounded-2xl p-6 flex flex-col gap-7">
            <div className="space-y-1.5">
              <h2 className="text-[#C9A24B] text-[11px] uppercase tracking-[0.22em] opacity-70 font-serif">Management Filters</h2>
              <h3 className="text-2xl text-white font-bold">تصفية الكوادر</h3>
            </div>

            <div className="space-y-3">
              <label className="text-gray-400 text-sm flex items-center gap-2"><Building2 className="size-3.5" /> الإدارة</label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mulki-scroll">
                <FilterButton active={deptFilter === "all"} onClick={() => setDeptFilter("all")} label="كل الإدارات" count={people.filter((p) => p.deptKey).length} />
                {depts.map((d) => (
                  <FilterButton
                    key={d.key}
                    active={deptFilter === d.key}
                    onClick={() => setDeptFilter(d.key)}
                    label={d.name}
                    count={deptCounts.get(d.key) ?? 0}
                    color={d.color}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-gray-400 text-sm">الحالة التشغيلية</label>
              <div className="flex flex-wrap gap-2">
                <StatusPill active={statusFilter === "active"} onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")} tone="green">نشط حالياً</StatusPill>
                <StatusPill active={statusFilter === "mission"} onClick={() => setStatusFilter(statusFilter === "mission" ? "all" : "mission")} tone="gold">في مهمة</StatusPill>
                <StatusPill active={statusFilter === "off"} onClick={() => setStatusFilter(statusFilter === "off" ? "all" : "off")} tone="muted">إجازة</StatusPill>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#C9A24B]/20 to-transparent border border-[#C9A24B]/10">
                <p className="text-xs text-gray-400 mb-1">إجمالي القوى العاملة</p>
                <p className="text-3xl font-light text-[#C9A24B] font-serif">{people.length}</p>
                <p className="text-[10px] text-gray-500 mt-1">{AGENTS.length} وكيل ذكي · {members.length} موظف</p>
              </div>
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <span className="text-[10px] text-green-400 font-medium">بيانات حقيقية</span>
              </div>
            </div>
          </aside>

          {/* Center — list */}
          <main className="col-span-12 lg:col-span-6 flex flex-col gap-4">
            <div className="relative w-full">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="البحث عن وكيل أو موظف..."
                className="w-full bg-[#0B1220] border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-white placeholder:text-gray-500 focus:border-[#C9A24B]/50 focus:outline-none transition-all"
              />
              <Search className="absolute right-3 top-3.5 text-gray-500 size-4" />
            </div>

            <div className="flex-1 overflow-y-auto mulki-scroll space-y-3 pr-1 max-h-[calc(100vh-12rem)]">
              {loading ? (
                <div className="p-10 text-center text-gray-400 border border-white/5 rounded-2xl bg-[#0B1220] flex flex-col items-center gap-3">
                  <Loader2 className="size-6 animate-spin text-[#C9A24B]" />
                  <span className="text-sm">جاري تحميل البيانات...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-500 border border-white/5 rounded-2xl bg-[#0B1220]">
                  لا توجد نتائج مطابقة.
                </div>
              ) : (
                filtered.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    selected={selected?.id === p.id}
                    onSelect={() => setSelectedId(p.id)}
                  />
                ))
              )}
            </div>
          </main>

          {/* Detail card */}
          <section className="col-span-12 lg:col-span-3 bg-[#0B1220] border border-[#C9A24B]/20 rounded-2xl overflow-hidden flex flex-col">
            {selected ? <PersonDetail person={selected} /> : (
              <div className="p-10 text-center text-gray-500">اختر شخصاً لعرض ملفه</div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        .mulki-scroll::-webkit-scrollbar { width: 4px; }
        .mulki-scroll::-webkit-scrollbar-track { background: transparent; }
        .mulki-scroll::-webkit-scrollbar-thumb { background: rgba(201,162,75,0.2); border-radius: 10px; }
        .mulki-scroll::-webkit-scrollbar-thumb:hover { background: rgba(201,162,75,0.4); }
      `}</style>
    </>
  );
}

function FilterButton({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex justify-between items-center p-3 rounded-lg text-sm transition-all border ${
        active
          ? "bg-[#C9A24B]/10 border-[#C9A24B]/30 text-[#C9A24B]"
          : "hover:bg-white/5 border-transparent text-gray-400"
      }`}
    >
      <div className="flex items-center gap-2 truncate text-right">
        {color && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        )}
        <span className="truncate">{label}</span>
      </div>
      <span className={active ? "bg-[#C9A24B] text-black text-[10px] px-2 py-0.5 rounded-full" : "text-xs"}>
        {count.toString().padStart(2, "0")}
      </span>
    </button>
  );
}

function StatusPill({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: "green" | "gold" | "muted"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    green: active ? "bg-green-500/20 text-green-400 border-green-500/40" : "bg-green-500/10 text-green-500 border-green-500/20",
    gold: active ? "bg-[#C9A24B]/20 text-[#C9A24B] border-[#C9A24B]/40" : "bg-white/5 text-gray-400 border-white/10",
    muted: active ? "bg-white/10 text-white border-white/20" : "bg-white/5 text-gray-400 border-white/10",
  };
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-md text-xs border transition-all ${tones[tone]}`}>
      {children}
    </button>
  );
}

function Avatar({ name, kind, size = 56, active = true, gold = false, isHead = false }: { name: string; kind: "agent" | "employee"; size?: number; active?: boolean; gold?: boolean; isHead?: boolean }) {
  const initial = name.trim().charAt(0) || "?";
  return (
    <div
      className={`rounded-full p-0.5 overflow-hidden flex items-center justify-center bg-[#10192C] ${
        gold ? "border-2 border-[#C9A24B]" : "border border-white/10"
      } relative`}
      style={{ width: size, height: size }}
    >
      <div className={`w-full h-full rounded-full flex items-center justify-center font-serif text-[#C9A24B] ${kind === "agent" ? "bg-gradient-to-br from-[#C9A24B]/20 to-transparent" : "bg-gradient-to-br from-white/5 to-transparent"}`}>
        {kind === "agent" ? <Bot className="size-1/2" /> : <span className="text-xl">{initial}</span>}
      </div>
      {active && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0B1220]" />
      )}
      {isHead && (
        <span className="absolute top-0 left-0 w-3 h-3 rounded-full bg-[#C9A24B] border border-[#0B1220] flex items-center justify-center">
          <Crown className="size-1.5 text-[#060A10]" />
        </span>
      )}
    </div>
  );
}

function PersonRow({ person, selected, onSelect }: { person: Person; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`group w-full text-right p-4 rounded-2xl border transition-all cursor-pointer ${
        selected
          ? "bg-gradient-to-l from-[#C9A24B]/10 to-transparent border-[#C9A24B]/40"
          : "bg-[#0B1220] border-white/5 hover:border-[#C9A24B]/30"
      }`}
    >
      <div className="flex items-center gap-4">
        <Avatar name={person.name} kind={person.kind} active={person.active} gold={selected} isHead={person.isHead} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold truncate ${selected ? "text-white" : "text-white/80 group-hover:text-white transition-colors"}`}>{person.name}</h4>
            {person.kind === "agent" && <span className="text-[9px] uppercase tracking-wider text-[#C9A24B]/70 border border-[#C9A24B]/30 px-1.5 py-0.5 rounded">AI</span>}
            {person.isHead && <span className="text-[9px] uppercase tracking-wider text-amber-400/70 border border-amber-400/30 px-1.5 py-0.5 rounded">رئيس</span>}
          </div>
          <p className="text-xs text-gray-400 truncate">{person.title}</p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: person.deptColor + "99" }}>{person.departmentName}</p>
        </div>
        <div className={`shrink-0 ${selected ? "" : "opacity-40 group-hover:opacity-100 transition-opacity"}`}>
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: person.active ? "#22c55e" : "#4b5563" }}
          />
        </div>
      </div>
    </button>
  );
}

function PersonDetail({ person }: { person: Person }) {
  const router = useRouter();
  return (
    <>
      <div className="h-32 bg-gradient-to-b from-[#C9A24B]/25 to-transparent relative">
        <div className="absolute -bottom-12 right-1/2 translate-x-1/2">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B1220] ring-2 ring-[#C9A24B] overflow-hidden bg-[#10192C] flex items-center justify-center">
            <Avatar name={person.name} kind={person.kind} size={88} active={person.active} isHead={person.isHead} />
          </div>
        </div>
        <Crown className="absolute top-3 right-3 size-4 text-[#C9A24B]/60" />
      </div>

      <div className="pt-14 px-6 pb-5 text-center space-y-1 border-b border-white/5">
        <h3 className="text-xl text-white font-bold leading-tight">{person.name}</h3>
        <p className="text-[#C9A24B] text-sm">{person.title}</p>
        <p className="text-xs text-gray-500">{person.departmentName}</p>
        {person.isHead && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full">
            <Crown className="size-2.5" /> رئيس الإدارة
          </span>
        )}
      </div>

      <div className="p-6 flex-1 space-y-6 overflow-y-auto mulki-scroll">
        <div className="grid grid-cols-2 gap-3">
          <KpiTile label="كفاءة الإنجاز" value="94%" gold />
          <KpiTile label="المهام النشطة" value="12" />
          <KpiTile label="الحضور" value={person.active ? "حاضر" : "غائب"} gold />
          <KpiTile label="الدور" value={person.isHead ? "رئيس" : "عضو"} />
        </div>

        <div className="space-y-3">
          {person.kind === "employee" ? (
            <Link
              href={`/workspace/${person.id}`}
              className="w-full block bg-[#C9A24B] text-[#060A10] font-semibold py-3 rounded-xl shadow-[0_0_20px_rgba(201,162,75,0.2)] hover:shadow-[0_0_30px_rgba(201,162,75,0.35)] transition-all text-center"
            >
              دخول مكتب الموظف
            </Link>
          ) : (
            <button
              onClick={() => router.push("/meetings")}
              className="w-full bg-[#C9A24B] text-[#060A10] font-semibold py-3 rounded-xl shadow-[0_0_20px_rgba(201,162,75,0.2)] hover:shadow-[0_0_30px_rgba(201,162,75,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Calendar className="size-4" />
              طلب اجتماع عاجل
            </button>
          )}
          <button
            onClick={() => {
              if (person.kind === "employee") router.push(`/workspace/${person.id}`);
              else router.push("/noor");
            }}
            className="w-full border border-white/10 hover:border-[#C9A24B]/50 text-white/80 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Mail className="size-4" /> عرض الملف الكامل
          </button>
          <button
            onClick={() => {
              if (person.kind === "employee") router.push("/access");
              else router.push("/noor");
            }}
            className="w-full text-[#C9A24B] text-sm font-medium py-2 hover:underline cursor-pointer flex items-center justify-center gap-1"
          >
            <ShieldCheck className="size-3.5" /> طلب منح صلاحيات وصول
          </button>
        </div>
      </div>

      <div className="mt-auto p-4 bg-[#C9A24B]/5 border-t border-[#C9A24B]/10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${person.active ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-xs text-gray-400">{person.active ? "متواجد الآن" : "غير متصل"}</span>
          </div>
          <span className="text-[10px] text-gray-600 font-serif">ID: #{person.id.slice(0, 6).toUpperCase()}</span>
        </div>
      </div>
    </>
  );
}

function KpiTile({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
      <p className="text-[10px] text-gray-500 uppercase mb-1">{label}</p>
      <p className={`text-lg font-bold ${gold ? "text-[#C9A24B]" : "text-white"}`}>{value}</p>
    </div>
  );
}
