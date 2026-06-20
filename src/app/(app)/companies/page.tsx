"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/uikit/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Building2, Search, X, Mail, Globe, MapPin, Phone, User, ChevronLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type CompanyType = "شريك استراتيجي" | "مورّد" | "عميل" | "شريك تقني" | "مورّد تقني" | "بنك" | "محتمل";
type CompanyStatus = "نشط" | "معلّق" | "محتمل";

type Company = {
  id: string;
  name: string;
  initials: string;
  type: CompanyType;
  industry: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  website: string;
  address: string;
  status: CompanyStatus;
  notes: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const COMPANIES: Company[] = [
  { id: "c1", name: "الاختيار للعقارات", initials: "اخ", type: "شريك استراتيجي", industry: "عقارات", contactPerson: "محمد الاختيار", contactPhone: "0512345678", email: "info@alekhtiar.sa", website: "www.alekhtiar.sa", address: "الرياض، حي العليا، شارع الملك فهد", status: "نشط", notes: "شراكة استراتيجية في مشاريع التطوير العقاري منذ 2020" },
  { id: "c2", name: "مصرف الراجحي", initials: "رج", type: "بنك", industry: "مالية", contactPerson: "خالد الراجحي", contactPhone: "0500000000", email: "corporate@alrajhi.com", website: "www.alrajhibank.com.sa", address: "الرياض، مركز المملكة", status: "نشط", notes: "شريك مصرفي رئيسي لتمويل المشاريع" },
  { id: "c3", name: "شركة الخليج للمقاولات", initials: "خج", type: "مورّد", industry: "مقاولات", contactPerson: "عبدالله الخليج", contactPhone: "0555551234", email: "contracts@gulf-co.sa", website: "www.gulf-contractors.sa", address: "الرياض، حي الصناعية", status: "نشط", notes: "مورّد معتمد للمشاريع الإنشائية بموجب عقد سنوي" },
  { id: "c4", name: "بوابة سلة", initials: "سل", type: "شريك تقني", industry: "تجارة إلكترونية", contactPerson: "فريق الشراكات", contactPhone: "920000000", email: "partners@salla.sa", website: "www.salla.sa", address: "جدة، حي العزيزية", status: "نشط", notes: "منصة التجارة الإلكترونية المفضّلة للمنشأة" },
  { id: "c5", name: "شركة أوراكل السعودية", initials: "أو", type: "مورّد تقني", industry: "تقنية", contactPerson: "سامي الحربي", contactPhone: "0501112233", email: "ksa@oracle.com", website: "www.oracle.com/sa", address: "الرياض، مركز الأعمال", status: "نشط", notes: "مزوّد حلول قواعد البيانات والأنظمة السحابية" },
  { id: "c6", name: "مكتب الاستشارات القانونية", initials: "قن", type: "مورّد", industry: "قانون", contactPerson: "د. عبدالرحمن الزيد", contactPhone: "0503334455", email: "legal@alzaid-law.sa", website: "www.alzaid-law.sa", address: "الرياض، حي الملقا", status: "نشط", notes: "المستشار القانوني المعتمد للمنشأة" },
  { id: "c7", name: "شركة الحراسة الأمنية", initials: "حر", type: "مورّد", industry: "أمن", contactPerson: "تركي العسكر", contactPhone: "0556667788", email: "ops@security-sa.com", website: "www.security-sa.com", address: "جدة، المنطقة الصناعية", status: "نشط", notes: "مزوّد خدمات الأمن والحراسة للمرافق" },
  { id: "c8", name: "مجموعة زهران", initials: "زه", type: "عميل", industry: "تطوير عقاري", contactPerson: "وليد زهران", contactPhone: "0509998877", email: "wm@zahran-group.sa", website: "www.zahran-group.sa", address: "جدة، حي الحمراء", status: "نشط", notes: "عميل استراتيجي مع عدة مشاريع تطوير جارية" },
  { id: "c9", name: "شركة النخيل للمقاولات", initials: "نخ", type: "عميل", industry: "مقاولات", contactPerson: "فيصل النخيل", contactPhone: "0512223344", email: "info@nakheel-co.sa", website: "www.nakheel-contractors.sa", address: "الدمام، المنطقة الشرقية", status: "معلّق", notes: "تم تعليق التعامل بانتظار تجديد العقد" },
  { id: "c10", name: "مؤسسة التقنية الحديثة", initials: "تق", type: "محتمل", industry: "تقنية", contactPerson: "هند العمري", contactPhone: "0566667788", email: "hend@modtech.sa", website: "www.modtech.sa", address: "الرياض، حي النزهة", status: "محتمل", notes: "اتصال أولي — في طور دراسة الشراكة" },
];

const TYPE_FILTERS = ["الكل", "شريك استراتيجي", "مورّد", "عميل", "شريك تقني", "مورّد تقني", "بنك", "محتمل"] as const;

const STATUS_COLORS: Record<CompanyStatus, string> = {
  "نشط": "bg-green-100 text-green-700",
  "معلّق": "bg-yellow-100 text-yellow-700",
  "محتمل": "bg-blue-100 text-blue-700",
};

// ─── Inline primitives ────────────────────────────────────────────────────────
function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CompaniesPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const [selected, setSelected] = useState<Company | null>(null);

  const filtered = COMPANIES.filter((c) => {
    const matchType = typeFilter === "الكل" || c.type === typeFilter;
    const matchQuery =
      !query ||
      c.name.includes(query) ||
      c.contactPerson.includes(query) ||
      c.industry.includes(query);
    return matchType && matchQuery;
  });

  const activeCount = COMPANIES.filter((c) => c.status === "نشط").length;
  const pendingCount = COMPANIES.filter((c) => c.status === "معلّق").length;

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl mulki-gold-bg flex items-center justify-center">
          <Building2 className="size-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">دليل الشركات والشركاء</h1>
          <p className="text-sm text-muted-foreground">إدارة علاقات الأعمال والشراكات الاستراتيجية</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي الشركات", value: COMPANIES.length },
          { label: "الشراكات النشطة", value: activeCount },
          { label: "قيد الانتظار", value: pendingCount },
        ].map(({ label, value }) => (
          <Card key={label} className="mulki-card p-4">
            <div className="font-display text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو القطاع أو جهة الاتصال…"
            className="pe-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                typeFilter === t
                  ? "mulki-gold-bg border-transparent text-white"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Companies Grid + Detail Panel */}
      <div className="flex gap-6">
        <div className={cn("grid gap-4 flex-1 transition-all", selected ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
          {filtered.length === 0 ? (
            <Card className="mulki-card p-10 text-center col-span-full">
              <Building2 className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد شركات تطابق معايير البحث</p>
            </Card>
          ) : (
            filtered.map((company) => (
              <Card
                key={company.id}
                className={cn(
                  "mulki-card p-5 cursor-pointer transition-all hover:shadow-md",
                  selected?.id === company.id && "ring-2 ring-primary",
                )}
                onClick={() => setSelected(selected?.id === company.id ? null : company)}
              >
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-xl mulki-gold-bg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {company.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{company.name}</div>
                    <div className="text-xs text-muted-foreground">{company.industry}</div>
                  </div>
                  <Badge className={STATUS_COLORS[company.status]}>{company.status}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-secondary text-secondary-foreground">{company.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="size-3" />
                    {company.contactPerson}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelected(company); }}>
                    عرض الملف
                  </Button>
                  <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); toast.info(`فتح محادثة مع ${company.name}`); }}>
                    <Mail className="size-3 ms-1" />
                    مراسلة
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Detail Slide-out */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <Card className="mulki-card p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold">ملف الشركة</h3>
                <button type="button" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="size-14 rounded-xl mulki-gold-bg flex items-center justify-center text-white font-bold text-lg">
                  {selected.initials}
                </div>
                <div>
                  <div className="font-semibold text-base">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">{selected.industry}</div>
                  <Badge className={cn("mt-1", STATUS_COLORS[selected.status])}>{selected.status}</Badge>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <DetailRow icon={<Building2 className="size-4" />} label="النوع" value={selected.type} />
                <DetailRow icon={<User className="size-4" />} label="جهة الاتصال" value={selected.contactPerson} />
                <DetailRow icon={<Phone className="size-4" />} label="الهاتف" value={selected.contactPhone} />
                <DetailRow icon={<Mail className="size-4" />} label="البريد" value={selected.email} />
                <DetailRow icon={<Globe className="size-4" />} label="الموقع" value={selected.website} />
                <DetailRow icon={<MapPin className="size-4" />} label="العنوان" value={selected.address} />
                {selected.notes && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                    <p className="text-sm leading-relaxed">{selected.notes}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => toast.info(`فتح محادثة مع ${selected.name}`)}>
                  <Mail className="size-3 ms-1" />
                  مراسلة
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  <ChevronLeft className="size-3" />
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
