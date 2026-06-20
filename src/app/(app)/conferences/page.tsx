"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/uikit/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Calendar, Plus, MapPin, Users, ChevronDown, ChevronUp, Monitor } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type EventType = "مؤتمر" | "ورشة" | "ندوة" | "معرض";

type ConferenceEvent = {
  id: string;
  title: string;
  type: EventType;
  date: string;
  dateLabel: string;
  location: string;
  description: string;
  registered: number;
  registeredLabel: string;
  past: boolean;
  online: boolean;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const EVENTS: ConferenceEvent[] = [
  {
    id: "e1",
    title: "ملتقى المنشآت الخليجي 2026",
    type: "مؤتمر",
    date: "2026-07-15",
    dateLabel: "15 يوليو 2026",
    location: "الرياض — فندق إنتركونتيننتال",
    description: "ملتقى سنوي يجمع كبار رواد الأعمال ومتخذي القرار في منطقة الخليج لمناقشة مستقبل بيئة الأعمال والفرص الاستثمارية.",
    registered: 450,
    registeredLabel: "450 مسجّل",
    past: false,
    online: false,
  },
  {
    id: "e2",
    title: "ورشة عمل: التحول الرقمي للمؤسسات",
    type: "ورشة",
    date: "2026-06-28",
    dateLabel: "28 يونيو 2026",
    location: "عبر الإنترنت",
    description: "ورشة تفاعلية تتناول أفضل ممارسات التحول الرقمي في المؤسسات الحكومية والخاصة، مع دراسات حالة من السوق السعودي.",
    registered: 120,
    registeredLabel: "120 مسجّل",
    past: false,
    online: true,
  },
  {
    id: "e3",
    title: "معرض العقار السعودي",
    type: "معرض",
    date: "2026-08-10",
    dateLabel: "10 أغسطس 2026",
    location: "جدة — مركز الملك عبدالعزيز الدولي للمؤتمرات",
    description: "أكبر معرض عقاري في المملكة يضم أبرز المطورين العقاريين والمستثمرين والمشاريع السكنية والتجارية.",
    registered: 1200,
    registeredLabel: "1,200 زائر متوقع",
    past: false,
    online: false,
  },
  {
    id: "e4",
    title: "ندوة الحوكمة المؤسسية",
    type: "ندوة",
    date: "2026-07-05",
    dateLabel: "5 يوليو 2026",
    location: "الدمام — غرفة الشرقية",
    description: "ندوة متخصصة تناقش معايير الحوكمة المؤسسية وتطبيقها في الشركات العائلية والمؤسسات الناشئة.",
    registered: 80,
    registeredLabel: "80 مسجّل",
    past: false,
    online: false,
  },
  {
    id: "e5",
    title: "مؤتمر رواد الأعمال 2025",
    type: "مؤتمر",
    date: "2025-11-20",
    dateLabel: "20 نوفمبر 2025",
    location: "الرياض — مركز الملك عبدالله المالي",
    description: "مؤتمر سنوي حضره أكثر من 600 رائد أعمال من القطاعين الحكومي والخاص.",
    registered: 620,
    registeredLabel: "620 مسجّل",
    past: true,
    online: false,
  },
  {
    id: "e6",
    title: "ورشة إدارة المشاريع Agile",
    type: "ورشة",
    date: "2025-09-15",
    dateLabel: "15 سبتمبر 2025",
    location: "عبر الإنترنت",
    description: "ورشة تدريبية على منهجيات إدارة المشاريع الرشيقة وتطبيقها في بيئة العمل العربية.",
    registered: 95,
    registeredLabel: "95 مسجّل",
    past: true,
    online: true,
  },
];

const TYPE_COLORS: Record<EventType, string> = {
  "مؤتمر": "bg-purple-100 text-purple-700",
  "ورشة": "bg-blue-100 text-blue-700",
  "ندوة": "bg-amber-100 text-amber-700",
  "معرض": "bg-green-100 text-green-700",
};

const EVENT_TYPES: EventType[] = ["مؤتمر", "ورشة", "ندوة", "معرض"];

// ─── Inline primitives ────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium block mb-1.5">{children}</label>;
}

