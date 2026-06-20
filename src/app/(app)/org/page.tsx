"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { getOrgStructure } from "@/app/actions/structure";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Bot, GitBranch, Sparkles, FileText, Shield, Workflow,
  Layers, BadgeCheck, ClipboardList, KeyRound, ScrollText, Target, CheckCircle2, DoorOpen,
  Wrench, Headphones, ShoppingCart, Folder, BarChart3, Briefcase, HardDrive, Award,
  Crown, UserCircle2, Mail, Phone, Calendar, ListChecks, FileCheck, TrendingUp,
  UsersRound, FileBarChart, Send, ShieldCheck, Settings, ChevronDown, ChevronLeft, User,
} from "lucide-react";

type Dept = { id: string; name: string; mission: string | null };
type Sec = { id: string; department_id: string; name: string; description: string | null };
type Role = {
  id: string; department_id: string | null; title: string; level: string | null;
  mission: string | null; default_assignee: "human" | "ai" | "hybrid";
  responsibilities: string[]; kpis: string[]; perms: string[];
};
type DocCycle = { id: string; name: string; description: string | null; document_type: string | null; department_id: string | null; stages: { name?: string; actor?: string }[] };
type Policy = { id: string; kind: string; title: string; version: number; status: string; body_markdown: string };
type Authority = { id: string; action_key: string; action_label: string; principal_kind: string; amount_limit: number | null; currency: string | null };

const ASSIGNEE_LABEL: Record<Role["default_assignee"], string> = {
  human: "بشري",
  ai: "ذكاء اصطناعي",
  hybrid: "هجين",
};

const POLICY_KIND_LABEL: Record<string, string> = {
  hr: "الموارد البشرية",
  finance: "المالية",
  it: "تقنية المعلومات",
  ethics: "أخلاقيات العمل",
  disclosure: "الإفصاح",
  governance: "الحوكمة",
  general: "عامة",
};

// ============= static mock data (visual only) =============

const DEPTS: Dept[] = [
  { id: "d1", name: "الإدارة المالية", mission: "إدارة الموارد المالية للمؤسسة وضمان الاستدامة المالية والشفافية في جميع المعاملات." },
  { id: "d2", name: "الموارد البشرية", mission: "استقطاب وتطوير الكوادر البشرية وضمان بيئة عمل محفّزة ومنتجة." },
  { id: "d3", name: "إدارة العقارات", mission: "إدارة المحفظة العقارية وعمليات الوساطة وإدارة الممتلكات." },
  { id: "d4", name: "التشغيل والخدمات", mission: "الإشراف على العمليات التشغيلية اليومية وضمان جودة الخدمات المقدمة." },
  { id: "d5", name: "المبيعات والتسويق", mission: "تطوير قنوات المبيعات وتنفيذ الحملات التسويقية لزيادة الحصة السوقية." },
  { id: "d6", name: "تقنية المعلومات", mission: "تطوير البنية التقنية وأنظمة المعلومات ودعم التحول الرقمي." },
  { id: "d7", name: "الجودة والامتثال", mission: "ضمان الالتزام بالمعايير والسياسات وتطبيق أنظمة إدارة الجودة." },
];

const SECS: Sec[] = [
  { id: "s1", department_id: "d1", name: "المحاسبة", description: "إعداد القيود والتقارير المالية الدورية." },
  { id: "s2", department_id: "d1", name: "الميزانية والتخطيط", description: "إعداد الموازنات ومتابعة الأداء المالي." },
  { id: "s3", department_id: "d1", name: "المدفوعات والمستحقات", description: "إدارة المدفوعات والتحصيل." },
  { id: "s4", department_id: "d2", name: "التوظيف", description: "استقطاب الكفاءات وإدارة عمليات التعيين." },
  { id: "s5", department_id: "d2", name: "التدريب والتطوير", description: "تصميم وتنفيذ برامج التدريب." },
  { id: "s6", department_id: "d3", name: "الوساطة العقارية", description: "تسويق وبيع وتأجير العقارات." },
  { id: "s7", department_id: "d3", name: "إدارة الأملاك", description: "تشغيل وصيانة العقارات المُدارة." },
  { id: "s8", department_id: "d4", name: "خدمة العملاء", description: "استقبال ومعالجة طلبات العملاء." },
  { id: "s9", department_id: "d6", name: "تطوير البرمجيات", description: "بناء وصيانة الأنظمة الداخلية." },
];

