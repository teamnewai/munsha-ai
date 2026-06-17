import Link from "next/link";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-extrabold text-golddark">
            مُ
          </span>
          <span className="text-lg font-extrabold text-fg">مُلكي</span>
        </Link>
      </div>

      <div className="hidden text-sm text-mut lg:block">
        مرحباً بك في مساحة عملك
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative grid h-9 w-9 place-items-center rounded-full text-mut hover:bg-card2"
          aria-label="الإشعارات"
        >
          🔔
        </button>
        <div className="flex items-center gap-2 rounded-full border border-line py-1 pr-1 pl-3">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-sm font-bold text-gold">
            م
          </div>
          <span className="text-sm font-medium text-fg">حسابي</span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
