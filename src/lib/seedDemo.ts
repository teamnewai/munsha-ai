import { createClient } from "@/lib/supabase/client";

// مُلكي إدراك — تعبئة بيانات تجريبية بنقرة (حزمة الإقلاع)
// يُنشئ دورة عمل كاملة مترابطة في منشأة المستخدم لإزالة «اللوحة الفارغة».
// القيم مطابقة لقيود القاعدة: occupancy∈{rented,vacant,maintenance}،
// period∈{annual,...}، contracts.status∈{active,...}، invoices.status∈{paid,due,...}.

export async function seedDemoData(orgId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  if (!supabase) return { ok: false, message: "غير متصل بقاعدة البيانات." };

  // تجنّب التكرار
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) > 0) return { ok: false, message: "توجد بيانات بالفعل — لم نُضِف نسخة مكرّرة." };

  // الأطراف
  const { data: owner, error: e1 } = await supabase
    .from("parties").insert({ org_id: orgId, party_type: "owner", full_name: "شركة العليا القابضة", national_id: "7001234567", phone: "0551110000" })
    .select("id").single();
  const { data: tenant } = await supabase
    .from("parties").insert({ org_id: orgId, party_type: "tenant", full_name: "عبدالله الشهري", national_id: "1098765432", phone: "0552223333" })
    .select("id").single();
  if (e1) return { ok: false, message: "تعذّر إنشاء الأطراف: " + e1.message };

  // العقار
  const { data: prop, error: e2 } = await supabase
    .from("properties").insert({ org_id: orgId, name: "برج العليا", city: "الرياض", district: "العليا", ref_code: "P-001", national_address: "RRRD2929" })
    .select("id").single();
  if (e2 || !prop) return { ok: false, message: "تعذّر إنشاء العقار: " + (e2?.message ?? "") };

  // الوحدات
  const { data: unit } = await supabase
    .from("units").insert({ org_id: orgId, property_id: prop.id, owner_id: owner?.id ?? null, unit_no: "A-204", unit_type: "apartment", area: 120, occupancy: "rented" })
    .select("id").single();
  await supabase.from("units").insert({ org_id: orgId, property_id: prop.id, owner_id: owner?.id ?? null, unit_no: "A-205", unit_type: "apartment", area: 95, occupancy: "vacant" });

  // العقد (يتطلب صلاحية contracts — متاحة للمالك/المدير)
  const { error: e3 } = await supabase.from("contracts").insert({
    org_id: orgId, unit_id: unit?.id ?? null, tenant_id: tenant?.id ?? null, owner_id: owner?.id ?? null,
    annual_rent: 48000, period: "annual", start_date: "2026-01-01", end_date: "2026-12-31", status: "active",
  });

  // الفواتير + الدفعة (تتطلب صلاحية finance — متاحة للمالك/المدير)
  const { data: paidInv } = await supabase.from("invoices").insert({
    org_id: orgId, unit_id: unit?.id ?? null, party_id: tenant?.id ?? null, amount: 12000, due_date: "2026-04-01", status: "paid",
  }).select("id").single();
  await supabase.from("invoices").insert({
    org_id: orgId, unit_id: unit?.id ?? null, party_id: tenant?.id ?? null, amount: 12000, due_date: "2026-07-01", status: "due",
  });
  if (paidInv) {
    await supabase.from("payments").insert({
      org_id: orgId, invoice_id: paidInv.id, amount: 12000, method: "تحويل", reference: "TRX-DEMO-001", paid_on: "2026-04-03",
    });
  }

  const note = e3 ? " (تخطّينا العقد — صلاحية العقود غير متاحة لحسابك)" : "";
  return { ok: true, message: "تمّت تعبئة بيانات تجريبية كاملة ✓" + note };
}
