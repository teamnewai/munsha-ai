"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMarketServices, publishMarketService, requestMarketService, type MarketService } from "@/app/actions/org";
import { toast } from "@/lib/toast";
import { ShoppingBag, Plus, Tag, Package, Loader2, Search, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";

function formatPrice(price: number, currency: string) {
  if (currency === "SAR") return `${price.toLocaleString("ar-SA")} ريال`;
  if (currency === "USD") return `$${price.toLocaleString()}`;
  return `${price} ${currency}`;
}

export default function MarketplacePage() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [requesting, setRequesting] = useState<string | null>(null);

  const handleRequest = async (s: MarketService) => {
    setRequesting(s.id);
    const res = await requestMarketService(s.id);
    setRequesting(null);
    if (res.ok) {
      toast.success(res.routedTo ? `تم إرسال طلبك وتوجيهه إلى ${res.routedTo}` : "تم إرسال طلبك بنجاح");
    } else {
      toast.error(res.error || "تعذّر إرسال الطلب");
    }
  };

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const catRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await getMarketServices();
    if (res.ok) { setServices(res.services); setLive(true); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = ["all", ...Array.from(new Set(services.map((s) => s.category)))];
  const visible = services.filter((s) => {
    const matchCat = category === "all" || s.category === category;
    const matchQ = !q.trim() || s.title.includes(q) || (s.description ?? "").includes(q);
    return matchCat && matchQ;
  });

  const handlePublish = async () => {
    const title = titleRef.current?.value.trim();
    const cat = catRef.current?.value.trim();
    if (!title || !cat) { toast.error("العنوان والتصنيف مطلوبان"); return; }
    const desc = descRef.current?.value.trim();
    const priceRaw = priceRef.current?.value.trim();
    const price = priceRaw ? parseFloat(priceRaw) : 0;
    const currency = (priceRef.current?.closest("div")?.querySelector("select") as HTMLSelectElement | null)?.value ?? "SAR";
    setSaving(true);
    const res = await publishMarketService({ title, category: cat, description: desc || undefined, price, currency });
    setSaving(false);
    if (res.ok) {
      toast.success("تم إرسال الخدمة للمراجعة بنجاح — ستظهر بعد الاعتماد");
      setOpen(false);
      load();
    } else {
      toast.error(res.error ?? "فشل نشر الخدمة");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <ShoppingBag className="size-6 text-primary" /> سوق الخدمات
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            {live && <><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> خدمات حقيقية من قاعدة البيانات</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" className="mulki-gold-bg gap-1" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> نشر خدمة جديدة
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent dir="rtl" className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>نشر خدمة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <Input ref={titleRef} placeholder="عنوان الخدمة *" />
                <Input ref={catRef} placeholder="التصنيف (مثال: استشارات، تدريب) *" />
                <Textarea ref={descRef} placeholder="وصف الخدمة" rows={3} />
                <div className="flex gap-2">
                  <Input ref={priceRef} type="number" placeholder="السعر" className="flex-1" />
                  <select className="rounded-md border border-input bg-background px-3 py-2 text-sm w-28">
                    <option value="SAR">ريال</option>
                    <option value="USD">دولار</option>
                  </select>
                </div>
                <Button className="w-full" onClick={handlePublish} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin me-2" /> : null} نشر الخدمة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "الخدمات المتاحة", value: services.length, icon: <Package className="size-4" />, color: "text-primary" },
          { label: "الفئات", value: categories.length - 1, icon: <Tag className="size-4" />, color: "text-amber-500" },
          { label: "الطلبات الشهرية", value: services.length, icon: <Star className="size-4" />, color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label} className="mulki-card p-4 text-center">
            <div className={cn("flex items-center justify-center gap-1.5 text-2xl font-bold mb-1", s.color)}>
              {s.icon} {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="ابحث في الخدمات..." value={q} onChange={(e) => setQ(e.target.value)} className="pe-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "all" ? "الكل" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" /> جاري التحميل...
        </div>
      ) : visible.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Package className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">لا توجد خدمات في هذه الفئة.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => (
            <Card key={s.id} className="mulki-card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-medium">
                  <Tag className="size-3" /> {s.category}
                </span>
              </div>
              <h3 className="font-display font-semibold mb-1">{s.title}</h3>
              {s.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{s.description}</p>
              )}
              <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
                <span className="font-bold text-lg text-primary">{formatPrice(s.price, s.currency)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.info(s.description || "لا توجد تفاصيل إضافية")}>تفاصيل</Button>
                  <Button size="sm" disabled={requesting === s.id} onClick={() => handleRequest(s)}>
                    {requesting === s.id ? <Loader2 className="size-4 animate-spin" /> : "طلب الخدمة"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
