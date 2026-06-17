import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-extrabold text-white">
            مُ
          </span>
          <span className="text-xl font-extrabold text-brand-900">مُلكي</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-slate-600 hover:text-brand-700">
            المزايا
          </Link>
          <Link href="/#os" className="text-sm text-slate-600 hover:text-brand-700">
            نظام التشغيل
          </Link>
          <Link href="/pricing" className="text-sm text-slate-600 hover:text-brand-700">
            الأسعار
          </Link>
          <Link href="/#faq" className="text-sm text-slate-600 hover:text-brand-700">
            الأسئلة الشائعة
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            دخول
          </ButtonLink>
          <ButtonLink href="/login?mode=signup" variant="primary" size="sm">
            ابدأ مجاناً
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
