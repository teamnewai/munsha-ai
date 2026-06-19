"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Users, Workflow, Sparkles, Calendar,
  Brain, Store, Network, Presentation, Briefcase, Settings, Crown, Shield, Handshake,
  KeyRound, ScrollText, FileText, BarChart3, ShieldCheck,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; accent?: boolean };
const nav: NavItem[] = [
  { to: "/command-center", label: "مركز القيادة التنفيذي", icon: LayoutDashboard },
  { to: "/office", label: "مكتبي", icon: Briefcase },
  { to: "/noor", label: "نور AI", icon: Sparkles, accent: true },
  { to: "/org", label: "الإدارات والأقسام", icon: Building2 },
  { to: "/units", label: "الوحدات والفرق", icon: Network },
  { to: "/people", label: "الموظفون والوكلاء", icon: Users },
  { to: "/permissions", label: "الصلاحيات", icon: KeyRound },
  { to: "/access-requests", label: "طلبات الوصول", icon: ShieldCheck },
  { to: "/forms", label: "النماذج والاستمارات", icon: FileText },
  { to: "/workflows", label: "المعاملات والاعتمادات", icon: Workflow },
  { to: "/governance", label: "الحوكمة والتدقيق", icon: ScrollText },
  { to: "/reports", label: "التقارير والتحليلات", icon: BarChart3 },
  { to: "/meetings", label: "الاجتماعات", icon: Calendar },
  { to: "/knowledge", label: "العقل المعرفي", icon: Brain },
  { to: "/marketplace", label: "سوق الخدمات", icon: Store },
  { to: "/my-services", label: "خدماتي", icon: Store, accent: true },
  { to: "/network", label: "شبكة الأعمال", icon: Network },
  { to: "/conferences", label: "المؤتمرات", icon: Presentation },
  { to: "/companies", label: "الشركات", icon: Crown },
  { to: "/affiliate", label: "الشركاء التسويقيون", icon: Handshake },
  { to: "/security-audit", label: "التدقيق الأمني", icon: Shield },
];

export function AppSidebar() {
  const path = usePathname() ?? "";
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-s border-sidebar-border bg-sidebar">
      <Link href="/command-center" className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="size-9 rounded-lg mulki-gold-bg flex items-center justify-center font-display font-bold text-lg shadow-lg">M</div>
        <div className="leading-tight">
          <div className="font-display font-semibold tracking-tight">مُلكي OS</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">نظام تشغيل المؤسسات</div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                item.accent && !active && "text-primary",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Link href="/settings" className="flex items-center gap-3 mx-2 mb-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60">
        <Settings className="size-4" /> الإعدادات
      </Link>
    </aside>
  );
}
