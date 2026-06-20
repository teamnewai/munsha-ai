"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Network, Search, MapPin, Star, MessageSquare, UserPlus, Globe, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { DemoBanner } from "@/components/DemoBanner";
import {
  getContacts, addContact, toggleContactConnection, deleteContact,
  type ContactRow as Contact,
} from "@/app/actions/contacts";

const DEMO_CONTACTS: Contact[] = [
  { id: "d1", name: "جهة تجريبية ١", title: "مدير عام", company: "شركة تجريبية", sector: "تقنية المعلومات", city: "تجريبي", specialty: ["تجريبي"], rating: 0, connected: false, avatar: "ت" },
  { id: "d2", name: "جهة تجريبية ٢", title: "مديرة الموارد البشرية", company: "شركة تجريبية", sector: "الموارد البشرية", city: "تجريبي", specialty: ["تجريبي"], rating: 0, connected: false, avatar: "ت" },
  { id: "d3", name: "جهة تجريبية ٣", title: "مستشار مالي", company: "شركة تجريبية", sector: "المال", city: "تجريبي", specialty: ["تجريبي"], rating: 0, connected: false, avatar: "ت" },
];

const COLORS = ["#6366f1", "#C9A24B", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function NetworkPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "connected">("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const sectorRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const specRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getContacts().then((r) => { if (alive) { setContacts(r.contacts); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const isDemo = !loading && contacts.length === 0;
  const source = isDemo ? DEMO_CONTACTS : contacts;

  const handleAdd = async () => {
    const name = nameRef.current?.value.trim();
    if (!name) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    const specStr = specRef.current?.value.trim() || "";
    const specialty = specStr ? specStr.split("،").map((s) => s.trim()).filter(Boolean) : [];
    const res = await addContact({
      name,
      title: titleRef.current?.value.trim(),
      company: companyRef.current?.value.trim(),
      sector: sectorRef.current?.value.trim(),
      city: cityRef.current?.value.trim(),
      specialty,
    });
    setSaving(false);
    if (!res.ok || !res.contact) { toast.error(res.error || "تعذّرت الإضافة"); return; }
    setContacts((prev) => [res.contact!, ...prev]);
    toast.success("تمت إضافة جهة الاتصال بنجاح");
    setOpen(false);
    if (nameRef.current) nameRef.current.value = "";
    if (titleRef.current) titleRef.current.value = "";
    if (companyRef.current) companyRef.current.value = "";
    if (sectorRef.current) sectorRef.current.value = "";
    if (cityRef.current) cityRef.current.value = "";
    if (specRef.current) specRef.current.value = "";
  };

  const handleToggleConnect = async (id: string) => {
    if (isDemo) { toast.info("أضف جهات اتصال حقيقية أولاً"); return; }
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    const next = !c.connected;
    setContacts((prev) => prev.map((x) => x.id === id ? { ...x, connected: next } : x));
    toast.success(next ? `تم التواصل مع ${c.name}` : "تم إلغاء التواصل");
    await toggleContactConnection(id, next);
  };

  const handleDelete = async (id: string) => {
    if (isDemo) return;
    setContacts((prev) => prev.filter((x) => x.id !== id));
    await deleteContact(id);
    toast.info("تم حذف جهة الاتصال");
  };

  const visible = useMemo(() => {
    const base = tab === "connected" ? source.filter((c) => c.connected) : source;
    if (!q.trim()) return base;
    return base.filter((c) =>
      c.name.includes(q) || c.title.includes(q) || c.company.includes(q) ||
      c.sector.includes(q) || c.city.includes(q) ||
      c.specialty.some((s) => s.includes(q)),
    );
  }, [source, q, tab]);

  const connected = source.filter((c) => c.connected).length;

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {isDemo && <DemoBanner />}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Network className="size-6 text-primary" /> شبكة الأعمال
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{connected} متواصل · {source.length} جهة اتصال</p>
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
              <Button className="w-full" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin ms-2" />}حفظ جهة الاتصال
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الشبكة", value: source.length, color: "text-primary" },
          { label: "متواصلون", value: connected, color: "text-emerald-500" },
          { label: "القطاعات", value: new Set(source.map((c) => c.sector)).size, color: "text-amber-500" },
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
      {loading ? (
        <Card className="mulki-card p-12 text-center">
          <Loader2 className="size-8 text-primary mx-auto animate-spin" />
        </Card>
      ) : visible.length === 0 ? (
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
                  onClick={() => handleToggleConnect(c.id)}
                >
                  <UserPlus className="size-3.5" />
                  {c.connected ? "متواصل" : "تواصل"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toast.info(`مراسلة ${c.name}`)}>
                  <MessageSquare className="size-3.5" /> مراسلة
                </Button>
                {!isDemo && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
