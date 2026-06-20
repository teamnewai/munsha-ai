"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import { Building, Users, Layers, RefreshCw, Loader2, Crown, ArrowLeft } from "lucide-react";
import { getOrgStructure, type StructDept, type StructSection } from "@/app/actions/structure";
import { getOrgMembers, type OrgMember } from "@/app/actions/org";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold border-border text-foreground", className)}>{children}</span>;
}

export default function UnitsPage() {
  const [tab, setTab] = useState<"units" | "teams">("units");
  const [depts, setDepts] = useState<StructDept[]>([]);
  const [sections, setSections] = useState<StructSection[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [s, m] = await Promise.all([getOrgStructure(), getOrgMembers()]);
    if (s.ok) { setDepts(s.depts); setSections(s.sections); setLive(true); }
    if (m.ok) setMembers(m.members);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const selectedMembers = selected ? members.filter((m) => m.deptKey === selected) : [];

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Building className="size-6 text-primary" /> الوحدات والفرق
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            {live && <><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> بيانات حقيقية من الهيكل التنظيمي</>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /></Button>
      </div>

      <div className="grid grid-cols-2 w-full max-w-md gap-1 rounded-lg bg-muted p-1">
        <button type="button" onClick={() => setTab("units")} className={cn("inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === "units" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Building className="size-4 ms-2" />الوحدات
        </button>
        <button type="button" onClick={() => setTab("teams")} className={cn("inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === "teams" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Users className="size-4 ms-2" />الفرق
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="size-5 animate-spin" /> جاري التحميل...</div>
      ) : tab === "units" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {depts.map((d) => {
            const subs = sections.filter((s) => s.dept_key === d.key);
            return (
              <Card key={d.key} className="mulki-card p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl grid place-items-center" style={{ backgroundColor: `${d.color}22`, color: d.color }}>
                      <Building className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{d.name}</h3>
                      <div className="text-xs text-muted-foreground">{d.staffCount} موظف · أداء {d.perf}%</div>
                    </div>
                  </div>
                  <Link href={`/department/${d.key}`}><Button size="sm" variant="ghost" className="gap-1 text-xs">دخول <ArrowLeft className="size-3" /></Button></Link>
                </div>
                {d.mission && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{d.mission}</p>}
                <div className="border-t border-border pt-3">
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1"><Layers className="size-3" /> الأقسام الفرعية ({subs.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {subs.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : subs.map((s) => (
                      <Badge key={s.name} className="bg-muted/50">{s.name}</Badge>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4">الفرق (حسب الإدارة)</h2>
            <div className="space-y-2">
              {depts.map((d) => {
                const count = members.filter((m) => m.deptKey === d.key).length;
                return (
                  <div key={d.key} className={cn("rounded-lg border p-3 cursor-pointer transition-colors", selected === d.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")} onClick={() => setSelected(d.key)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{count} عضو</div>
                        </div>
                      </div>
                      <ArrowLeft className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4">أعضاء الفريق</h2>
            {!selected ? (
              <p className="text-center text-muted-foreground py-6">اختر فريقًا لعرض أعضائه.</p>
            ) : selectedMembers.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">لا أعضاء في هذا الفريق.</p>
            ) : (
              <div className="space-y-2">
                {selectedMembers.map((m) => (
                  <Link key={m.id} href={`/workspace/${m.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:border-primary/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", m.present ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        <div>
                          <div className="text-sm font-medium flex items-center gap-1.5">{m.name}{m.roleInDept === "head" && <Crown className="size-3 text-amber-500" />}</div>
                          <div className="text-[11px] text-muted-foreground">{m.title || (m.roleInDept === "head" ? "مدير الإدارة" : "موظف")}</div>
                        </div>
                      </div>
                      <ArrowLeft className="size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
