"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  Calendar, Video, Plus, MapPin, Clock, Users, Loader2, CheckCircle2,
} from "lucide-react";
import { getMeetings, createMeeting } from "@/app/actions/org";
import type { Meeting } from "@/app/actions/org";

const IMPORTANCE_LABEL: Record<string, string> = {
  high: "عالي",
  normal: "عادي",
  low: "منخفض",
};

const INTEGRATION_CHIPS = [
  { name: "Teams", color: "bg-blue-600" },
  { name: "Zoom", color: "bg-blue-500" },
  { name: "Meet", color: "bg-emerald-600" },
  { name: "Webex", color: "bg-indigo-600" },
];

function ImportanceBadge({ importance }: { importance: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", styles[importance] ?? styles.normal)}>
      {IMPORTANCE_LABEL[importance] ?? importance}
    </span>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const date = meeting.starts_at ? new Date(meeting.starts_at) : null;

  const handleJoin = () => {
    const loc = meeting.location?.trim();
    if (loc && (loc.startsWith("http://") || loc.startsWith("https://"))) {
      window.open(loc, "_blank", "noopener,noreferrer");
    } else {
      toast.info("لا يوجد رابط للانضمام — أضف رابطاً عند إنشاء الاجتماع");
    }
  };

  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meeting.description}</p>
          )}
        </div>
        <ImportanceBadge importance={meeting.importance ?? "normal"} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {meeting.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" /> {meeting.location}
          </span>
        )}
        {date && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {date.toLocaleDateString("ar-EG")} — {date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1 bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)]"
          onClick={handleJoin}
        >
          <Video className="size-3.5" /> انضمام
        </Button>
        <Button size="sm" variant="outline" className="gap-1">
          <Users className="size-3.5" /> تفاصيل
        </Button>
      </div>
    </Card>
  );
}

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  date: "",
  time: "",
  importance: "normal",
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "done">("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [liveData, setLiveData] = useState(false);

  useEffect(() => {
    getMeetings().then((res) => {
      if (res.ok) {
        setMeetings(res.meetings);
        setLiveData(true);
      }
      setLoading(false);
    });
  }, []);

  const upcoming = meetings.filter((m) => m.status !== "completed" && m.status !== "done");
  const done = meetings.filter((m) => m.status === "completed" || m.status === "done");
  const displayed = tab === "upcoming" ? upcoming : done;

  async function handleCreate() {
    if (!form.title.trim()) {
      toast.error("عنوان الاجتماع مطلوب");
      return;
    }
    if (!form.date) { toast.error("التاريخ مطلوب"); return; }
    setSaving(true);
    const starts_at = form.time ? `${form.date}T${form.time}` : form.date;
    const res = await createMeeting({
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      starts_at,
      importance: form.importance,
    });
    if (res.ok) {
      toast.success("تم إنشاء الاجتماع بنجاح");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      // Refresh
      const fresh = await getMeetings();
      if (fresh.ok) setMeetings(fresh.meetings);
    } else {
      toast.error(res.error ?? "حدث خطأ أثناء الإنشاء");
    }
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_50%)] grid place-items-center">
              <Calendar className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-primary">الاجتماعات</h1>
              {liveData && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  اجتماعات حقيقية من قاعدة البيانات
                </span>
              )}
            </div>
          </div>
          <Button
            className="gap-1 bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)]"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" /> اجتماع جديد
          </Button>
        </div>

        {/* Integration chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">تكاملات:</span>
          {INTEGRATION_CHIPS.map((chip) => (
            <span
              key={chip.name}
              className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white", chip.color)}
            >
              <Video className="size-3" /> {chip.name}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          {([["upcoming", "القادمة", upcoming.length], ["done", "المنجزة", done.length]] as const).map(([val, lbl, count]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTab(val)}
              className={cn(
                "px-5 py-2 text-sm font-medium transition-colors",
                tab === val
                  ? "bg-[hsl(217_91%_50%)] text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {lbl}
              <span className={cn("mr-1.5 text-[11px] rounded-full px-1.5 py-0.5", tab === val ? "bg-white/20" : "bg-muted")}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" /> جارٍ التحميل...
          </div>
        ) : displayed.length === 0 ? (
          <Card className="mulki-card p-12 text-center">
            <CheckCircle2 className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {tab === "upcoming" ? "لا توجد اجتماعات قادمة" : "لا توجد اجتماعات منجزة"}
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اجتماع جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">العنوان *</label>
              <Input
                placeholder="عنوان الاجتماع"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الوصف</label>
              <Textarea
                placeholder="وصف مختصر..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الموقع / الرابط</label>
              <Input
                placeholder="قاعة 3 أو رابط Zoom..."
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">التاريخ</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">الوقت</label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الأهمية</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.importance}
                onChange={(e) => setForm((f) => ({ ...f, importance: e.target.value }))}
              >
                <option value="high">عالي</option>
                <option value="normal">عادي</option>
                <option value="low">منخفض</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              disabled={saving}
              onClick={handleCreate}
              className="bg-[hsl(217_91%_50%)] hover:bg-[hsl(217_91%_45%)] gap-1"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