const ROLES: Role[] = [
  { id: "r1", department_id: "d1", title: "المدير المالي", level: "إدارة عليا", mission: "الإشراف على جميع العمليات المالية والاستراتيجية المالية للمؤسسة.", default_assignee: "human", responsibilities: ["إعداد الموازنة السنوية", "الإشراف على التقارير المالية", "إدارة التدفقات النقدية", "اعتماد المصروفات الكبرى"], kpis: ["دقة التقارير المالية 99%", "خفض التكاليف التشغيلية 8%", "الالتزام بمواعيد الإقفال الشهري"], perms: ["fin.approve", "fin.view", "doc.sign"] },
  { id: "r2", department_id: "d1", title: "محاسب أول", level: "إشرافي", mission: "إعداد القيود المحاسبية ومراجعة الحسابات.", default_assignee: "human", responsibilities: ["تسجيل القيود اليومية", "مطابقة الحسابات البنكية"], kpis: ["إقفال شهري في الوقت المحدد"], perms: ["fin.view", "doc.create"] },
  { id: "r3", department_id: "d1", title: "وكيل المراجعة الذكي", level: "آلي", mission: "مراجعة آلية للمعاملات المالية وكشف الانحرافات.", default_assignee: "ai", responsibilities: ["فحص المعاملات تلقائياً", "رصد المخالفات المالية"], kpis: ["كشف 100% من الانحرافات"], perms: ["fin.view", "gov.audit"] },
  { id: "r4", department_id: "d2", title: "مدير الموارد البشرية", level: "إدارة عليا", mission: "قيادة استراتيجية رأس المال البشري.", default_assignee: "human", responsibilities: ["إدارة سياسات التوظيف", "تطوير برامج الحوافز"], kpis: ["معدل الاحتفاظ بالموظفين 92%"], perms: ["hr.manage", "hr.payroll", "doc.sign"] },
  { id: "r5", department_id: "d2", title: "أخصائي توظيف", level: "تنفيذي", mission: "إدارة دورة التوظيف الكاملة.", default_assignee: "hybrid", responsibilities: ["فرز السير الذاتية", "إجراء المقابلات"], kpis: ["مدة التوظيف < 30 يوم"], perms: ["hr.manage", "doc.create"] },
  { id: "r6", department_id: "d3", title: "مدير العقارات", level: "إدارة عليا", mission: "إدارة المحفظة العقارية وتعظيم العوائد.", default_assignee: "human", responsibilities: ["تطوير المحفظة العقارية", "متابعة عقود الإيجار"], kpis: ["نسبة الإشغال 95%"], perms: ["doc.sign", "doc.create"] },
  { id: "r7", department_id: "d4", title: "مدير التشغيل", level: "إدارة عليا", mission: "ضمان كفاءة العمليات التشغيلية.", default_assignee: "human", responsibilities: ["تحسين العمليات", "إدارة الجودة التشغيلية"], kpis: ["رضا العملاء 90%"], perms: ["doc.create", "gov.audit"] },
  { id: "r8", department_id: "d5", title: "مدير المبيعات", level: "إدارة عليا", mission: "تحقيق أهداف المبيعات وتنمية السوق.", default_assignee: "human", responsibilities: ["وضع خطط المبيعات", "إدارة فريق المبيعات"], kpis: ["نمو المبيعات 15% سنوياً"], perms: ["doc.create", "fin.view"] },
  { id: "r9", department_id: "d6", title: "مدير تقنية المعلومات", level: "إدارة عليا", mission: "قيادة التحول الرقمي والبنية التقنية.", default_assignee: "human", responsibilities: ["إدارة البنية التحتية", "أمن المعلومات"], kpis: ["جاهزية الأنظمة 99.9%"], perms: ["gov.audit", "doc.sign"] },
  { id: "r10", department_id: "d7", title: "مدير الجودة", level: "إدارة عليا", mission: "ضمان الامتثال وتطبيق معايير الجودة.", default_assignee: "human", responsibilities: ["تدقيق العمليات", "إدارة شهادات الجودة"], kpis: ["اجتياز عمليات التدقيق 100%"], perms: ["gov.audit", "fin.view"] },
];

// مرجع تسميات الصلاحيات المعروفة — يُستخدم لعرض اسم مقروء لمفتاح الصلاحية
const PERM_CATALOG: Record<string, { category: string; label: string }> = {
  "fin.approve": { category: "المالية", label: "اعتماد المصروفات" },
  "fin.view": { category: "المالية", label: "عرض التقارير المالية" },
  "hr.manage": { category: "الموارد البشرية", label: "إدارة الموظفين" },
  "hr.payroll": { category: "الموارد البشرية", label: "إدارة الرواتب" },
  "doc.create": { category: "المستندات", label: "إنشاء المستندات" },
  "doc.sign": { category: "المستندات", label: "التوقيع الإلكتروني" },
  "gov.audit": { category: "الحوكمة", label: "تدقيق العمليات" },
};

// يحوّل مفتاح صلاحية إلى تسمية/تصنيف مقروء، مع تراجع آمن للمفتاح نفسه
function permInfo(key: string): { category: string; label: string } {
  return PERM_CATALOG[key] ?? { category: "أخرى", label: key };
}

// يبني مجموعات الصلاحيات من الأدوار الحقيقية: لكل إدارة، الصلاحيات الفعلية المسندة لأدوارها
function buildPermGroups(depts: Dept[], roles: Role[]): { id: string; name: string; description: string | null; permKeys: string[] }[] {
  return depts
    .map((d) => {
      const deptRoles = roles.filter((r) => r.department_id === d.id);
      const keys = Array.from(new Set(deptRoles.flatMap((r) => r.perms)));
      return { id: d.id, name: d.name, description: `صلاحيات أدوار «${d.name}» (${deptRoles.length} دور)`, permKeys: keys };
    })
    .filter((g) => g.permKeys.length > 0);
}

const CYCLES: DocCycle[] = [
  { id: "c1", name: "دورة اعتماد المصروفات", description: "مسار اعتماد طلبات الصرف المالي.", document_type: "مالي", department_id: "d1", stages: [{ name: "تقديم الطلب", actor: "الموظف" }, { name: "مراجعة المحاسبة", actor: "محاسب أول" }, { name: "اعتماد المدير المالي", actor: "المدير المالي" }] },
  { id: "c2", name: "دورة طلب الإجازة", description: "مسار اعتماد طلبات الإجازات.", document_type: "موارد بشرية", department_id: "d2", stages: [{ name: "تقديم الطلب", actor: "الموظف" }, { name: "موافقة المدير المباشر", actor: "المدير" }, { name: "اعتماد الموارد البشرية", actor: "مدير الموارد البشرية" }] },
  { id: "c3", name: "دورة عقد الإيجار", description: "مسار إصدار واعتماد عقود الإيجار.", document_type: "عقاري", department_id: "d3", stages: [{ name: "إعداد العقد", actor: "وسيط عقاري" }, { name: "المراجعة القانونية", actor: "مستشار" }, { name: "الاعتماد النهائي", actor: "مدير العقارات" }] },
];

