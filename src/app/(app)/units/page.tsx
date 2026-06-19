"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Building, Plus, Trash2, Users } from "lucide-react";

const UNIT_TYPES = ["division", "unit", "team", "squad", "committee"] as const;

type Unit = {
  id: string;
  name: string;
  description: string | null;
  unit_type: string;
  parent_unit_id: string | null;
  department_id: string | null;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  lead_user_id: string | null;
  member_count: number;
};

type Member = { user_id: string; full_name: string | null };
type TeamMember = { id: string; user_id: string; user_name: string | null };

const INITIAL_UNITS: Unit[] = [
  { id: "u1", name: "قطاع العمليات", description: "القطاع المسؤول عن العمليات التشغيلية الرئيسية.", unit_type: "division", parent_unit_id: null, department_id: null },
  { id: "u2", name: "وحدة الدعم الفني", description: "الدعم التقني للأنظمة الداخلية.", unit_type: "unit", parent_unit_id: "u1", department_id: null },
  { id: "u3", name: "فريق تطوير المنتجات", description: "تطوير وتحسين المنتجات الرقمية.", unit_type: "team", parent_unit_id: "u1", department_id: null },
  { id: "u4", name: "لجنة المخاطر", description: "مراجعة وإدارة المخاطر المؤسسية.", unit_type: "committee", parent_unit_id: null, department_id: null },
];

const TENANT_MEMBERS: Member[] = [
  { user_id: "m1", full_name: "محمد المهنّا" },
  { user_id: "m2", full_name: "سارة العتيبي" },
  { user_id: "m3", full_name: "عبدالله القحطاني" },
  { user_id: "m4", full_name: "نورة الدوسري" },
  { user_id: "m5", full_name: "خالد الشمري" },
];

const INITIAL_TEAMS: Team[] = [
  { id: "t1", name: "فريق التحول الرقمي", description: "قيادة مبادرات التحول الرقمي.", lead_user_id: "m1", member_count: 3 },
  { id: "t2", name: "فريق خدمة العملاء", description: "تحسين تجربة العملاء.", lead_user_id: "m2", member_count: 2 },
  { id: "t3", name: "فريق الجودة", description: "ضمان جودة المخرجات.", lead_user_id: null, member_count: 0 },
];

const INITIAL_TEAM_MEMBERS: Record<string, TeamMember[]> = {
  t1: [
    { id: "tm1", user_id: "m1", user_name: "محمد المهنّا" },
    { id: "tm2", user_id: "m3", user_name: "عبدالله القحطاني" },
    { id: "tm3", user_id: "m4", user_name: "نورة الدوسري" },
  ],
  t2: [
    { id: "tm4", user_id: "m2", user_name: "سارة العتيبي" },
    { id: "tm5", user_id: "m5", user_name: "خالد الشمري" },
  ],
  t3: [],
};

