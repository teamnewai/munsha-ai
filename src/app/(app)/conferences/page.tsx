"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Presentation, MapPin, Calendar, Users, Globe, ExternalLink, Bookmark, BookmarkCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Conference = {
  id: string;
  name: string;
  organizer: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  sector: string;
  attendees: number;
  status: "upcoming" | "ongoing" | "past";
  website: string;
  featured: boolean;
};

// لا مؤتمرات وهمية — تُضاف المؤتمرات الحقيقية عبر زر «إضافة» وتظهر هنا.
const CONFERENCES: Conference[] = [];

const STATUS_LABEL: Record<string, string> = { upcoming: "قادم", ongoing: "جارٍ الآن", past: "منتهي" };
const STATUS_COLOR: Record<string, string> = {
  upcoming: "bg-blue-500/15 text-blue-500",
  ongoing: "bg-emerald-500/15 text-emerald-500",
  past: "bg-muted text-muted-foreground",
};

function formatRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
  return `${s} — ${e}`;
}

export default function ConferencesPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "ongoing" | "past">("all");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<Conference[]>(CONFERENCES);
  const [open, setOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const orgRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const sectorRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const visible = filter === "all" ? events : events.filter((c) => c.status === filter);

  const handleAdd = () => {
    const name = nameRef.current?.value.trim();
    const start = startRef.current?.value;
    if (!name || !start) { toast.error("الاسم وتاريخ البدء مطلوبان"); return; }
    const end = endRef.current?.value || start;
    const now = new Date().toISOString().slice(0, 10);
    const status: Conference["status"] = start > now ? "upcoming" : end < now ? "past" : "ongoing";
    const newEvent: Conference = {
      id: `e${Date.now()}`,
      name,
      organizer: orgRef.current?.value.trim() || "—",
      city: cityRef.current?.value.trim() || "—",
      country: countryRef.current?.value.trim() || "المملكة العربية السعودية",
      startDate: start,
      endDate: end,
      sector: sectorRef.current?.value.trim() || "عام",
      attendees: 0,
      status,
      website: "—",
      featured: false,
    };
    setEvents((prev) => [newEvent, ...prev]);
    toast.success("تمت إضافة المؤتمر بنجاح");
    setOpen(false);
  };

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.info("تم إلغاء الحفظ"); }
      else { next.add(id); toast.success("تم حفظ المؤتمر"); }
      return next;
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Presentation className="size-6 text-primary" /> المؤتمرات والملتقيات
          </h2>
          <p className="text-sm text-muted-foreground mt-1">أبرز الفعاليات والمؤتمرات في قطاع الأعمال</p>
        </div>
        <Button size="sm" className="mulki-gold-bg gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> إضافة مؤتمر
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مؤتمر / فعالية</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input ref={nameRef} placeholder="اسم المؤتمر *" />
              <Input ref={orgRef} placeholder="الجهة المنظّمة" />
              <Input ref={sectorRef} placeholder="القطاع" />
              <div className="grid grid-cols-2 gap-2">
                <Input ref={cityRef} placeholder="المدينة" />
                <Input ref={countryRef} placeholder="الدولة" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ البدء *</label>
                  <Input ref={startRef} type="date" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ الانتهاء</label>
                  <Input ref={endRef} type="date" />
                </div>
              </div>
              <Button className="w-full" onClick={handleAdd}>حفظ المؤتمر</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "القادمة", count: events.filter((c) => c.status === "upcoming").length, color: "text-blue-500", filter: "upcoming" },
          { label: "جارية الآن", count: events.filter((c) => c.status === "ongoing").length, color: "text-emerald-500", filter: "ongoing" },
          { label: "المنتهية", count: events.filter((c) => c.status === "past").length, color: "text-muted-foreground", filter: "past" },
        ] as const).map((s) => (
          <Card
            key={s.label}
            className="mulki-card p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setFilter(s.filter)}
          >
            <div className={cn("text-2xl font-bold mb-1", s.color)}>{s.count}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "upcoming", "ongoing", "past"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "الكل" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Featured */}
      {filter === "all" && (
        <div>
          <h3 className="font-display font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">مميزة</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {events.filter((c) => c.featured).map((c) => (
              <Card key={c.id} className="mulki-card p-5 border-primary/30 bg-primary/5 relative overflow-hidden">
                <div className="absolute top-3 left-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", STATUS_COLOR[c.status])}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="flex items-start gap-3 mb-3 pe-16">
                  <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                    <Presentation className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold leading-snug">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.organizer}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Calendar className="size-3" />{formatRange(c.startDate, c.endDate)}</span>
                  <span className="flex items-center gap-1"><MapPin className="size-3" />{c.city}، {c.country}</span>
                  <span className="flex items-center gap-1"><Users className="size-3" />{c.attendees.toLocaleString("ar-SA")} مشارك</span>
                  <span className="flex items-center gap-1"><Globe className="size-3" />{c.sector}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toggleSave(c.id)}>
                    {saved.has(c.id) ? <BookmarkCheck className="size-3.5 text-primary" /> : <Bookmark className="size-3.5" />}
                    {saved.has(c.id) ? "محفوظ" : "حفظ"}
                  </Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={() => toast.info(c.website)}>
                    التسجيل <ExternalLink className="size-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All list */}
      <div>
        {filter === "all" && <h3 className="font-display font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">جميع الفعاليات</h3>}
        {events.length === 0 && (
          <Card className="mulki-card p-12 text-center">
            <Presentation className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground mb-1">لا توجد مؤتمرات بعد.</p>
            <p className="text-xs text-muted-foreground">أضف فعالية عبر زر «إضافة مؤتمر» لتظهر هنا.</p>
          </Card>
        )}
        <div className="space-y-3">
          {visible.filter((c) => filter !== "all" || !c.featured).map((c) => (
            <Card key={c.id} className="mulki-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
                  <Presentation className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-sm">{c.name}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[c.status])}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{c.organizer}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="size-3" />{formatRange(c.startDate, c.endDate)}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{c.city}</span>
                    <span className="flex items-center gap-1"><Users className="size-3" />{c.attendees.toLocaleString("ar-SA")}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleSave(c.id)}>
                    {saved.has(c.id) ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.info(c.website)}>
                    <ExternalLink className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