const POLICIES: Policy[] = [
  { id: "po1", kind: "hr", title: "سياسة الموارد البشرية", version: 2, status: "active", body_markdown: "تحدد هذه السياسة الإطار العام لإدارة شؤون الموظفين بما في ذلك التوظيف والترقيات والإجازات والانضباط الوظيفي وفق أنظمة العمل المعتمدة في المملكة العربية السعودية وبما يضمن العدالة والشفافية في جميع الإجراءات." },
  { id: "po2", kind: "finance", title: "سياسة الصرف المالي", version: 3, status: "active", body_markdown: "تنظم هذه السياسة إجراءات الصرف والاعتماد المالي وحدود الصلاحيات المالية لكل مستوى إداري وآليات الرقابة الداخلية على المصروفات لضمان حسن استخدام الموارد المالية." },
  { id: "po3", kind: "it", title: "سياسة أمن المعلومات", version: 1, status: "active", body_markdown: "تهدف هذه السياسة إلى حماية أصول المعلومات الخاصة بالمؤسسة من خلال تحديد الضوابط الأمنية اللازمة وإدارة الوصول وحماية البيانات وفق أفضل الممارسات الدولية." },
  { id: "po4", kind: "ethics", title: "ميثاق أخلاقيات العمل", version: 1, status: "draft", body_markdown: "يوضح هذا الميثاق القيم والمبادئ الأخلاقية التي يلتزم بها جميع منسوبي المؤسسة في تعاملاتهم الداخلية والخارجية وآليات الإبلاغ عن المخالفات." },
  { id: "po5", kind: "governance", title: "إطار الحوكمة المؤسسية", version: 2, status: "active", body_markdown: "يحدد هذا الإطار هيكل الحوكمة المؤسسية وأدوار ومسؤوليات مجلس الإدارة واللجان المنبثقة عنه وآليات اتخاذ القرار والرقابة والإفصاح بما يعزز الشفافية والمساءلة ويحمي حقوق أصحاب المصلحة ويضمن استدامة المؤسسة على المدى الطويل وفق أفضل ممارسات الحوكمة." },
];

const AUTHORITY: Authority[] = [
  { id: "am1", action_key: "expense", action_label: "اعتماد مصروف تشغيلي", principal_kind: "مدير الإدارة", amount_limit: 50000, currency: "SAR" },
  { id: "am2", action_key: "expense_high", action_label: "اعتماد مصروف رأسمالي", principal_kind: "المدير العام", amount_limit: 500000, currency: "SAR" },
  { id: "am3", action_key: "contract", action_label: "توقيع العقود", principal_kind: "المدير العام", amount_limit: null, currency: null },
  { id: "am4", action_key: "hire", action_label: "اعتماد التعيينات", principal_kind: "مدير الموارد البشرية", amount_limit: null, currency: null },
];

function asArr(x: string[] | undefined): string[] {
  return Array.isArray(x) ? x : [];
}

type TabKey = "tree" | "departments" | "sections" | "roles" | "duties" | "permissions" | "cycles" | "policies" | "governance";

