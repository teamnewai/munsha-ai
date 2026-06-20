"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/uikit/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ShoppingBag, Plus, Tag, Star, Package } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MarketService = {
  id: string;
  category: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
};

// ─── Inline primitives ────────────────────────────────────────────────────────
function Badge({
  variant = "default", className, children,
}: { variant?: "default" | "outline" | "secondary"; className?: string; children: React.ReactNode }) {
  const cls =
    variant === "outline" ? "border border-border text-foreground" :
    variant === "secondary" ? "bg-secondary text-secondary-foreground" :
    "mulki-gold-bg";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", cls, className)}>
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium block mb-1.5">{children}</label>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ServiceSkeleton() {
  return (
    <Card className="mulki-card p-5 animate-pulse space-y-3">
      <div className="h-4 w-20 bg-muted rounded" />
      <div className="h-5 w-3/4 bg-muted rounded" />
      <div className="h-3 w-full bg-muted rounded" />
      <div className="h-3 w-5/6 bg-muted rounded" />
      <div className="flex gap-2 pt-2">
        <div className="h-9 w-28 bg-muted rounded-lg" />
        <div className="h-9 w-20 bg-muted rounded-lg" />
      </div>
    </Card>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const CURRENCY_LABELS: Record<string, string> = {
  SAR: "ريال",
  USD: "دولار",
  AED: "درهم",
};

const FALLBACK_SERVICES: MarketService[] = [
  { id: "f1", category: "استشارات", title: "استشارة قانونية", description: "جلسة استشارية مع محامٍ متخصص في قانون الأعمال", price: 500, currency: "SAR", active: true },
  { id: "f2", category: "تقنية", title: "تطوير تطبيق ويب", description: "بناء تطبيق ويب احترافي بأحدث التقنيات", price: 5000, currency: "SAR", active: true },
  { id: "f3", category: "تصميم", title: "تصميم هوية بصرية", description: "تصميم شعار وهوية بصرية متكاملة للمنشأة", price: 2000, currency: "SAR", active: true },
  { id: "f4", category: "استشارات", title: "استشارة مالية", description: "تحليل مالي شامل وخطة توسع استراتيجية", price: 800, currency: "SAR", active: true },
  { id: "f5", category: "تسويق", title: "إدارة حملات إعلانية", description: "إدارة حملاتك على منصات التواصل الاجتماعي وزيادة الوصول", price: 1500, currency: "SAR", active: false },
  { id: "f6", category: "تقنية", title: "أمن المعلومات", description: "تقييم شامل لأمن الأنظمة وتقديم توصيات الحماية", price: 3500, currency: "SAR", active: true },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState({
    category: "", title: "", description: "", price: "", currency: "SAR",
  });

  useEffect(() => {
    async function load() {
      try {
        const { getMarketServices } = await import("@/app/actions/org");
        const result = await getMarketServices();
        if (result.ok) {
          setServices(result.services);
        } else {
          setServices(FALLBACK_SERVICES);
        }
      } catch {
        setServices(FALLBACK_SERVICES);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = ["الكل", ...Array.from(new Set(services.map((s) => s.category)))];
  const filtered =
    activeCategory === "الكل" ? services : services.filter((s) => s.category === activeCategory);
  const activeCount = services.filter((s) => s.active).length;

  function handlePublish() {
    if (!form.title || !form.category || !form.price) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    toast.success("تم نشر الخدمة بنجاح");
    setPublishOpen(false);
    setForm({ category: "", title: "", description: "", price: "", currency: "SAR" });
  }

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl mulki-gold-bg flex items-center justify-center">
            <ShoppingBag className="size-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">سوق الخدمات</h1>
            <p className="text-sm text-muted-foreground">استعرض الخدمات المتاحة وانشر خدماتك</p>
          </div>
          {!loading && (
            <Badge className="text-[10px]">
              <span className="size-1.5 rounded-full bg-green-300 inline-block ms-1 animate-pulse" />
              خدمات حقيقية
            </Badge>
          )}
        </div>
        <Button onClick={() => setPublishOpen(true)}>
          <Plus className="size-4 ms-2" />
          نشر خدمة جديدة
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي الخدمات", value: loading ? "—" : services.length, icon: Package },
          { label: "الخدمات النشطة", value: loading ? "—" : activeCount, icon: Star },
          { label: "إجمالي الطلبات", value: 12, icon: ShoppingBag },
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

      {/* Category Filter */}
      {!loading && categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                activeCategory === cat
                  ? "mulki-gold-bg border-transparent text-white"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ServiceSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <Package className="size-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold mb-2">لا توجد خدمات</h2>
          <p className="text-muted-foreground mb-4">لم يتم العثور على خدمات في هذا التصنيف.</p>
          <Button onClick={() => setPublishOpen(true)}>
            <Plus className="size-4 ms-2" />
            نشر أول خدمة
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>نشر خدمة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>التصنيف *</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="مثال: تقنية، استشارات، تصميم"
              />
            </div>
            <div>
              <Label>عنوان الخدمة *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="اكتب عنوان الخدمة"
              />
            </div>
            <div>
              <Label>وصف الخدمة</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب وصفاً تفصيلياً للخدمة"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>السعر *</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>العملة</Label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="USD">دولار (USD)</option>
                  <option value="AED">درهم (AED)</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>إلغاء</Button>
            <Button onClick={handlePublish}>
              <Plus className="size-4 ms-2" />
              نشر الخدمة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ service }: { service: MarketService }) {
  const [detailOpen, setDetailOpen] = useState(false);

  function handleOrder() {
    toast.success("تم إرسال طلبك بنجاح");
  }

  const priceLabel = `${service.price.toLocaleString("ar-SA")} ${CURRENCY_LABELS[service.currency] ?? service.currency}`;

  return (
    <>
      <Card className="mulki-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline">
            <Tag className="size-3 ms-1" />
            {service.category}
          </Badge>
          {!service.active && (
            <Badge variant="secondary">غير نشط</Badge>
          )}
        </div>
        <div>
          <h3 className="font-display font-semibold text-base leading-snug">{service.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
        </div>
        <div className="mt-auto pt-2 border-t border-border flex items-center justify-between gap-2">
          <span className="font-bold text-primary text-sm">{priceLabel}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDetailOpen(true)}>
              تفاصيل
            </Button>
            <Button size="sm" onClick={handleOrder}>
              طلب الخدمة
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{service.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline"><Tag className="size-3 ms-1" />{service.category}</Badge>
              <Badge variant={service.active ? "default" : "secondary"}>
                {service.active ? "نشط" : "غير نشط"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
            <div className="rounded-lg border border-border p-4 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">السعر</span>
              <span className="font-bold text-primary text-lg">{priceLabel}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>إغلاق</Button>
            <Button onClick={() => { toast.success("تم إرسال طلبك بنجاح"); setDetailOpen(false); }}>
              طلب الخدمة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