// Group events by month
function groupByMonth(events: ConferenceEvent[]) {
  const groups: Record<string, ConferenceEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.date);
    const key = d.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }
  return groups;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConferencesPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "", type: "مؤتمر" as EventType, date: "", location: "", description: "",
  });

  const upcomingEvents = EVENTS.filter((e) => !e.past);
  const pastEvents = EVENTS.filter((e) => e.past);
  const displayEvents = tab === "upcoming" ? upcomingEvents : pastEvents;

  const calendarGroups = groupByMonth(
    [...upcomingEvents].sort((a, b) => a.date.localeCompare(b.date)),
  );

  function toggleMonth(month: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function handleAdd() {
    if (!form.title || !form.date || !form.location) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    toast.success("تمت إضافة الفعالية بنجاح");
    setAddOpen(false);
    setForm({ title: "", type: "مؤتمر", date: "", location: "", description: "" });
  }

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl mulki-gold-bg flex items-center justify-center">
            <Calendar className="size-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">المؤتمرات والفعاليات</h1>
            <p className="text-sm text-muted-foreground">إدارة الفعاليات والمؤتمرات المنشآتية</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4 ms-2" />
          إضافة فعالية
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "الفعاليات القادمة", value: upcomingEvents.length },
          { label: "مسجّل فيها", value: upcomingEvents.reduce((s, e) => s + e.registered, 0).toLocaleString("ar-SA") },
          { label: "الفعاليات السابقة", value: pastEvents.length },
        ].map(({ label, value }) => (
          <Card key={label} className="mulki-card p-4">
            <div className="font-display text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit border border-border">
            {(["upcoming", "past"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 rounded-md text-sm font-medium transition-colors",
                  tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "upcoming" ? "القادمة" : "السابقة"}
              </button>
            ))}
          </div>

          {/* Event Cards */}
          {displayEvents.length === 0 ? (
            <Card className="mulki-card p-10 text-center">
              <Calendar className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد فعاليات في هذا القسم</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>

        {/* Calendar Mini-view */}
        <div className="lg:w-72 flex-shrink-0">
          <Card className="mulki-card p-4">
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              التقويم القادم
            </h3>
            {Object.entries(calendarGroups).map(([month, evs]) => {
              const isExpanded = expandedMonths.has(month);
              return (
                <div key={month} className="mb-3">
                  <button
                    type="button"
                    onClick={() => toggleMonth(month)}
                    className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground py-1 border-b border-border"
                  >
                    <span>{month}</span>
                    {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                  {(isExpanded ? evs : evs.slice(0, 2)).map((ev) => (
                    <div key={ev.id} className="py-2 flex items-start gap-2 text-sm border-b border-border/50 last:border-0">
                      <span className={cn("inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium", TYPE_COLORS[ev.type])}>
                        {ev.type}
                      </span>
                      <div>
                        <div className="font-medium text-xs leading-snug">{ev.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{ev.dateLabel}</div>
                      </div>
                    </div>
                  ))}
                  {!isExpanded && evs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => toggleMonth(month)}
                      className="text-[10px] text-primary mt-1"
                    >
                      +{evs.length - 2} أخرى
                    </button>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة فعالية جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان الفعالية *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="اكتب عنوان الفعالية"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>النوع</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>التاريخ *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>الموقع *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="المدينة — الموقع أو عبر الإنترنت"
              />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف مختصر للفعالية وأهدافها"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd}>
              <Plus className="size-4 ms-2" />
              إضافة الفعالية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: ConferenceEvent }) {
  const [registered, setRegistered] = useState(false);

  function handleRegister() {
    setRegistered(true);
    toast.success(`تم التسجيل في "${event.title}" بنجاح`);
  }

  return (
    <Card className="mulki-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="size-12 rounded-xl bg-muted flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold leading-none">
              {new Date(event.date).getDate()}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase">
              {new Date(event.date).toLocaleDateString("ar-SA", { month: "short" })}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", TYPE_COLORS[event.type])}>
                {event.type}
              </span>
              {event.online && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 rounded-md px-2 py-0.5">
                  <Monitor className="size-3" />
                  عبر الإنترنت
                </span>
              )}
            </div>
            <h3 className="font-display font-semibold text-base leading-snug">{event.title}</h3>
          </div>
        </div>
        {!event.past && (
          <Button
            size="sm"
            variant={registered ? "outline" : "default"}
            onClick={handleRegister}
            disabled={registered}
          >
            {registered ? "مسجّل ✓" : "التسجيل"}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{event.description}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          {event.dateLabel}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3" />
          {event.location}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {event.registeredLabel}
        </span>
      </div>
    </Card>
  );
}
