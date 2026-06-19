"use client";

import { useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Users, ShieldAlert, Check } from "lucide-react";

// ---------- types ----------
type CatalogPerm = { key: string; label: string; category: string };
type PermSet = { id: string; name: string; description: string | null; permissions: string[]; assignee_count: number };
type Member = { user_id: string; full_name: string | null };
type Assignment = { id: string; user_id: string; user_name: string | null; set_name: string; created_at: string };
type Override = { id: string; user_id: string; user_name: string | null; permission_key: string; effect: "grant" | "deny"; reason: string | null };

// ---------- mock data ----------
const CATALOG: CatalogPerm[] = [
  { key: "workflows.view", label: "عرض المعاملات", category: "المعاملات" },
  { key: "workflows.approve", label: "اعتماد المعاملات", category: "المعاملات" },
  { key: "workflows.manage", label: "إدارة سير العمل", category: "المعاملات" },
  { key: "forms.view", label: "عرض النماذج", category: "النماذج" },
  { key: "forms.manage", label: "إدارة النماذج", category: "النماذج" },
  { key: "forms.submit", label: "تقديم النماذج", category: "النماذج" },
  { key: "people.view", label: "عرض الموظفين", category: "الموارد البشرية" },
  { key: "people.manage", label: "إدارة الموظفين", category: "الموارد البشرية" },
  { key: "reports.view", label: "عرض التقارير", category: "التقارير" },
  { key: "reports.export", label: "تصدير التقارير", category: "التقارير" },
  { key: "settings.manage", label: "إدارة الإعدادات", category: "النظام" },
  { key: "permissions.manage", label: "إدارة الصلاحيات", category: "النظام" },
];

const INITIAL_SETS: PermSet[] = [
  { id: "s1", name: "مدير عام", description: "صلاحيات كاملة على جميع الوحدات", permissions: ["workflows.view", "workflows.approve", "workflows.manage", "forms.manage", "people.manage", "reports.view", "reports.export", "settings.manage", "permissions.manage"], assignee_count: 2 },
  { id: "s2", name: "موظف موارد بشرية", description: "إدارة شؤون الموظفين والنماذج", permissions: ["people.view", "people.manage", "forms.view", "forms.submit"], assignee_count: 5 },
  { id: "s3", name: "محاسب", description: "الاطلاع على التقارير المالية", permissions: ["reports.view", "reports.export", "workflows.view"], assignee_count: 3 },
  { id: "s4", name: "موظف عام", description: "صلاحيات أساسية للموظفين", permissions: ["forms.view", "forms.submit", "workflows.view"], assignee_count: 18 },
];

const MEMBERS: Member[] = [
  { user_id: "u1", full_name: "سعد العتيبي" },
  { user_id: "u2", full_name: "نورة القحطاني" },
  { user_id: "u3", full_name: "خالد الدوسري" },
  { user_id: "u4", full_name: "هند المطيري" },
  { user_id: "u5", full_name: "فهد الشمري" },
];

const INITIAL_ASSIGNMENTS: Assignment[] = [
  { id: "a1", user_id: "u1", user_name: "سعد العتيبي", set_name: "مدير عام", created_at: "2026-05-12" },
  { id: "a2", user_id: "u2", user_name: "نورة القحطاني", set_name: "موظف موارد بشرية", created_at: "2026-05-20" },
  { id: "a3", user_id: "u3", user_name: "خالد الدوسري", set_name: "محاسب", created_at: "2026-06-01" },
];

const INITIAL_OVERRIDES: Override[] = [
  { id: "o1", user_id: "u4", user_name: "هند المطيري", permission_key: "reports.export", effect: "grant", reason: "مهمة مؤقتة لإعداد التقرير السنوي" },
  { id: "o2", user_id: "u5", user_name: "فهد الشمري", permission_key: "settings.manage", effect: "deny", reason: "إيقاف مؤقت لمراجعة أمنية" },
];

// ---------- inline UI helpers ----------
function Badge({ variant = "default", className, children }: { variant?: "default" | "outline" | "destructive" | "secondary"; className?: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", map[variant], className)}>{children}</span>;
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>;
}

function Checkbox({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "size-4 shrink-0 rounded border border-border grid place-items-center transition-colors mt-0.5",
        checked ? "bg-primary border-primary text-primary-foreground" : "bg-transparent",
      )}
    >
      {checked && <Check className="size-3" />}
    </button>
  );
}

function NativeSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder?: string; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ---------- page ----------
type TabKey = "sets" | "assignments" | "overrides";

export default function PermissionsPage() {
  const [tab, setTab] = useState<TabKey>("sets");
  const tabs: { key: TabKey; label: string; Icon: typeof KeyRound }[] = [
    { key: "sets", label: "مجموعات الصلاحيات", Icon: KeyRound },
    { key: "assignments", label: "التعيينات", Icon: Users },
    { key: "overrides", label: "استثناءات فردية", Icon: ShieldAlert },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="space-y-6">
        <div className="grid grid-cols-3 w-full max-w-2xl rounded-lg bg-muted p-1 text-muted-foreground">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                tab === key ? "bg-background text-foreground shadow" : "hover:text-foreground",
              )}
            >
              <Icon className="size-4 ms-2" />{label}
            </button>
          ))}
        </div>
        {tab === "sets" && <SetsTab />}
        {tab === "assignments" && <AssignmentsTab />}
        {tab === "overrides" && <OverridesTab />}
      </div>
    </div>
  );
}

function SetsTab() {
  const [sets, setSets] = useState<PermSet[]>(INITIAL_SETS);
  const perms = CATALOG;
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; permissions: string[] }>({
    name: "", description: "", permissions: [],
  });
  const byCat = useMemo(() => {
    const m: Record<string, CatalogPerm[]> = {};
    for (const p of perms) (m[p.category] = m[p.category] ?? []).push(p);
    return m;
  }, [perms]);

  const save = () => {
    if (!edit.name) { toast.error("الاسم مطلوب"); return; }
    setSets((prev) => {
      if (edit.id) {
        return prev.map((s) => (s.id === edit.id ? { ...s, name: edit.name, description: edit.description || null, permissions: edit.permissions } : s));
      }
      return [...prev, { id: `s${Date.now()}`, name: edit.name, description: edit.description || null, permissions: edit.permissions, assignee_count: 0 }];
    });
    toast.success("تم الحفظ");
    setOpen(false);
  };
  const del = (id: string) => { setSets((prev) => prev.filter((s) => s.id !== id)); toast.success("تم الحذف"); };

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">مجموعات الصلاحيات</h2>
        <Button onClick={() => { setEdit({ name: "", description: "", permissions: [] }); setOpen(true); }}><Plus className="size-4 ms-2" />مجموعة جديدة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "تعديل المجموعة" : "مجموعة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>الاسم</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div>
                <Label className="mb-2 block">الصلاحيات</Label>
                <div className="space-y-3">
                  {Object.entries(byCat).map(([cat, items]) => (
                    <div key={cat} className="rounded-lg border border-border p-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{cat}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((p) => (
                          <label key={p.key} className="flex items-start gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={edit.permissions.includes(p.key)}
                              onCheckedChange={(v) =>
                                setEdit({
                                  ...edit,
                                  permissions: v
                                    ? [...edit.permissions, p.key]
                                    : edit.permissions.filter((k) => k !== p.key),
                                })
                              }
                            />
                            <div><div>{p.label}</div><div className="text-[10px] font-mono text-muted-foreground">{p.key}</div></div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sets.length === 0 && <Card className="p-8 text-center text-muted-foreground md:col-span-2">لا توجد مجموعات.</Card>}
        {sets.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.permissions.length} صلاحية • {s.assignee_count} مستخدم</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit({ id: s.id, name: s.name, description: s.description ?? "", permissions: s.permissions }); setOpen(true); }}>تعديل</Button>
                <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
            {s.description && <p className="text-sm text-muted-foreground mt-2">{s.description}</p>}
            <div className="flex flex-wrap gap-1 mt-3">
              {s.permissions.slice(0, 6).map((k) => <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>)}
              {s.permissions.length > 6 && <Badge variant="outline" className="text-[10px]">+{s.permissions.length - 6}</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

function AssignmentsTab() {
  const [rows, setRows] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const allSets = INITIAL_SETS;
  const allMembers = MEMBERS;
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [setId, setSetId] = useState("");

  const assign = () => {
    const member = allMembers.find((m) => m.user_id === userId);
    const set = allSets.find((s) => s.id === setId);
    if (!member || !set) return;
    setRows((prev) => [...prev, { id: `a${Date.now()}`, user_id: userId, user_name: member.full_name, set_name: set.name, created_at: new Date().toISOString() }]);
    toast.success("تم التعيين");
    setOpen(false);
    setUserId(""); setSetId("");
  };
  const revoke = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">تعيين الصلاحيات للمستخدمين</h2>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />تعيين</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تعيين مجموعة صلاحيات</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>المستخدم</Label>
                <NativeSelect value={userId} onChange={setUserId} placeholder="اختر مستخدمًا"
                  options={allMembers.map((m) => ({ value: m.user_id, label: m.full_name ?? m.user_id.slice(0, 8) }))} />
              </div>
              <div><Label>المجموعة</Label>
                <NativeSelect value={setId} onChange={setSetId} placeholder="اختر مجموعة"
                  options={allSets.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
            </div>
            <DialogFooter><Button onClick={assign} disabled={!userId || !setId}>تعيين</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المستخدم</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المجموعة</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">التاريخ</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.length === 0 && <tr className="border-b border-border"><td colSpan={4} className="text-center text-muted-foreground py-8">لا توجد تعيينات.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="p-2 align-middle">{r.user_name ?? r.user_id.slice(0, 8)}</td>
                <td className="p-2 align-middle"><Badge variant="outline">{r.set_name}</Badge></td>
                <td className="p-2 align-middle text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
                <td className="p-2 align-middle"><Button size="icon" variant="ghost" onClick={() => revoke(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OverridesTab() {
  const [rows, setRows] = useState<Override[]>(INITIAL_OVERRIDES);
  const allMembers = MEMBERS;
  const perms = CATALOG;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ user_id: string; permission_key: string; effect: "grant" | "deny"; reason: string }>({
    user_id: "", permission_key: "", effect: "grant", reason: "",
  });

  const save = () => {
    const member = allMembers.find((m) => m.user_id === f.user_id);
    if (!member || !f.permission_key) { toast.error("الحقول مطلوبة"); return; }
    setRows((prev) => [...prev, { id: `o${Date.now()}`, user_id: f.user_id, user_name: member.full_name, permission_key: f.permission_key, effect: f.effect, reason: f.reason || null }]);
    toast.success("تم");
    setOpen(false);
    setF({ user_id: "", permission_key: "", effect: "grant", reason: "" });
  };

  return (
    <Card className="mulki-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">استثناءات فردية</h2>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 ms-2" />استثناء</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>استثناء فردي</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>المستخدم</Label>
                <NativeSelect value={f.user_id} onChange={(v) => setF({ ...f, user_id: v })} placeholder="اختر"
                  options={allMembers.map((m) => ({ value: m.user_id, label: m.full_name ?? m.user_id.slice(0, 8) }))} />
              </div>
              <div><Label>الصلاحية</Label>
                <NativeSelect value={f.permission_key} onChange={(v) => setF({ ...f, permission_key: v })} placeholder="اختر"
                  options={perms.map((p) => ({ value: p.key, label: `${p.label} (${p.key})` }))} />
              </div>
              <div><Label>الأثر</Label>
                <NativeSelect value={f.effect} onChange={(v) => setF({ ...f, effect: v as "grant" | "deny" })}
                  options={[{ value: "grant", label: "منح" }, { value: "deny", label: "منع" }]} />
              </div>
              <div><Label>السبب</Label><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b border-border">
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">المستخدم</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الصلاحية</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الأثر</th>
              <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">السبب</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.length === 0 && <tr className="border-b border-border"><td colSpan={4} className="text-center text-muted-foreground py-8">لا توجد استثناءات.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="p-2 align-middle">{r.user_name ?? r.user_id.slice(0, 8)}</td>
                <td className="p-2 align-middle font-mono text-xs">{r.permission_key}</td>
                <td className="p-2 align-middle"><Badge variant={r.effect === "grant" ? "default" : "destructive"}>{r.effect === "grant" ? "منح" : "منع"}</Badge></td>
                <td className="p-2 align-middle text-sm text-muted-foreground">{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
