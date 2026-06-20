"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { getPermissionsData, type PermRef, type PermSuspension } from "@/app/actions/structure";
import { KeyRound, Users, ShieldAlert, RefreshCw, ChevronLeft } from "lucide-react";

const DEPT_NAMES: Record<string, string> = {
  management: "الإدارة التنفيذية",
  sales: "المبيعات وتطوير الأعمال",
  maintenance: "الصيانة والمرافق",
  finance: "المالية والمحاسبة",
  hr: "الموارد البشرية",
  ops: "العمليات",
  legal: "الشؤون القانونية والامتثال",
  realestate: "العقارات",
};

const deptName = (key: string) => DEPT_NAMES[key] ?? key;
const scopeLabel = (scope: string) => (scope === "member" ? "موظف" : scope === "dept" ? "إدارة" : scope);

type Member = { id: string; name: string; dept_key: string; grantCount: number };

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
      <span className="size-2 rounded-full bg-green-500 animate-pulse" />
      بيانات حقيقية
    </span>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: number }) {
  return (
    <Card className="mulki-card p-4 flex items-center gap-3">
      <div className="grid place-items-center size-10 rounded-lg mulki-gold-bg shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-display font-semibold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<PermRef[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [suspensions, setSuspensions] = useState<PermSuspension[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPermissionsData();
      if (!res.ok) {
        toast.error("تعذّر تحميل بيانات الصلاحيات");
        return;
      }
      setCatalog(res.catalog);
      setMembers(res.members);
      setSuspensions(res.suspensions);
    } catch {
      toast.error("حدث خطأ أثناء التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <KeyRound className="size-6 text-primary" /> الصلاحيات
          </h1>
          {!loading && <LiveBadge />}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4 ms-2", loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {loading ? (
        <Card className="mulki-card p-12 text-center text-muted-foreground">جاري التحميل…</Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat icon={KeyRound} label="إجمالي الصلاحيات" value={catalog.length} />
            <Stat icon={Users} label="عدد الموظفين" value={members.length} />
            <Stat icon={ShieldAlert} label="إيقافات نشطة" value={suspensions.length} />
          </div>

          {/* Catalog */}
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> كتالوج الصلاحيات
            </h2>
            {catalog.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد صلاحيات.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {catalog.map((p) => (
                  <div
                    key={p.perm_key}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="text-sm font-medium">{p.label_ar}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{p.perm_key}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Members */}
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="size-5 text-primary" /> صلاحيات الموظفين
            </h2>
            {members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا يوجد موظفون.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {members.map((m) => (
                  <Link
                    key={m.id}
                    href={`/workspace/${m.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{deptName(m.dept_key)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center rounded-md mulki-gold-bg px-2 py-0.5 text-xs font-medium">
                        {m.grantCount} صلاحية ممنوحة
                      </span>
                      <ChevronLeft className="size-4 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Suspensions */}
          <Card className="mulki-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-500" /> التعليقات والإيقافات
            </h2>
            {suspensions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد إيقافات نشطة.</p>
            ) : (
              <div className="space-y-3">
                {suspensions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                          {scopeLabel(s.scope)}
                        </span>
                        <span className="font-medium">{s.target}</span>
                        <span className="text-xs text-muted-foreground">— {s.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.time}</span>
                    </div>
                    {s.reason && <p className="text-sm text-muted-foreground mt-2">{s.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
