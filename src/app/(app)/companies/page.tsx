"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Search, MapPin, Phone, Globe, Star, Users, Briefcase, ExternalLink, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { getCompanies, addCompany, type CompanyRow as Company, type CompanyType } from "@/app/actions/companies";

const TYPE_COLOR: Record<string, string> = {
  "شريك": "bg-blue-500/15 text-blue-500",
  "عميل": "bg-emerald-500/15 text-emerald-500",
  "مورّد": "bg-amber-500/15 text-amber-500",
  "مستثمر": "bg-purple-500/15 text-purple-500",
};

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-3", i < Math.floor(n) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
      ))}
      <span className="text-xs text-muted-foreground ms-1">{n}</span>
    </span>
  );
}

export default function CompaniesPage() {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const sectorRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);

  const types = ["all", "شريك", "عميل", "مورّد", "مستثمر"];

  useEffect(() => {
    let alive = true;
    getCompanies().then((r) => { if (alive) { setCompanies(r.companies); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => {
    return companies.filter((c) => {
      const matchType = typeFilter === "all" || c.type === typeFilter;
      const matchQ = !q.trim() || c.name.includes(q) || c.sector.includes(q) || c.city.includes(q);
      return matchType && matchQ;
    });
  }, [companies, q, typeFilter]);

  const handleAdd = async () => {
    const name = nameRef.current?.value.trim();
    if (!name) { toast.error("اسم الشركة مطلوب"); return; }
    setSaving(true);
    const res = await addCompany({
      name,
      type: (typeRef.current?.value as CompanyType) || "شريك",
      sector: sectorRef.current?.value.trim(),
      city: cityRef.current?.value.trim(),
      phone: phoneRef.current?.value.trim(),
      website: websiteRef.current?.value.trim(),
    });
    setSaving(false);
    if (!res.ok || !res.company) { toast.error(res.error || "تعذّرت الإضافة"); return; }
    setCompanies((prev) => [res.company!, ...prev]);
    toast.success("تمت إضافة الشركة بنجاح");
    setOpen(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> دليل الشركات والشركاء
          </h2>
          <p className="text-sm text-muted-foreground mt-1">شركاء وعملاء وموردو المنشأة</p>
        </div>
        <Button size="sm" className="mulki-gold-bg gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> إضافة شركة
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة شركة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input ref={nameRef} placeholder="اسم الشركة *" />
              <select ref={typeRef} defaultValue="شريك" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="شريك">شريك</option>
                <option value="عميل">عميل</option>
                <option value="مورّد">مورّد</option>
                <option value="مستثمر">مستثمر</option>
              </select>
              <Input ref={sectorRef} placeholder="القطاع" />
              <div className="grid grid-cols-2 gap-2">
                <Input ref={cityRef} placeholder="المدينة" />
                <Input ref={phoneRef} placeholder="الهاتف" />
              </div>
              <Input ref={websiteRef} placeholder="الموقع الإلكتروني" />
              <Button className="w-full" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin ms-2" />}حفظ الشركة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {types.slice(1).map((t) => (
          <Card key={t} className="mulki-card p-4 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setTypeFilter(t)}>
            <div className="text-2xl font-bold text-primary mb-1">{companies.filter((c) => c.type === t).length}</div>
            <div className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium inline-block", TYPE_COLOR[t])}>{t}</div>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="ابحث بالاسم أو القطاع أو المدينة..." value={q} onChange={(e) => setQ(e.target.value)} className="pe-9" />
        </div>
        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "الكل" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <Card className="mulki-card p-12 text-center">
          <Loader2 className="size-8 text-primary mx-auto animate-spin" />
        </Card>
      ) : companies.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Building2 className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground mb-1">لا توجد شركات في دليلك بعد.</p>
          <p className="text-xs text-muted-foreground">أضف أول شريك أو عميل عبر زر «إضافة شركة».</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Building2 className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">لا توجد نتائج مطابقة.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((c) => (
            <Card key={c.id} className="mulki-card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center font-bold text-lg shrink-0">
                    {c.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">{c.name}</h3>
                    <div className="text-xs text-muted-foreground">{c.sector}</div>
                  </div>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium shrink-0", TYPE_COLOR[c.type])}>{c.type}</span>
              </div>
              <Stars n={c.rating} />
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="size-3" />{c.city}</span>
                <span className="flex items-center gap-1"><Users className="size-3" />{c.employees.toLocaleString("ar-SA")} موظف</span>
                <span className="flex items-center gap-1"><Briefcase className="size-3" />منذ {c.since}</span>
                <span className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toast.info(`${c.name} — ${c.phone}`)}>
                  <Phone className="size-3.5" /> تواصل
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toast.info(c.website)}>
                  <Globe className="size-3.5" /> الموقع <ExternalLink className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