export default function OrgPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  // الصلاحيات تُشتق من أدوار المنشأة الفعلية؛ والبقية تكتمل في صفحاتها المخصّصة
  const permGroups = useMemo(() => buildPermGroups(depts, roles), [depts, roles]);
  const totalPermKeys = useMemo(() => new Set(roles.flatMap((r) => r.perms)).size, [roles]);
  const cycles = CYCLES;
  const policies = POLICIES;
  const authority = AUTHORITY;

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getOrgStructure();
      if (!alive) return;
      if (s.ok) {
        setDepts(s.depts.map((d) => ({ id: d.key, name: d.name, mission: d.mission })));
        setSecs(s.sections.map((x, i) => ({ id: `${x.dept_key}-sec-${i}`, department_id: x.dept_key, name: x.name, description: null })));
        setRoles(s.roles.map((r) => ({
          id: r.id, department_id: r.dept_key, title: r.title,
          level: r.reports_to ? `يرفع إلى ${r.reports_to}` : null,
          mission: r.purpose, default_assignee: "human" as const,
          responsibilities: r.duties, kpis: r.kpis, perms: r.perms,
        })));
        setLive(true);
      } else {
        // تراجع آمن إلى بيانات العرض إن لم تتوفر قاعدة البيانات
        setDepts(DEPTS); setSecs(SECS); setRoles(ROLES);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const [tab, setTab] = useState<TabKey>("tree");

  const tabs: { value: TabKey; label: string; Icon: LucideIcon }[] = [
    { value: "tree", label: "المخطط الشجري", Icon: GitBranch },
    { value: "departments", label: "الإدارات", Icon: Building2 },
    { value: "sections", label: "الأقسام", Icon: Layers },
    { value: "roles", label: "المسميات الوظيفية", Icon: BadgeCheck },
    { value: "duties", label: "المهام والواجبات", Icon: ClipboardList },
    { value: "permissions", label: "الصلاحيات", Icon: KeyRound },
    { value: "cycles", label: "الدورة المستندية", Icon: Workflow },
    { value: "policies", label: "السياسات الداخلية", Icon: ScrollText },
    { value: "governance", label: "الحوكمة", Icon: Shield },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">الإدارات والأقسام والأدوار</h2>
          <p className="text-sm text-muted-foreground">المخطط الحي لمؤسستك.</p>
        </div>
        <div className="flex items-center gap-3">
          {live && <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> بيانات حقيقية</span>}
          <div className="text-sm text-muted-foreground">{depts.length} إدارة · {roles.length} دور</div>
          <GenerateFullButton hasData={depts.length > 0} />
        </div>
      </div>

      {loading ? (
        <Card className="mulki-card p-12 text-center text-muted-foreground">جاري تحميل الهيكل التنظيمي…</Card>
      ) : (
      <OrgOverviewCanvas depts={depts} secs={secs} roles={roles} />)}

      <div className="space-y-4">
        <div className="flex flex-wrap h-auto gap-1 rounded-lg bg-muted p-1">
          {tabs.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        {/* المخطط الشجري */}
        {tab === "tree" && (
          <div className="space-y-4">
            <Card className="mulki-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold">مخطط التسلسل الإداري</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">شجرة الأدوار والمكلّفين — اضغط لتوسيع أو طي الفروع.</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="size-2 rounded bg-primary" /> بشري</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded bg-purple-500" /> AI</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded bg-amber-500" /> هجين</span>
                </div>
              </div>
              <OrgChartTree roots={ORG_TREE} orphans={[]} />
            </Card>
          </div>
        )}

        {/* الإدارات */}
        {tab === "departments" && (
          <div className="space-y-4">
            {depts.map((d) => {
              const dRoles = roles.filter((r) => r.department_id === d.id);
              const dSecs = secs.filter((s) => s.department_id === d.id);
              return (
                <Card key={d.id} className="mulki-card p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Building2 className="size-5" /></div>
                      <div>
                        <h3 className="font-display text-lg font-semibold">{d.name}</h3>
                        {d.mission && <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{d.mission}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline">{dSecs.length} قسم</Badge>
                      <Badge variant="outline">{dRoles.length} دور</Badge>
                      <Link href={`/department/${d.id}`}>
                        <Button size="sm" className="bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)] gap-1"><DoorOpen className="size-4" /> دخول</Button>
                      </Link>
                    </div>
                  </div>
                  {dSecs.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {dSecs.map((s) => <Badge key={s.id} variant="secondary">{s.name}</Badge>)}
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-3">
                    {dRoles.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border bg-background/40 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {r.default_assignee === "ai" ? <Bot className="size-4 text-primary" /> : r.default_assignee === "hybrid" ? <Bot className="size-4 text-accent" /> : <Users className="size-4 text-muted-foreground" />}
                            <div className="font-medium">{r.title}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{ASSIGNEE_LABEL[r.default_assignee]}</Badge>
                        </div>
                        {r.level && <div className="text-xs text-muted-foreground mt-1">{r.level}</div>}
                        {r.mission && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.mission}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* الأقسام */}
        {tab === "sections" && (
          <div className="space-y-4">
            {depts.map((d) => {
              const dSecs = secs.filter((s) => s.department_id === d.id);
              if (dSecs.length === 0) return null;
              return (
                <Card key={d.id} className="mulki-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="size-4 text-primary" />
                    <h4 className="font-display font-semibold">{d.name}</h4>
                    <Badge variant="outline" className="ms-auto">{dSecs.length}</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dSecs.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border bg-background/40 p-3">
                        <div className="flex items-center gap-2">
                          <Layers className="size-4 text-primary" />
                          <div className="font-medium text-sm">{s.name}</div>
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{s.description}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* المسميات الوظيفية */}
        {tab === "roles" && (
          <div className="space-y-3">
            <Card className="mulki-card p-5">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {roles.map((r) => {
                  const dept = depts.find((d) => d.id === r.department_id);
                  return (
                    <div key={r.id} className="rounded-lg border border-border bg-background/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BadgeCheck className="size-4 text-primary shrink-0" />
                          <div className="font-medium truncate">{r.title}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{ASSIGNEE_LABEL[r.default_assignee]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {dept && <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>}
                        {r.level && <Badge variant="outline" className="text-[10px]">{r.level}</Badge>}
                      </div>
                      {r.mission && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{r.mission}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* المهام والواجبات */}
        {tab === "duties" && (
          <div className="space-y-3">
            {roles.map((r) => {
              const resp = asArr(r.responsibilities);
              const kpis = asArr(r.kpis);
              const dept = depts.find((d) => d.id === r.department_id);
              if (resp.length === 0 && kpis.length === 0) return null;
              return (
                <Card key={r.id} className="mulki-card p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="size-4 text-primary" />
                      <div className="font-display font-semibold">{r.title}</div>
                      {dept && <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {resp.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">المهام والواجبات</div>
                        <ul className="space-y-1.5">
                          {resp.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {kpis.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">مؤشرات الأداء KPIs</div>
                        <ul className="space-y-1.5">
                          {kpis.map((k, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Target className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>{k}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* الصلاحيات */}
        {tab === "permissions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{permGroups.length} إدارة بصلاحيات · {totalPermKeys} صلاحية مسندة</div>
              <Link href="/permissions"><Button variant="outline" size="sm" className="gap-2"><KeyRound className="size-4" /> إدارة الصلاحيات</Button></Link>
            </div>
            {permGroups.length === 0 ? (
              <Card className="mulki-card p-10 text-center">
                <KeyRound className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد صلاحيات مسندة لأدوار هذه المنشأة بعد.</p>
                <Link href="/permissions"><Button variant="outline" size="sm" className="mt-4 gap-2"><KeyRound className="size-4" /> إسناد الصلاحيات</Button></Link>
              </Card>
            ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {permGroups.map((ps) => {
                const byCat: Record<string, string[]> = {};
                ps.permKeys.forEach((key) => {
                  const info = permInfo(key);
                  (byCat[info.category] ||= []).push(info.label);
                });
                return (
                  <Card key={ps.id} className="mulki-card p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <KeyRound className="size-4 text-primary" />
                        <div className="font-display font-semibold">{ps.name}</div>
                      </div>
                      <Badge variant="outline">{ps.permKeys.length} صلاحية</Badge>
                    </div>
                    {ps.description && <p className="text-xs text-muted-foreground mb-3">{ps.description}</p>}
                    <div className="space-y-2">
                      {Object.entries(byCat).map(([cat, list]) => (
                        <div key={cat}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{cat}</div>
                          <div className="flex flex-wrap gap-1">
                            {list.map((label, i) => <Badge key={i} variant="secondary" className="text-[10px]">{label}</Badge>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* الدورة المستندية */}
        {tab === "cycles" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{cycles.length} دورة مستندية نشطة</div>
              <Link href="/workflows"><Button variant="outline" size="sm" className="gap-2"><Workflow className="size-4" /> إدارة سير العمل</Button></Link>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {cycles.map((c) => {
                const dept = depts.find((d) => d.id === c.department_id);
                const stages = c.stages;
                return (
                  <Card key={c.id} className="mulki-card p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Workflow className="size-4 text-primary" />
                        <div className="font-display font-semibold">{c.name}</div>
                      </div>
                      {c.document_type && <Badge variant="outline" className="text-[10px]">{c.document_type}</Badge>}
                    </div>
                    {dept && <Badge variant="secondary" className="text-[10px] mb-2">{dept.name}</Badge>}
                    {c.description && <p className="text-xs text-muted-foreground mb-3">{c.description}</p>}
                    {stages.length > 0 && (
                      <div className="space-y-1.5">
                        {stages.map((st, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="size-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">{i + 1}</span>
                            <span className="flex-1">{st.name ?? `مرحلة ${i + 1}`}</span>
                            {st.actor && <span className="text-muted-foreground">{st.actor}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* السياسات الداخلية */}
        {tab === "policies" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{policies.length} وثيقة سياسة</div>
              <Link href="/knowledge"><Button variant="outline" size="sm" className="gap-2"><ScrollText className="size-4" /> أرشيف السياسات</Button></Link>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {policies.filter((p) => p.kind !== "governance").map((p) => (
                <Card key={p.id} className="mulki-card p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ScrollText className="size-4 text-primary shrink-0" />
                      <div className="font-display font-semibold truncate">{p.title}</div>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "outline"} className="text-[10px] shrink-0">{p.status}</Badge>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="secondary" className="text-[10px]">{POLICY_KIND_LABEL[p.kind] ?? p.kind}</Badge>
                    <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">
                    {p.body_markdown.replace(/[#*`>_]/g, "").slice(0, 280)}…
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* الحوكمة */}
        {tab === "governance" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">إطار الحوكمة ومصفوفة الصلاحيات المالية</div>
              <Link href="/governance"><Button variant="outline" size="sm" className="gap-2"><Shield className="size-4" /> مركز الحوكمة</Button></Link>
            </div>

            {policies.filter((p) => p.kind === "governance").map((p) => (
              <Card key={p.id} className="mulki-card p-6">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    <div className="font-display text-lg font-semibold">{p.title}</div>
                  </div>
                  <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-line line-clamp-[12]">
                  {p.body_markdown.replace(/[#*`>_]/g, "")}
                </div>
              </Card>
            ))}

            <Card className="mulki-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="size-4 text-primary" />
                <h4 className="font-display font-semibold">مصفوفة الصلاحيات المالية</h4>
                <Badge variant="outline" className="ms-auto">{authority.length}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-start py-2">الإجراء</th>
                      <th className="text-start py-2">صاحب الصلاحية</th>
                      <th className="text-start py-2">الحد المالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authority.map((a) => (
                      <tr key={a.id} className="border-b border-border/50">
                        <td className="py-2">{a.action_label}</td>
                        <td className="py-2"><Badge variant="secondary" className="text-[10px]">{a.principal_kind}</Badge></td>
                        <td className="py-2 font-mono text-xs">
                          {a.amount_limit ? `${a.amount_limit.toLocaleString()} ${a.currency ?? "SAR"}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= inlined Badge (was @/components/ui/badge) =============

function Badge({
  children, variant = "default", className,
}: { children: React.ReactNode; variant?: "default" | "outline" | "secondary"; className?: string }) {
  const variants: Record<string, string> = {
    default: "border-transparent bg-primary text-primary-foreground",
    outline: "text-foreground border-border",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}

// ============= inlined GenerateFullButton =============

function GenerateFullButton({ hasData, prominent }: { hasData: boolean; prominent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<{ stage: string; ok: boolean; detail: string }[]>([]);

  const STAGE_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
    structure: { label: "القائمة", icon: Building2 },
    permissions: { label: "الصلاحيات", icon: Shield },
    workflows: { label: "الدورات المستندية", icon: Workflow },
    policies: { label: "السياسات والحوكمة", icon: FileText },
  };

  const run = async () => {
    if (brief.trim().length < 10) { toast.error("صف لنا نشاطك بمزيد من التفصيل"); return; }
    setLoading(true);
    setStages([]);
    // visual-only simulation
    const keys = ["structure", "permissions", "workflows", "policies"];
    for (const k of keys) {
      await new Promise((r) => setTimeout(r, 500));
      setStages((prev) => [...prev, { stage: k, ok: true, detail: "تم" }]);
    }
    setLoading(false);
    toast.success("اكتمل التوليد");
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={prominent ? "mulki-gold-bg gap-2" : "gap-2"}
        variant={prominent ? "default" : "outline"}
      >
        <Sparkles className="size-4" /> {hasData ? "توليد إضافي" : "توليد المنشأة الكاملة"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> توليد المنشأة الكاملة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">وصف النشاط</label>
            <Textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="مجموعة قابضة تدير وساطة عقارية وإدارة ممتلكات..." />
          </div>
          <div>
            <label className="text-sm font-medium">الأنشطة التجارية (وفق تصنيف ISIC4 — وزارة التجارة)</label>
            <Input placeholder="اختر الأنشطة التجارية" />
          </div>

          {(loading || stages.length > 0) && (
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
              {Object.entries(STAGE_LABEL).map(([k, v]) => {
                const s = stages.find((x) => x.stage === k);
                const Icon = v.icon;
                return (
                  <div key={k} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 ${s?.ok ? "text-green-500" : s ? "text-red-500" : "text-muted-foreground"}`} />
                      <span>{v.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s?.detail ?? (loading ? "جارٍ…" : "بانتظار")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={loading} className="mulki-gold-bg gap-2">
            <Sparkles className="size-4" /> {loading ? "جارٍ التوليد…" : "ابدأ التوليد"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}

// minimal Input used inside the dialog (avoids extra import wiring)
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className
      )}
    />
  );
}

// ============= inlined OrgChartTree =============

type OrgChartNode = {
  id: string;
  title: string;
  level: string | null;
  department_name: string | null;
  mission: string | null;
  default_assignee: "human" | "ai" | "hybrid";
  assignees: { kind: "human" | "ai"; name: string }[];
  children: OrgChartNode[];
};

const ORG_TREE: OrgChartNode[] = [
  {
    id: "owner", title: "المالك", level: "رئيس مجلس الإدارة", department_name: null, mission: "القيادة الاستراتيجية العليا للمؤسسة.", default_assignee: "human",
    assignees: [{ kind: "human", name: "م. الـمُهنّا" }],
    children: [
      {
        id: "ceo", title: "المدير العام", level: "الرئيس التنفيذي", department_name: "الإدارة التنفيذية", mission: "الإشراف التنفيذي على جميع الإدارات.", default_assignee: "human",
        assignees: [{ kind: "human", name: "المدير التنفيذي" }],
        children: [
          { id: "cfo", title: "المدير المالي", level: "إدارة عليا", department_name: "الإدارة المالية", mission: "إدارة الموارد المالية والاستراتيجية المالية.", default_assignee: "human", assignees: [{ kind: "human", name: "المدير المالي" }, { kind: "ai", name: "وكيل المراجعة" }], children: [
            { id: "acc", title: "محاسب أول", level: "إشرافي", department_name: "المحاسبة", mission: null, default_assignee: "human", assignees: [{ kind: "human", name: "المحاسب" }], children: [] },
            { id: "audit", title: "وكيل المراجعة الذكي", level: "آلي", department_name: "المالية", mission: "مراجعة آلية للمعاملات.", default_assignee: "ai", assignees: [{ kind: "ai", name: "نظام المراجعة" }], children: [] },
          ] },
          { id: "chr", title: "مدير الموارد البشرية", level: "إدارة عليا", department_name: "الموارد البشرية", mission: "قيادة رأس المال البشري.", default_assignee: "human", assignees: [{ kind: "human", name: "مدير HR" }], children: [
            { id: "rec", title: "أخصائي توظيف", level: "تنفيذي", department_name: "التوظيف", mission: null, default_assignee: "hybrid", assignees: [{ kind: "human", name: "الأخصائي" }, { kind: "ai", name: "فارز السير" }], children: [] },
          ] },
          { id: "cre", title: "مدير العقارات", level: "إدارة عليا", department_name: "إدارة العقارات", mission: "إدارة المحفظة العقارية.", default_assignee: "human", assignees: [{ kind: "human", name: "مدير العقارات" }], children: [] },
          { id: "cio", title: "مدير تقنية المعلومات", level: "إدارة عليا", department_name: "تقنية المعلومات", mission: "قيادة التحول الرقمي.", default_assignee: "human", assignees: [{ kind: "human", name: "مدير IT" }], children: [] },
        ],
      },
    ],
  },
];

function NodeCard({ node, depth = 0 }: { node: OrgChartNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const Icon = node.default_assignee === "ai" ? Bot : node.default_assignee === "hybrid" ? Users : User;
  const accent = node.default_assignee === "ai" ? "border-l-purple-500" : node.default_assignee === "hybrid" ? "border-l-amber-500" : "border-l-primary";

  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 size-5 shrink-0 rounded border border-border bg-card flex items-center justify-center hover:bg-accent transition-colors"
            aria-label={open ? "طي" : "توسيع"}
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
          </button>
        ) : (
          <div className="mt-3 size-5 shrink-0" />
        )}
        <div className={cn("flex-1 rounded-lg border border-border bg-card p-3 shadow-sm border-l-4", accent)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <div className="font-semibold text-sm truncate">{node.title}</div>
              </div>
              {node.level && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{node.level}</div>}
              {node.department_name && <div className="text-xs text-muted-foreground mt-1 truncate">{node.department_name}</div>}
              {node.mission && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{node.mission}</div>}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {node.default_assignee === "ai" ? "AI" : node.default_assignee === "hybrid" ? "هجين" : "بشري"}
            </Badge>
          </div>
          {node.assignees.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/60">
              {node.assignees.slice(0, 4).map((a, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  <span className="flex items-center gap-1">
                    {a.kind === "ai" ? <Bot className="size-2.5" /> : <User className="size-2.5" />}
                    {a.name}
                  </span>
                </Badge>
              ))}
              {node.assignees.length > 4 && (
                <Badge variant="secondary" className="text-[10px]">+{node.assignees.length - 4}</Badge>
              )}
            </div>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <div className="ms-7 mt-2 ps-3 border-s border-dashed border-border space-y-2">
          {node.children.map((c) => (
            <NodeCard key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgChartTree({ roots, orphans }: { roots: OrgChartNode[]; orphans: OrgChartNode[] }) {
  if (roots.length === 0 && orphans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
        لا توجد أدوار بعد. أنشئ مؤسستك من شاشة التهيئة.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {roots.map((n) => <NodeCard key={n.id} node={n} />)}
      {orphans.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">أدوار بدون مدير مباشر</div>
          <div className="space-y-2">
            {orphans.map((n) => <NodeCard key={n.id} node={n} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============= inlined OrgOverviewCanvas =============

const DEPT_ICONS: Record<string, LucideIcon> = {
  default: Building2,
  مال: BarChart3, المالية: BarChart3,
  موارد: Users, البشرية: Users,
  عقار: Briefcase, العقارات: Briefcase,
  تشغيل: Settings, التشغيل: Settings,
  مبيعات: TrendingUp, المبيعات: TrendingUp,
  تقنية: HardDrive, المعلومات: HardDrive,
  جودة: Award, الجودة: Award,
};

const SEC_ICONS: LucideIcon[] = [Folder, Wrench, Headphones, ShoppingCart, Briefcase, BarChart3];
const SEC_COLORS = [
  "bg-blue-500/10 text-blue-600",
  "bg-purple-500/10 text-purple-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-amber-500/10 text-amber-600",
  "bg-pink-500/10 text-pink-600",
  "bg-indigo-500/10 text-indigo-600",
];

function pickIcon(name: string): LucideIcon {
  const key = Object.keys(DEPT_ICONS).find((k) => name.includes(k));
  return key ? DEPT_ICONS[key] : DEPT_ICONS.default;
}

function Avatar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-full bg-primary/15 text-primary grid place-items-center font-semibold overflow-hidden", className)}>
      {children}
    </div>
  );
}

function OrgOverviewCanvas({ depts, secs, roles }: { depts: Dept[]; secs: Sec[]; roles: Role[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(depts[0]?.id ?? null);
  const [profileOpen, setProfileOpen] = useState(false);

  const dept = useMemo(() => depts.find((d) => d.id === selectedId) ?? depts[0] ?? null, [depts, selectedId]);
  const dSecs = useMemo(() => (dept ? secs.filter((s) => s.department_id === dept.id) : []), [secs, dept]);
  const dRoles = useMemo(() => (dept ? roles.filter((r) => r.department_id === dept.id) : []), [roles, dept]);
  const manager = dRoles.find((r) => /مدير|رئيس|director|manager|head/i.test(r.title)) ?? dRoles[0] ?? null;

  if (!dept) return null;
  const DeptIcon = pickIcon(dept.name);

  return (
    <div className="space-y-5" dir="rtl">
      {/* مخطط مصغّر للقمة */}
      <Card className="mulki-card p-4">
        <div className="flex flex-col items-center gap-2">
          <MiniNode icon={Crown} title="المالك" subtitle="رئيس مجلس الإدارة" tone="amber" />
          <div className="h-5 w-px bg-border" />
          <MiniNode icon={UserCircle2} title="المدير العام" subtitle="الرئيس التنفيذي" tone="emerald" />
        </div>
      </Card>

      {/* شريط الإدارات */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {depts.slice(0, 7).map((d) => {
          const Icon = pickIcon(d.name);
          const active = d.id === dept.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`group rounded-xl border p-4 text-center transition-all ${active ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40" : "border-border bg-card hover:border-primary/40"}`}
            >
              <div className={`mx-auto size-12 rounded-xl grid place-items-center mb-2 ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-primary"}`}>
                <Icon className="size-6" />
              </div>
              <div className="text-xs font-medium leading-tight">{d.name}</div>
            </button>
          );
        })}
      </div>

      {/* صف الإدارة المختارة */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="mulki-card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
                <DeptIcon className="size-5" />
              </div>
              <h3 className="font-display font-semibold text-lg">{dept.name}</h3>
            </div>
            <Settings className="size-4 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground mb-1">وصف الإدارة</div>
          <p className="text-sm leading-relaxed text-foreground/80">
            {dept.mission ?? "تتولى هذه الإدارة الإشراف على عملياتها اليومية وضمان تنفيذ الأعمال بكفاءة وفعالية لتحقيق أهداف المؤسسة."}
          </p>
        </Card>

        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">مهام الإدارة</div>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={CheckCircle2} label="المهام المتأخرة" value="18" tone="rose" />
            <Stat icon={FileCheck} label="المعاملات المنجزة" value="1,342" tone="blue" />
          </div>
        </Card>

        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">مؤشرات الأداء</div>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={ListChecks} label="المهام المنجزة" value="245" tone="emerald" />
            <Stat icon={TrendingUp} label="نسبة الإنجاز" value="92%" tone="amber" />
          </div>
        </Card>
      </div>

      {/* صف المدير + أقسام الإدارة */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">مدير الإدارة</div>
          {manager ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">{manager.title.slice(0, 1)}</Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{manager.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{dept.name}</div>
                </div>
              </div>
              <Row icon={Mail} text="manager@mulki.com" />
              <Row icon={Phone} text="+966 50 123 4567" />
              <Row icon={UserCircle2} text="المدير المباشر" />
              <Row icon={Calendar} text="تاريخ الانضمام · 12 / 03 / 2020" />
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setProfileOpen(true)}>
                عرض الملف الوظيفي
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">لا يوجد مدير معيّن</div>
          )}
        </Card>

        <Card className="mulki-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">الأقسام التابعة للإدارة</div>
            <Button variant="ghost" size="sm" className="text-xs">عرض جميع الأقسام</Button>
          </div>
          {dSecs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">لا توجد أقسام بعد لهذه الإدارة.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {dSecs.slice(0, 4).map((s, i) => {
                const Icon = SEC_ICONS[i % SEC_ICONS.length];
                const color = SEC_COLORS[i % SEC_COLORS.length];
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-background/40 p-4 flex flex-col gap-2">
                    <div className={`size-10 rounded-lg grid place-items-center ${color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">مدير القسم</div>
                    <div className="text-xs">— غير محدد —</div>
                    <Link
                      href={`/department/${s.id}`}
                      className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary text-[11px] px-2.5 py-1 hover:bg-primary/15 transition"
                    >
                      <UsersRound className="size-3" /> دخول القسم
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* الصف السفلي */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">الوصول السريع</div>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction icon={DoorOpen} label="دخول المكتب" />
            <QuickAction icon={UsersRound} label="فريق الإدارة" />
            <QuickAction icon={FileBarChart} label="التقارير" />
          </div>
        </Card>

        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">طلب مقابلة أو دخول مكتب</div>
          <div className="space-y-2">
            <MiniSelect placeholder="اختر الموظف" options={dRoles.slice(0, 8).map((r) => r.title)} />
            <MiniSelect placeholder="اختر السبب" options={["مقابلة عمل", "اعتماد قرار", "مراجعة ملف"]} />
            <Button size="sm" className="w-full gap-2" onClick={() => toast.success("تم إرسال الطلب")}><Send className="size-3.5" /> إرسال الطلب</Button>
          </div>
        </Card>

        <Card className="mulki-card p-5">
          <div className="text-sm font-medium mb-3 text-center">حالة الاتصال</div>
          <div className="space-y-2 text-sm">
            <StatusRow color="bg-emerald-500" label="متصل" value="128" />
            <StatusRow color="bg-amber-500" label="مشغول" value="34" />
            <StatusRow color="bg-blue-500" label="في اجتماع" value="12" />
            <StatusRow color="bg-muted-foreground/60" label="غير متصل" value="46" />
          </div>
        </Card>

        <Card className="mulki-card p-0 overflow-hidden relative">
          <div className="w-full h-44 bg-gradient-to-br from-primary/30 via-primary/10 to-background grid place-items-center">
            <Building2 className="size-16 text-primary/40" strokeWidth={1.2} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-4">
            <div className="text-sm font-semibold mb-1">الدخول إلى مكاتب الموظفين</div>
            <Button size="sm" variant="outline" className="gap-2 bg-background/80 backdrop-blur">
              <DoorOpen className="size-3.5" /> دخول
            </Button>
          </div>
        </Card>
      </div>

      {/* لوحة الملف الوظيفي (الجانبية) */}
      {profileOpen && manager && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setProfileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative ms-auto h-full w-full sm:max-w-md bg-card border-s border-border overflow-y-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <ProfilePanel role={manager} dept={dept} onClose={() => setProfileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniNode({ icon: Icon, title, subtitle, tone }: { icon: LucideIcon; title: string; subtitle: string; tone: "amber" | "emerald" }) {
  const ring = tone === "amber" ? "ring-amber-500/40" : "ring-emerald-500/40";
  const dot = tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={`relative rounded-xl border bg-card px-4 py-2 flex items-center gap-3 min-w-[220px] ring-1 ${ring}`}>
      <Avatar className="size-9"><Icon className="size-4" /></Avatar>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <span className={`absolute -bottom-1 right-3 size-2 rounded-full ${dot}`} />
    </div>
  );
}

const TONE: Record<string, string> = {
  rose: "bg-rose-500/10 text-rose-600",
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
};

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`size-7 rounded-lg grid place-items-center ${TONE[tone]}`}><Icon className="size-3.5" /></div>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Row({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="size-3.5" /> <span className="truncate">{text}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background/40 p-3 hover:border-primary/40 hover:bg-primary/5 transition">
      <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center"><Icon className="size-4" /></div>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}

function StatusRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${color}`} /> <span>{label}</span></div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function MiniSelect({ placeholder, options }: { placeholder: string; options: string[] }) {
  return (
    <select
      defaultValue=""
      className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((o, i) => <option key={i} value={o}>{o}</option>)}
    </select>
  );
}

function ProfilePanel({ role, dept, onClose }: { role: Role; dept: Dept; onClose: () => void }) {
  const [tab, setTab] = useState<"profile" | "perms" | "tasks" | "job">("job");
  const resp = asArr(role.responsibilities);
  const kpis = asArr(role.kpis);
  const tabs: { value: typeof tab; label: string }[] = [
    { value: "profile", label: "الملف الشخصي" },
    { value: "perms", label: "الصلاحيات" },
    { value: "tasks", label: "المهام" },
    { value: "job", label: "الوصف الوظيفي" },
  ];
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">مدير الإدارة</div>
        <button onClick={onClose} className="size-7 rounded-md hover:bg-muted grid place-items-center">✕</button>
      </div>
      <div className="flex flex-col items-center text-center">
        <Avatar className="size-20 mb-2 text-xl">{role.title.slice(0, 1)}</Avatar>
        <div className="font-display font-semibold text-lg">{role.title}</div>
        <div className="text-xs text-muted-foreground">{dept.name}</div>
        <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-600">
          <span className="size-1.5 rounded-full bg-emerald-500" /> متصل الآن
        </div>
      </div>
      <div className="w-full">
        <div className="grid grid-cols-4 w-full text-[11px] gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn("rounded-md px-2 py-1.5 font-medium transition-colors", tab === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "job" && (
          <div className="space-y-4 mt-3">
            <PanelSection title="الوصف الوظيفي" icon={UserCircle2}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {role.mission ?? "يشرف على جميع عمليات الإدارة ويضمن تحقيق أهدافها وفق السياسات والإجراءات المعتمدة."}
              </p>
            </PanelSection>
            {resp.length > 0 && (
              <PanelSection title="المهام الرئيسية" icon={ListChecks}>
                <ul className="space-y-1.5 text-xs">{resp.slice(0, 5).map((t, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="size-3 text-primary mt-0.5 shrink-0" /><span>{t}</span></li>)}</ul>
              </PanelSection>
            )}
            {kpis.length > 0 && (
              <PanelSection title="مؤشرات الأداء" icon={TrendingUp}>
                <ul className="space-y-1.5 text-xs">{kpis.slice(0, 5).map((t, i) => <li key={i} className="flex gap-2"><TrendingUp className="size-3 text-amber-500 mt-0.5 shrink-0" /><span>{t}</span></li>)}</ul>
              </PanelSection>
            )}
          </div>
        )}
        {tab === "tasks" && <div className="mt-3 text-xs text-muted-foreground text-center py-8">لا توجد مهام مفتوحة حالياً.</div>}
        {tab === "perms" && <div className="mt-3 text-xs text-muted-foreground text-center py-8">يتم عرض الصلاحيات من مركز الصلاحيات.</div>}
        {tab === "profile" && (
          <div className="mt-3 space-y-2 text-xs">
            <Row icon={Mail} text="manager@mulki.com" />
            <Row icon={Phone} text="+966 50 123 4567" />
            <Row icon={Calendar} text="تاريخ الانضمام · 12 / 03 / 2020" />
          </div>
        )}
      </div>
    </div>
  );
}

function PanelSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 mb-2"><Icon className="size-4 text-primary" /><div className="text-sm font-semibold">{title}</div></div>
      {children}
    </div>
  );
}
