"use client";

import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Network, Search, MapPin, Star, MessageSquare, UserPlus, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Contact = {
  id: string;
  name: string;
  title: string;
  company: string;
  sector: string;
  city: string;
  specialty: string[];
  rating: number;
  connected: boolean;
  avatar: string;
};

const CONTACTS: Contact[] = [
  {
    id: "p1", name: "م. أحمد الغامدي", title: "مدير عام التقنية", company: "مجموعة الأفق للتقنية",
    sector: "تقنية المعلومات", city: "الرياض",
    specialty: ["حوكمة تقنية المعلومات", "التحول الرقمي", "الأمن السيبراني"],
    rating: 4.9, connected: true, avatar: "أ",
  },
  {
    id: "p2", name: "د. نورة السبيعي", title: "مديرة الموارد البشرية", company: "البنك التجاري الأول",
    sector: "القطاع المالي", city: "جدة",
    specialty: ["إدارة المواهب", "التطوير التنظيمي", "القيادة"],
    rating: 4.7, connected: true, avatar: "ن",
  },
  {
    id: "p3", name: "خالد العتيبي", title: "مستشار مالي أول", company: "شركة الرواد للاستثمار",
    sector: "المال والاستثمار", city: "الرياض",
    specialty: ["التحليل المالي", "إدارة المحافظ", "الاستثمار البديل"],
    rating: 4.8, connected: false, avatar: "خ",
  },
  {
    id: "p4", name: "م. فهد المطيري", title: "مدير المشاريع", company: "مؤسسة النماء للبناء",
    sector: "المقاولات", city: "الدمام",
    specialty: ["إدارة المشاريع", "الهندسة المدنية", "البناء الأخضر"],
    rating: 4.5, connected: false, avatar: "ف",
  },
  {
    id: "p5", name: "سارة الدوسري", title: "مديرة التسويق الرقمي", company: "شركة روابط لحلول الأعمال",
    sector: "التسويق", city: "الرياض",
    specialty: ["التسويق الرقمي", "تجربة المستخدم", "تحليل البيانات"],
    rating: 4.6, connected: true, avatar: "س",
  },
  {
    id: "p6", name: "عبدالله القحطاني", title: "مدير العمليات اللوجستية", company: "مجموعة سما للخدمات اللوجستية",
    sector: "النقل والخدمات", city: "جدة",
    specialty: ["سلسلة الإمداد", "المستودعات", "التخطيط اللوجستي"],
    rating: 4.3, connected: false, avatar: "ع",
  },
  {
    id: "p7", name: "د. هند الزهراني", title: "مديرة التطوير والابتكار", company: "مركز الابتكار السعودي",
    sector: "الريادة والابتكار", city: "الرياض",
    specialty: ["الابتكار المؤسسي", "الريادة", "إدارة المعرفة"],
    rating: 4.9, connected: false, avatar: "ه",
  },
  {
    id: "p8", name: "محمد الشهري", title: "مدير التطوير العقاري", company: "شركة نخيل للتطوير العقاري",
    sector: "العقارات", city: "الرياض",
    specialty: ["التطوير العقاري", "التفاوض التجاري", "دراسات الجدوى"],
    rating: 4.4, connected: true, avatar: "م",
  },
];

const COLORS = ["#6366f1", "#C9A24B", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function NetworkPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "connected">("all");
  const [contacts, setContacts] = useState<Contact[]>(CONTACTS);
  const [open, setOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const sectorRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const specRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const name = nameRef.current?.value.trim();
    if (!name) { toast.error("الاسم مطلوب"); return; }
    const newContact: Contact = {
      id: `p${Date.now()}`,
      name,
      title: titleRef.current?.value.trim() || "—",
      company: companyRef.current?.value.trim() || "—",
      sector: sectorRef.current?.value.trim() || "عام",
      city: cityRef.current?.value.trim() || "—",
      specialty: (specRef.current?.value.trim() || "").split("،").map((s) => s.trim()).filter(Boolean),
      rating: 0,
      connected: true,
      avatar: name.slice(0, 1),
    };
    setContacts((prev) => [newContact, ...prev]);
    toast.success("تمت إضافة جهة الاتصال بنجاح");
    setOpen(false);
  };

  const visible = useMemo(() => {
    const base = tab === "connected" ? contacts.filter((c) => c.connected) : contacts;
    if (!q.trim()) return base;
    const term = q.toLowerCase();
    return base.filter((c) =>
      c.name.includes(q) || c.title.includes(q) || c.company.includes(q) ||
      c.sector.includes(q) || c.city.includes(q) ||
      c.specialty.some((s) => s.toLowerCase().includes(term)),
    );
  }, [contacts, q, tab]);

  const connected = contacts.filter((c) => c.connected).length;

  const toggleConnect = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = !c.connected;
        toast.success(next ? `تم التواصل مع ${c.name}` : `تم إلغاء التواصل`);
        return { ...c, connected: next };
      }),
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Network className="size-6 text-primary" /> شبكة الأعمال
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{connected} متواصل · {contacts.length} جهة اتصال</p>
        </div>
        <Button size="sm" className="mulki-gold-bg gap-1" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> إضافة جهة اتصال
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة جهة اتصال</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input ref={nameRef} placeholder="الاسم *" />
              <Input ref={titleRef} placeholder="المسمى الوظيفي" />
              <Input ref={companyRef} placeholder="الشركة" />
              <div className="grid grid-cols-2 gap-2">
                <Input ref={sectorRef} placeholder="القطاع" />
                <Input ref={cityRef} placeholder="المدينة" />
              </div>
              <Input ref={specRef} placeholder="التخصصات (افصل بفاصلة ، )" />
              <Button className="w-full" onClick={handleAdd}>حفظ جهة الاتصال</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الشبكة", value: contacts.length, color: "text-primary" },
          { label: "متواصلون", value: connected, color: "text-emerald-500" },
          { label: "القطاعات", value: new Set(contacts.map((c) => c.sector)).size, color: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label} className="mulki-card p-4 text-center">
            <div className={cn("text-2xl font-bold mb-1", s.color)}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Search + Tab */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="ابحث بالاسم أو المسمى أو التخصص..." value={q} onChange={(e) => setQ(e.target.value)} className="pe-9" />
        </div>
        <div className="flex gap-2">
          {(["all", "connected"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "الكل" : "المتواصلون"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Network className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">لا توجد نتائج.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c, i) => (
            <Card key={c.id} className="mulki-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="size-12 rounded-full text-white grid place-items-center font-bold text-lg shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  {c.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                </div>
                {c.connected && (
                  <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 mt-1 animate-pulse" />
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {c.specialty.slice(0, 2).map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">{s}</span>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><MapPin className="size-3" />{c.city}</span>
                <span className="flex items-center gap-1"><Globe className="size-3" />{c.sector}</span>
                <span className="flex items-center gap-1"><Star className="size-3 fill-amber-400 text-amber-400" />{c.rating}</span>
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant={c.connected ? "outline" : "default"}
                  className="flex-1 gap-1"
                  onClick={() => toggleConnect(c.id)}
                >
                  <UserPlus className="size-3.5" />
                  {c.connected ? "متواصل" : "تواصل"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toast.info(`مراسلة ${c.name}`)}>
                  <MessageSquare className="size-3.5" /> مراسلة
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
