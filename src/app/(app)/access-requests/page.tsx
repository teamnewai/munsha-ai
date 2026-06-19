"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";

type ScopeKind = "department" | "section" | "unit" | "user";
type Status = "pending" | "approved" | "rejected" | "revoked";

type AccessRequest = {
  id: string;
  requester_name: string | null;
  scope_kind: ScopeKind;
  scope_label: string | null;
  scope_id: string;
  reason: string | null;
  status: Status;
};

const SCOPE_LABEL: Record<string, string> = {
  department: "إدارة", section: "قسم", unit: "وحدة", user: "موظف",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة", approved: "مُعتمد", rejected: "مرفوض", revoked: "ملغى",
};

const INITIAL_REQUESTS: AccessRequest[] = [
  { id: "1", requester_name: "سعد العتيبي", scope_kind: "department", scope_label: "الإدارة المالية", scope_id: "a1b2c3d4", reason: "مراجعة تقارير الميزانية الربعية", status: "pending" },
  { id: "2", requester_name: "نورة القحطاني", scope_kind: "section", scope_label: "قسم المشتريات", scope_id: "e5f6g7h8", reason: "متابعة طلبات الشراء العالقة", status: "pending" },
  { id: "3", requester_name: "خالد الدوسري", scope_kind: "unit", scope_label: "وحدة الدعم الفني", scope_id: "i9j0k1l2", reason: "تنسيق صيانة الأنظمة", status: "approved" },
  { id: "4", requester_name: "هند المطيري", scope_kind: "user", scope_label: "ملف الموظف 1042", scope_id: "m3n4o5p6", reason: "تحديث بيانات التواصل", status: "rejected" },
  { id: "5", requester_name: "فهد الشمري", scope_kind: "department", scope_label: "إدارة الموارد البشرية", scope_id: "q7r8s9t0", reason: "إعداد كشوف الرواتب الشهرية", status: "pending" },
];

function badgeClass(variant: "default" | "outline" | "destructive" | "secondary") {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";
  const map: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border text-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return `${base} ${map[variant]}`;
}

export default function AccessRequestsPage() {
  const [data, setData] = useState<AccessRequest[]>(INITIAL_REQUESTS);

  const decide = (id: string, decision: "approved" | "rejected") => {
    setData((rows) => rows.map((r) => (r.id === id ? { ...r, status: decision } : r)));
    toast.success("تم تحديث الطلب");
  };

  return (
    <div className="p-6 md:p-8 space-y-4" dir="rtl">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-semibold">إدارة طلبات زيارة الإدارات والوحدات</h2>
        </div>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">لا توجد طلبات حتى الآن</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b border-border">
                  <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">مقدِّم الطلب</th>
                  <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">النطاق</th>
                  <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">السبب</th>
                  <th className="h-10 px-2 text-start align-middle font-medium text-muted-foreground">الحالة</th>
                  <th className="h-10 px-2 text-end align-middle font-medium text-muted-foreground">إجراء</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {data.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="p-2 align-middle">{r.requester_name ?? "—"}</td>
                    <td className="p-2 align-middle">
                      <span className={badgeClass("outline")}>{SCOPE_LABEL[r.scope_kind]}</span>
                      <span className="ms-2 text-xs text-muted-foreground">{r.scope_label ?? r.scope_id.slice(0, 8)}</span>
                    </td>
                    <td className="p-2 align-middle max-w-xs truncate">{r.reason ?? "—"}</td>
                    <td className="p-2 align-middle">
                      <span className={badgeClass(r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary")}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="p-2 align-middle text-end">
                      {r.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => decide(r.id, "approved")}>
                            <CheckCircle2 className="size-4 ms-1" />موافقة
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => decide(r.id, "rejected")}>
                            <XCircle className="size-4 ms-1" />رفض
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
