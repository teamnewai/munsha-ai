import type { Metadata } from "next";
import { getInvoices } from "@/lib/data";
import { EntityList, StatusBadge } from "@/components/dashboard/EntityList";
import { fmtFromSAR, withVat } from "@/lib/money";

export const metadata: Metadata = { title: "الفواتير" };

export default async function Page() {
  const { isReal, rows } = await getInvoices();
  return (
    <EntityList
      icon="🧾"
      title="الفواتير"
      description="الفواتير وحالات السداد (شاملة ضريبة القيمة المضافة 15%)."
      isReal={isReal}
      addLabel="فاتورة جديدة"
      columns={[
        { key: "amount", label: "المبلغ" },
        { key: "withVat", label: "شامل الضريبة" },
        { key: "due", label: "تاريخ الاستحقاق" },
        { key: "status", label: "الحالة" },
      ]}
      rows={rows.map((inv) => ({
        amount: <span className="font-bold text-slate-900">{inv.amount != null ? fmtFromSAR(inv.amount) : "—"}</span>,
        withVat: inv.amount != null ? fmtFromSAR(withVat(inv.amount)) : "—",
        due: inv.due_date,
        status:
          inv.status === "paid" ? <StatusBadge tone="green">مدفوعة</StatusBadge>
          : inv.status === "overdue" ? <StatusBadge tone="rose">متأخرة</StatusBadge>
          : <StatusBadge tone="amber">معلّقة</StatusBadge>,
      }))}
    />
  );
}