export default function UnitsPage() {
  const [tab, setTab] = useState<"units" | "teams">("units");
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="space-y-6">
        <div className="grid grid-cols-2 w-full max-w-md gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("units")}
            className={cn("inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === "units" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Building className="size-4 ms-2" />الوحدات
          </button>
          <button
            type="button"
            onClick={() => setTab("teams")}
            className={cn("inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === "teams" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Users className="size-4 ms-2" />الفرق
          </button>
        </div>
        {tab === "units" ? <UnitsTab /> : <TeamsTab />}
      </div>
    </div>
  );
}

// ============= inlined Badge =============

function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "outline"; className?: string }) {
  const variants: Record<string, string> = {
    default: "border-transparent bg-primary text-primary-foreground",
    outline: "text-foreground border-border",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}

// ============= inlined Select =============

function Select({ value, onChange, placeholder, children, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === "" && "text-muted-foreground", className)}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {children}
    </select>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium leading-none">{children}</label>;
}

function UnitsTab() {
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Unit>>({ name: "", description: "", unit_type: "unit", parent_unit_id: "", department_id: "" });

  const resetEdit = () => setEdit({ name: "", description: "", unit_type: "unit", parent_unit_id: "", department_id: "" });

  const save = () => {
    if (!edit.name?.trim()) { toast.error("الاسم مطلوب"); return; }
    if (edit.id) {
      setUnits((prev) => prev.map((u) => u.id === edit.id ? {
        ...u, name: edit.name!, description: edit.description || null,
        unit_type: edit.unit_type ?? "unit", parent_unit_id: edit.parent_unit_id || null,
      } : u));
    } else {
      setUnits((prev) => [...prev, {
        id: `u${Date.now()}`, name: edit.name!, description: edit.description || null,
        unit_type: edit.unit_type ?? "unit", parent_unit_id: edit.parent_unit_id || null, department_id: null,
      }]);
    }
    toast.success("تم");
    setOpen(false);
  };

  const del = (id: string) => setUnits((prev) => prev.filter((u) => u.id !== id));

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">الوحدات والأقسام الفرعية</h2>
        <Button onClick={() => { resetEdit(); setOpen(true); }}><Plus className="size-4 ms-2" />وحدة جديدة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{edit.id ? "تعديل وحدة" : "وحدة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div>
                <Label>النوع</Label>
                <Select value={edit.unit_type ?? "unit"} onChange={(v) => setEdit({ ...edit, unit_type: v })}>
                  {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label>الوحدة الأم (اختياري)</Label>
                <Select value={edit.parent_unit_id || "_none"} onChange={(v) => setEdit({ ...edit, parent_unit_id: v === "_none" ? "" : v })} placeholder="—">
                  <option value="_none">— لا يوجد —</option>
                  {units.filter((u) => u.id !== edit.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </div>
              <div><Label>الوصف</Label><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start">
              <th className="text-start py-2 font-medium text-muted-foreground">الاسم</th>
              <th className="text-start py-2 font-medium text-muted-foreground">النوع</th>
              <th className="text-start py-2 font-medium text-muted-foreground">الوحدة الأم</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">لا توجد وحدات.</td></tr>}
            {units.map((u) => {
              const parent = units.find((x) => x.id === u.parent_unit_id);
              return (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2">
                    <div className="font-medium">{u.name}</div>
                    {u.description && <div className="text-xs text-muted-foreground">{u.description}</div>}
                  </td>
                  <td className="py-2"><Badge variant="outline">{u.unit_type}</Badge></td>
                  <td className="py-2 text-sm text-muted-foreground">{parent?.name ?? "—"}</td>
                  <td className="py-2 text-end">
                    <Button size="sm" variant="ghost" onClick={() => { setEdit({ ...u, description: u.description ?? "", parent_unit_id: u.parent_unit_id ?? "", department_id: u.department_id ?? "" }); setOpen(true); }}>تعديل</Button>
                    <Button size="icon" variant="ghost" onClick={() => del(u.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, TeamMember[]>>(INITIAL_TEAM_MEMBERS);
  const allMembers = TENANT_MEMBERS;
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Team>>({ name: "", description: "", lead_user_id: "" });
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState("");

  const mems = selectedTeam ? (teamMembersMap[selectedTeam] ?? []) : [];

  const resetEdit = () => setEdit({ name: "", description: "", lead_user_id: "" });

  const save = () => {
    if (!edit.name?.trim()) { toast.error("الاسم مطلوب"); return; }
    if (edit.id) {
      setTeams((prev) => prev.map((t) => t.id === edit.id ? { ...t, name: edit.name!, description: edit.description || null, lead_user_id: edit.lead_user_id || null } : t));
    } else {
      setTeams((prev) => [...prev, { id: `t${Date.now()}`, name: edit.name!, description: edit.description || null, lead_user_id: edit.lead_user_id || null, member_count: 0 }]);
    }
    toast.success("تم");
    setOpen(false);
  };

  const del = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (selectedTeam === id) setSelectedTeam(null);
  };

  const addMember = () => {
    if (!selectedTeam || !newMemberId) return;
    const m = allMembers.find((x) => x.user_id === newMemberId);
    if (!m) return;
    setTeamMembersMap((prev) => ({
      ...prev,
      [selectedTeam]: [...(prev[selectedTeam] ?? []), { id: `tm${Date.now()}`, user_id: m.user_id, user_name: m.full_name }],
    }));
    setTeams((prev) => prev.map((t) => t.id === selectedTeam ? { ...t, member_count: t.member_count + 1 } : t));
    setNewMemberId("");
  };

  const removeMember = (id: string) => {
    if (!selectedTeam) return;
    setTeamMembersMap((prev) => ({ ...prev, [selectedTeam]: (prev[selectedTeam] ?? []).filter((m) => m.id !== id) }));
    setTeams((prev) => prev.map((t) => t.id === selectedTeam ? { ...t, member_count: Math.max(0, t.member_count - 1) } : t));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="mulki-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">الفرق</h2>
          <Button onClick={() => { resetEdit(); setOpen(true); }}><Plus className="size-4 ms-2" />فريق جديد</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>{edit.id ? "تعديل فريق" : "فريق جديد"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الاسم</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
                <div>
                  <Label>قائد الفريق</Label>
                  <Select value={edit.lead_user_id || "_none"} onChange={(v) => setEdit({ ...edit, lead_user_id: v === "_none" ? "" : v })} placeholder="—">
                    <option value="_none">— لا يوجد —</option>
                    {allMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.user_id.slice(0, 8)}</option>)}
                  </Select>
                </div>
                <div><Label>الوصف</Label><Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {teams.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد فرق.</p>}
          {teams.map((t) => (
            <div key={t.id} className={`rounded-lg border p-3 cursor-pointer ${selectedTeam === t.id ? "border-primary bg-primary/5" : "border-border"}`} onClick={() => setSelectedTeam(t.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.member_count} عضو</div>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => { setEdit({ ...t, description: t.description ?? "", lead_user_id: t.lead_user_id ?? "" }); setOpen(true); }}>تعديل</Button>
                  <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mulki-card p-6">
        <h2 className="font-display text-xl font-semibold mb-4">أعضاء الفريق</h2>
        {!selectedTeam ? (
          <p className="text-center text-muted-foreground py-6">اختر فريقًا لعرض أعضائه.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Select value={newMemberId} onChange={setNewMemberId} placeholder="اختر مستخدمًا">
                {allMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.user_id.slice(0, 8)}</option>)}
              </Select>
              <Button onClick={addMember} disabled={!newMemberId}>إضافة</Button>
            </div>
            <div className="space-y-2">
              {mems.length === 0 && <p className="text-center text-muted-foreground py-4">لا أعضاء بعد.</p>}
              {mems.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <div>{m.user_name ?? m.user_id.slice(0, 8)}</div>
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
