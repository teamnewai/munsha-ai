"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Bell, CheckCheck, Trash2, Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "الآن";
  if (d < 3600) return `${Math.floor(d / 60)} دقيقة`;
  if (d < 86400) return `${Math.floor(d / 3600)} ساعة`;
  return `${Math.floor(d / 86400)} يوم`;
}

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

const INITIAL: NotificationRow[] = [
  {
    id: "n1", kind: "المعاملات", title: "معاملة مرتجعة من المدير المباشر",
    body: "تم إرجاع المعاملة رقم 1254 لإكمال المرفقات المطلوبة.", link: "/workflows",
    entity_type: "معاملة", read_at: null, created_at: ago(8),
  },
  {
    id: "n2", kind: "المعاملات", title: "تمت الموافقة على طلب الإجازة",
    body: "اعتمد القسم المالي طلب إجازتك السنوية.", link: "/service-requests",
    entity_type: "طلب", read_at: null, created_at: ago(45),
  },
  {
    id: "n3", kind: "الاجتماعات", title: "تذكير: اجتماع مجلس الإدارة",
    body: "يبدأ الاجتماع الساعة 10:00 صباحاً في قاعة الاجتماعات الرئيسية.", link: "/meetings",
    entity_type: "اجتماع", read_at: null, created_at: ago(120),
  },
  {
    id: "n4", kind: "الاجتماعات", title: "تم تحديث موعد اجتماع الفريق",
    body: "نُقل الاجتماع من الثلاثاء إلى الأربعاء الساعة 1:00 ظهراً.", link: "/meetings",
    entity_type: "اجتماع", read_at: ago(300), created_at: ago(360),
  },
  {
    id: "n5", kind: "النظام", title: "اكتمل النسخ الاحتياطي للبيانات",
    body: "تم حفظ نسخة احتياطية كاملة بنجاح.", link: null,
    entity_type: null, read_at: ago(600), created_at: ago(720),
  },
  {
    id: "n6", kind: "النظام", title: "تقرير التدقيق الأمني جاهز",
    body: "لا توجد نتائج حرجة في آخر فحص أمني.", link: "/security-audit",
    entity_type: "تقرير", read_at: ago(1000), created_at: ago(1440),
  },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>(INITIAL);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [q, setQ] = useState("");

  const visible = useMemo(
    () => (tab === "unread" ? items.filter((n) => !n.read_at) : items),
    [items, tab],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return visible;
    const term = q.trim().toLowerCase();
    return visible.filter((n) =>
      n.title.toLowerCase().includes(term) ||
      (n.body ?? "").toLowerCase().includes(term) ||
      n.kind.toLowerCase().includes(term)
    );
  }, [visible, q]);

  const groups = useMemo(() => {
    const out: Record<string, NotificationRow[]> = {};
    for (const n of filtered) {
      out[n.kind] = out[n.kind] ?? [];
      out[n.kind].push(n);
    }
    return out;
  }, [filtered]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = (id: string) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  const markAll = () =>
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  const remove = (id: string) => setItems((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Bell className="size-6 text-primary" /> مركز الإشعارات
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck className="size-4 ms-2" /> تعليم الكل كمقروء
          </Button>
        )}
      </div>

      <Card className="mulki-card p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                tab === "all" && "bg-background text-foreground shadow-sm",
              )}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setTab("unread")}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                tab === "unread" && "bg-background text-foreground shadow-sm",
              )}
            >
              غير المقروءة {unreadCount > 0 && (
                <span className="ms-2 inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{unreadCount}</span>
              )}
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ابحث في الإشعارات..." value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Inbox className="size-10 mx-auto mb-3 opacity-50" />
            لا توجد إشعارات.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([kind, list]) => (
              <div key={kind}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  {kind} <span className="text-muted-foreground/60">({list.length})</span>
                </div>
                <div className="space-y-1.5">
                  {list.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "group flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/40 transition-colors",
                        !n.read_at && "bg-primary/5 border-primary/30"
                      )}
                    >
                      <div className={cn("size-2 rounded-full mt-2 shrink-0", !n.read_at ? "bg-primary" : "bg-transparent")} />
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (!n.read_at) markRead(n.id);
                          if (n.link) router.push(n.link);
                        }}
                      >
                        <div className="font-medium text-sm">{n.title}</div>
                        {n.body && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</div>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                          {n.entity_type && (
                            <span className="inline-flex items-center rounded-md border border-border px-1.5 text-[10px] h-4">{n.entity_type}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read_at && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => markRead(n.id)} aria-label="تعليم كمقروء">
                            <CheckCheck className="size-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(n.id)} aria-label="حذف">
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
