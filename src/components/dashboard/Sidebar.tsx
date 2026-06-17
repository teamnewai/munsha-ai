"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

// هيكل التنقّل (مرجع: Blueprint §2.1 — أربع مجموعات)
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "المنصة",
    items: [{ href: "/dashboard", label: "لوحة التحكم", icon: "📊" }],
  },
  {
    title: "المحتوى",
    items: [
      { href: "/dashboard/properties", label: "العقارات", icon: "🏢" },
      { href: "/dashboard/units", label: "الوحدات", icon: "🚪" },
      { href: "/dashboard/contracts", label: "العقود", icon: "📄" },
      { href: "/dashboard/invoices", label: "الفواتير", icon: "🧾" },
      { href: "/dashboard/maintenance", label: "الصيانة", icon: "🔧" },
      { href: "/dashboard/tenants", label: "المستأجرون", icon: "🧑" },
      { href: "/dashboard/owners", label: "الملاك", icon: "🔑" },
      { href: "/dashboard/team", label: "الفريق", icon: "👥" },
      { href: "/dashboard/providers", label: "مزودو الخدمات", icon: "🛠️" },
      { href: "/dashboard/community", label: "اتحاد الملاك", icon: "🏘️" },
      { href: "/dashboard/listings", label: "الإعلانات", icon: "📢" },
      { href: "/dashboard/agreements", label: "الاتفاقيات", icon: "✍️" },
      { href: "/dashboard/documents", label: "المستندات", icon: "📁" },
      { href: "/dashboard/finance", label: "المالية", icon: "💰" },
      { href: "/dashboard/reports", label: "التقارير", icon: "📑" },
      { href: "/dashboard/automations", label: "الأتمتة", icon: "⚙️" },
    ],
  },
  {
    title: "التسويق والتحليلات",
    items: [
      { href: "/dashboard/leads", label: "العملاء المحتملون", icon: "🎯" },
      { href: "/dashboard/analytics", label: "التحليلات", icon: "📈" },
      { href: "/dashboard/campaigns", label: "الحملات", icon: "📣" },
      { href: "/dashboard/roi", label: "العائد على الاستثمار", icon: "💹" },
    ],
  },
  {
    title: "الشركة",
    items: [
      { href: "/dashboard/settings", label: "الإعدادات", icon: "⚙️" },
      { href: "/dashboard/branding", label: "الهوية التجارية", icon: "🎨" },
      { href: "/dashboard/billing", label: "الاشتراك والفوترة", icon: "💳" },
      { href: "/dashboard/audit", label: "سجل التدقيق", icon: "🔒" },
      { href: "/dashboard/feedback", label: "الملاحظات", icon: "🗒️" },
      { href: "/os", label: "نظام التشغيل", icon: "👑" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-l border-line bg-card lg:block">
      <div className="flex h-16 items-center gap-2 border-b border-line px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-extrabold text-golddark">
            مُ
          </span>
          <span className="text-lg font-extrabold text-fg">مُلكي إدراك</span>
        </Link>
      </div>

      <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-mut">
              {group.title}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-gold/10 font-semibold text-gold"
                          : "text-mut hover:bg-card2"
                      )}
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
