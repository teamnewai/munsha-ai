"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Shield, CheckCircle2, AlertTriangle, FileText, RefreshCw, Download } from "lucide-react";
import { toast } from "@/lib/toast";

type AuditFinding = {
  id: string;
  title: string;
  level: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  status: "fixed" | "accepted" | "open";
  details: string;
};

type AuditReport = {
  generatedAt: string;
  scanRunAt: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    fixedThisCycle: number;
    accepted: number;
    open: number;
  };
  scanners: { name: string; status: string; itemsFound: number }[];
  fixed: AuditFinding[];
  accepted: AuditFinding[];
  open: AuditFinding[];
  trustPages: { path: string; title: string; titleEn: string; contact: string }[];
  notes: string[];
};

const levelStyles: Record<AuditFinding["level"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

const levelLabel: Record<AuditFinding["level"], string> = {
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
  info: "معلوماتي",
};

// Curated, deterministic audit report (inlined static fallback — visual only).
function buildAuditReport(): AuditReport {
  return {
    generatedAt: new Date().toISOString(),
    scanRunAt: "2026-06-18T22:11:22Z",
    summary: {
      critical: 0, high: 0, medium: 0, low: 0, info: 3, fixedThisCycle: 2, accepted: 3, open: 0,
    },
    scanners: [
      { name: "Supabase Linter", status: "success", itemsFound: 3 },
      { name: "Supabase (Lovable)", status: "success", itemsFound: 0 },
      { name: "Connector Security", status: "success", itemsFound: 0 },
      { name: "Trust Surface", status: "success", itemsFound: 0 },
      { name: "Agent Security", status: "success", itemsFound: 0 },
    ],
    fixed: [
      {
        id: "noor_no_msg_validation",
        title: "Noor Chat Endpoint Accepts Unvalidated Message Payloads",
        level: "medium", category: "AI endpoint inputs", status: "fixed",
        details:
          "Added Zod schema validation on /api/noor with a 50-message array cap and an 8,000-character per-message limit. Malformed bodies return a structured 400 instead of throwing.",
      },
      {
        id: "org_activities_no_maxlen",
        title: "Org Generation `activities` Field Has No Maximum Length",
        level: "medium", category: "AI prompt injection", status: "fixed",
        details:
          "Capped the `activities` input to generateOrgStructure at 2,000 characters, aligned with the existing `brief` cap, to prevent prompt-budget abuse.",
      },
    ],
    accepted: [
      {
        id: "rls_helper_is_tenant_member",
        title: "SECURITY DEFINER helper: is_tenant_member",
        level: "info", category: "RLS helpers", status: "accepted",
        details:
          "Required by Row-Level Security policies to check tenant membership without recursion. SECURITY DEFINER with a pinned search_path is the canonical Supabase pattern. Documented and retained.",
      },
      {
        id: "rls_helper_is_tenant_admin",
        title: "SECURITY DEFINER helper: is_tenant_admin",
        level: "info", category: "RLS helpers", status: "accepted",
        details:
          "Required by RLS to authorize admin/owner-scoped writes. SECURITY DEFINER with pinned search_path. Documented and retained.",
      },
      {
        id: "rls_helper_has_role",
        title: "SECURITY DEFINER helper: has_role",
        level: "info", category: "RLS helpers", status: "accepted",
        details:
          "Required by RLS for role-based access checks (owner/admin/member). SECURITY DEFINER with pinned search_path. Documented and retained.",
      },
    ],
    open: [],
    trustPages: [
      { path: "/privacy", title: "سياسة الخصوصية", titleEn: "Privacy Policy", contact: "privacy@mulki-os.com" },
      { path: "/security", title: "الأمان", titleEn: "Security", contact: "security@mulki-os.com" },
      { path: "/terms", title: "شروط الخدمة", titleEn: "Terms of Service", contact: "legal@mulki-os.com" },
    ],
    notes: [
      "Tenant isolation enforced via RLS on every tenant-scoped table.",
      "AI gateway secrets live in server environment only — never shipped to the client.",
      "All authenticated server functions go through requireSupabaseAuth middleware.",
      "Public /api/public/* routes verify their callers (signatures/secrets) before processing.",
    ],
  };
}

export default function SecurityAuditPage() {
  const [data, setData] = useState<AuditReport>(() => buildAuditReport());
  const [isFetching, setIsFetching] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.07);

  type Preset = { label: string; text: string; opacity: number; enabled: boolean };
  const presets: Preset[] = [
    { label: "Confidential", text: "CONFIDENTIAL", opacity: 0.07, enabled: true },
    { label: "Restricted", text: "RESTRICTED", opacity: 0.1, enabled: true },
    { label: "Draft", text: "DRAFT", opacity: 0.05, enabled: true },
    { label: "Internal Use", text: "INTERNAL USE ONLY", opacity: 0.08, enabled: true },
    { label: "None", text: "", opacity: 0.07, enabled: false },
  ];

  function applyPreset(p: Preset) {
    setWatermarkText(p.text);
    setWatermarkOpacity(p.opacity);
    setWatermarkEnabled(p.enabled);
  }

  function downloadPdf() {
    toast.info("تصدير PDF متاح في النسخة الكاملة.");
  }

  function refetch() {
    setIsFetching(true);
    setTimeout(() => {
      setData(buildAuditReport());
      setIsFetching(false);
    }, 600);
  }

  return (
    <>
      <style>{`@media print {
        body { background: white !important; }
        aside, .no-print { display: none !important; }
        main { display: block !important; }
        .mulki-card { break-inside: avoid; box-shadow: none !important; border: 1px solid #e5e7eb !important; }
      }`}</style>
      <div className="p-6 md:p-8 space-y-6 max-w-5xl" id="audit-report">
        <Card className="mulki-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="size-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold">حالة الأمان</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  آخر فحص: {new Date(data.scanRunAt).toLocaleString("ar-EG")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Download className="size-4" />
                تنزيل PDF
              </button>
              <button
                onClick={refetch}
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                disabled={isFetching}
              >
                <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
                تحديث
              </button>
            </div>
          </div>

          {/* PDF export options */}
          <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3 no-print space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">الإعدادات الجاهزة:</span>
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    watermarkText === p.text && watermarkOpacity === p.opacity && watermarkEnabled === p.enabled
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <span>علامة مائية</span>
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                disabled={!watermarkEnabled}
                maxLength={40}
                placeholder="CONFIDENTIAL"
                className="px-2.5 py-1.5 rounded-md border border-border bg-background text-sm w-44 disabled:opacity-50"
              />
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">الشفافية</span>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  disabled={!watermarkEnabled}
                  className="w-28 accent-primary"
                />
                <span className="text-xs tabular-nums w-9 text-end">{Math.round(watermarkOpacity * 100)}%</span>
              </label>
              <span className="text-xs text-muted-foreground ms-auto">
                الترويسة والتذييل يستخدمان اسم وشعار مؤسستك تلقائيًا.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Stat label="حرج" value={data.summary.critical} tone={data.summary.critical ? "bad" : "good"} />
            <Stat label="مرتفع" value={data.summary.high} tone={data.summary.high ? "bad" : "good"} />
            <Stat label="متوسط" value={data.summary.medium} tone={data.summary.medium ? "warn" : "good"} />
            <Stat label="معلوماتي" value={data.summary.info} tone="neutral" />
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            {data.summary.critical + data.summary.high + data.summary.medium === 0 ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-emerald-500 font-medium">
                  لا توجد نتائج بدرجة حرجة أو مرتفعة أو متوسطة.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-amber-500" />
                <span className="text-amber-500 font-medium">توجد نتائج تستدعي المعالجة.</span>
              </>
            )}
          </div>
        </Card>

        <Card className="mulki-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">الماسحات الأمنية</h2>
          <div className="divide-y divide-border">
            {data.scanners.map((s) => (
              <div key={s.name} className="flex items-center justify-between py-2.5 text-sm">
                <span>{s.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{s.itemsFound} نتيجة</span>
                  <span className="inline-flex items-center rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold capitalize">{s.status}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <FindingsBlock
          title={`تم إصلاحه في هذه الدورة (${data.fixed.length})`}
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          items={data.fixed}
        />

        <FindingsBlock
          title={`نتائج مقبولة وموثّقة (${data.accepted.length})`}
          icon={<Shield className="size-4 text-primary" />}
          items={data.accepted}
        />

        {data.open.length > 0 && (
          <FindingsBlock
            title={`نتائج مفتوحة (${data.open.length})`}
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            items={data.open}
          />
        )}

        <Card className="mulki-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">صفحات الشفافية والثقة</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {data.trustPages.map((p) => (
              <a
                key={p.path}
                href={p.path}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border p-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-primary" />
                  {p.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 font-mono">{p.path}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.contact}</div>
              </a>
            ))}
          </div>
        </Card>

        <Card className="mulki-card p-6">
          <h2 className="font-display text-lg font-semibold mb-3">ملاحظات أمنية</h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pr-5">
            {data.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          تم توليد هذا التقرير في {new Date(data.generatedAt).toLocaleString("ar-EG")}.
        </p>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" | "neutral" }) {
  const tones = {
    good: "border-emerald-500/30 text-emerald-500",
    warn: "border-amber-500/30 text-amber-500",
    bad: "border-destructive/30 text-destructive",
    neutral: "border-border text-foreground",
  } as const;
  return (
    <div className={`rounded-xl border ${tones[tone]} bg-card/50 p-4 text-center`}>
      <div className="text-3xl font-display font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FindingsBlock({ title, icon, items }: { title: string; icon: React.ReactNode; items: AuditFinding[] }) {
  if (!items.length) return null;
  return (
    <Card className="mulki-card p-6">
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">{icon}{title}</h2>
      <div className="space-y-3">
        {items.map((f) => (
          <div key={f.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h3 className="font-medium text-sm">{f.title}</h3>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${levelStyles[f.level]}`}>
                {levelLabel[f.level]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{f.category}</div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.details}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
