"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/uikit/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Globe, Plus, Search, Users, Link2, Clock, X, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Connection = {
  id: string;
  name: string;
  initials: string;
  title: string;
  company: string;
  industry: string;
  mutualConnections: number;
  connected: boolean;
};

type PendingRequest = {
  id: string;
  name: string;
  initials: string;
  title: string;
  company: string;
  sentAt: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const CONNECTIONS: Connection[] = [
  { id: "cn1", name: "أحمد المعيوف", initials: "أم", title: "المدير التنفيذي", company: "شركة الخليج", industry: "عقارات", mutualConnections: 8, connected: true },
  { id: "cn2", name: "سلمى القحطاني", initials: "سق", title: "مدير المشاريع", company: "مجموعة زهران", industry: "مقاولات", mutualConnections: 5, connected: true },
  { id: "cn3", name: "فهد الشمري", initials: "فش", title: "رئيس التقنية", company: "أوراكل السعودية", industry: "تقنية", mutualConnections: 12, connected: true },
  { id: "cn4", name: "نورة العتيبي", initials: "نع", title: "مدير التسويق", company: "بوابة سلة", industry: "تجارة إلكترونية", mutualConnections: 3, connected: true },
  { id: "cn5", name: "عمر الدوسري", initials: "عد", title: "مستشار قانوني", company: "مكتب الزيد", industry: "قانون", mutualConnections: 6, connected: true },
  { id: "cn6", name: "ريم الحربي", initials: "رح", title: "مدير المالية", company: "مصرف الراجحي", industry: "مالية", mutualConnections: 9, connected: true },
  { id: "cn7", name: "بندر الغامدي", initials: "بغ", title: "مدير الموارد البشرية", company: "شركة أرامكو", industry: "طاقة", mutualConnections: 4, connected: false },
  { id: "cn8", name: "لمياء الزهراني", initials: "لز", title: "رئيس العمليات", company: "شركة النخيل", industry: "مقاولات", mutualConnections: 2, connected: false },
  { id: "cn9", name: "خالد العمري", initials: "خع", title: "مدير المبيعات", company: "التقنية الحديثة", industry: "تقنية", mutualConnections: 7, connected: true },
  { id: "cn10", name: "منى الشهراني", initials: "مش", title: "المدير العام", company: "مجموعة الاختيار", industry: "عقارات", mutualConnections: 11, connected: true },
  { id: "cn11", name: "طارق الحميد", initials: "طح", title: "رئيس التطوير", company: "بنك الإنماء", industry: "مالية", mutualConnections: 5, connected: false },
  { id: "cn12", name: "هيا الجهني", initials: "هج", title: "مستشار الأعمال", company: "برايس ووتر هاوس", industry: "استشارات", mutualConnections: 8, connected: true },
];

const PENDING_REQUESTS: PendingRequest[] = [
  { id: "p1", name: "وليد المنصور", initials: "وم", title: "مدير الشراكات", company: "شركة المنصور", sentAt: "قبل يومين" },
  { id: "p2", name: "أسماء الوهيبي", initials: "أو", title: "رائدة أعمال", company: "مؤسسة الوهيبي", sentAt: "قبل 5 أيام" },
  { id: "p3", name: "سعد الحمدان", initials: "سح", title: "مستثمر", company: "صندوق الحمدان", sentAt: "قبل أسبوع" },
];

const INDUSTRIES = ["الكل", "عقارات", "مقاولات", "تقنية", "مالية", "قانون", "تجارة إلكترونية", "طاقة", "استشارات"];

const INDUSTRY_COLORS: Record<string, string> = {
  "عقارات": "bg-amber-100 text-amber-700",
  "مقاولات": "bg-orange-100 text-orange-700",
  "تقنية": "bg-blue-100 text-blue-700",
  "مالية": "bg-green-100 text-green-700",
  "قانون": "bg-purple-100 text-purple-700",
  "تجارة إلكترونية": "bg-pink-100 text-pink-700",
  "طاقة": "bg-yellow-100 text-yellow-700",
  "استشارات": "bg-indigo-100 text-indigo-700",
};

// ─── Inline primitives ────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium block mb-1.5">{children}</label>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const [connections, setConnections] = useState<Connection[]>(CONNECTIONS);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>(PENDING_REQUESTS);
  const [query, setQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("الكل");
  const [connectOpen, setConnectOpen] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [connectForm, setConnectForm] = useState({ name: "", company: "", message: "" });

  const filtered = connections.filter((c) => {
    const matchIndustry = industryFilter === "الكل" || c.industry === industryFilter;
    const matchQuery =
      !query ||
      c.name.includes(query) ||
      c.company.includes(query) ||
      c.title.includes(query) ||
      c.industry.includes(query);
    return matchIndustry && matchQuery;
  });

  const connectedCount = connections.filter((c) => c.connected).length;
  const industries = Array.from(new Set(connections.map((c) => c.industry))).length;

  function handleConnect(id: string) {
    setConnections((prev) =>
      prev.map((c) => c.id === id ? { ...c, connected: true } : c)
    );
    const conn = connections.find((c) => c.id === id);
    toast.success(`تم إرسال طلب التواصل إلى ${conn?.name}`);
  }

  function handleAccept(id: string) {
    const req = pendingRequests.find((r) => r.id === id);
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success(`تم قبول طلب ${req?.name}`);
  }

  function handleDecline(id: string) {
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
    toast.info("تم رفض الطلب");
  }

  function handleSendRequest() {
    if (!connectForm.name || !connectForm.company) {
      toast.error("يرجى إدخال الاسم والشركة");
      return;
    }
    toast.success(`تم إرسال طلب التواصل إلى ${connectForm.name}`);
    setConnectOpen(false);
    setConnectForm({ name: "", company: "", message: "" });
  }

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl mulki-gold-bg flex items-center justify-center">
            <Globe className="size-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">شبكة الأعمال</h1>
            <p className="text-sm text-muted-foreground">إدارة علاقاتك المهنية والاتصالات التجارية</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPending(!showPending)} className="relative">
            <Clock className="size-4 ms-2" />
            طلبات معلّقة
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -left-1 size-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </Button>
          <Button onClick={() => setConnectOpen(true)}>
            <Plus className="size-4 ms-2" />
            طلب اتصال
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي الاتصالات", value: connections.length, icon: Users },
          { label: "اتصالات نشطة", value: connectedCount, icon: Link2 },
          { label: "القطاعات", value: industries, icon: Globe },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="mulki-card p-4">
            <div className="flex items-center gap-3">
              <Icon className="size-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالاسم أو الشركة أو المسمى الوظيفي…"
                className="pe-9"
              />
            </div>
          </div>

          {/* Industry Filter */}
          <div className="flex gap-2 flex-wrap">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setIndustryFilter(ind)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  industryFilter === ind
                    ? "mulki-gold-bg border-transparent text-white"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {ind}
              </button>
            ))}
          </div>

          {/* Connections Grid */}
          {filtered.length === 0 ? (
            <Card className="mulki-card p-10 text-center">
              <Users className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد اتصالات تطابق البحث</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  connection={conn}
                  onConnect={() => handleConnect(conn.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests Sidebar */}
        {showPending && (
          <div className="lg:w-72 flex-shrink-0">
            <Card className="mulki-card p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  طلبات معلّقة
                </h3>
                <button type="button" onClick={() => setShowPending(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات معلّقة</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-9 rounded-full mulki-gold-bg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {req.initials}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{req.name}</div>
                          <div className="text-xs text-muted-foreground">{req.title} — {req.company}</div>
                          <div className="text-[10px] text-muted-foreground">{req.sentAt}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => handleAccept(req.id)}>
                          قبول
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDecline(req.id)}>
                          رفض
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إرسال طلب اتصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الاسم الكامل *</Label>
              <Input
                value={connectForm.name}
                onChange={(e) => setConnectForm({ ...connectForm, name: e.target.value })}
                placeholder="اسم الشخص الذي تريد التواصل معه"
              />
            </div>
            <div>
              <Label>الشركة / المؤسسة *</Label>
              <Input
                value={connectForm.company}
                onChange={(e) => setConnectForm({ ...connectForm, company: e.target.value })}
                placeholder="اسم الجهة"
              />
            </div>
            <div>
              <Label>رسالة التواصل (اختياري)</Label>
              <Textarea
                value={connectForm.message}
                onChange={(e) => setConnectForm({ ...connectForm, message: e.target.value })}
                placeholder="أكتب رسالة تعريفية مختصرة…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>إلغاء</Button>
            <Button onClick={handleSendRequest}>
              <Link2 className="size-4 ms-2" />
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────
function ConnectionCard({ connection, onConnect }: { connection: Connection; onConnect: () => void }) {
  return (
    <Card className="mulki-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-xl mulki-gold-bg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {connection.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{connection.name}</div>
          <div className="text-xs text-muted-foreground">{connection.title}</div>
          <div className="text-xs text-muted-foreground truncate">{connection.company}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", INDUSTRY_COLORS[connection.industry] ?? "bg-secondary text-secondary-foreground")}>
          {connection.industry}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="size-3" />
          {connection.mutualConnections} مشترك
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        {connection.connected ? (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(`فتح ملف ${connection.name}`)}>
              عرض الملف
            </Button>
            <Button size="sm" className="flex-1" onClick={() => toast.info(`فتح محادثة مع ${connection.name}`)}>
              تواصل
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(`فتح ملف ${connection.name}`)}>
              عرض الملف
            </Button>
            <Button size="sm" className="flex-1" onClick={onConnect}>
              <ChevronRight className="size-3 ms-1" />
              تواصل
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
