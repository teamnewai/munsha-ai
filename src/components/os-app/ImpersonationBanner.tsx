"use client";

import { useEffect, useState } from "react";
import { UserCog, LogOut } from "lucide-react";

const KEY = "mulki:acting";
type Acting = { name: string; role: string };

// تُستدعى من وحدة التحكم للدخول بصلاحيات كيان آخر (الدخول كـ / Impersonation)
export function enterAs(name: string, role: string) {
  localStorage.setItem(KEY, JSON.stringify({ name, role }));
  window.dispatchEvent(new Event("mulki:acting"));
}

export function ImpersonationBanner() {
  const [acting, setActing] = useState<Acting | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        setActing(raw ? (JSON.parse(raw) as Acting) : null);
      } catch { setActing(null); }
    };
    read();
    window.addEventListener("mulki:acting", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("mulki:acting", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (!acting) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 text-amber-300 border-b border-amber-500/30 px-6 py-2 text-sm">
      <span className="inline-flex items-center gap-2">
        <UserCog className="size-4" />
        أنت تتصفّح بصلاحيات: <strong className="font-semibold">{acting.name}</strong>
        <span className="text-amber-400/80">({acting.role})</span>
      </span>
      <button
        onClick={() => { localStorage.removeItem(KEY); window.dispatchEvent(new Event("mulki:acting")); }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium"
      >
        <LogOut className="size-3.5" /> العودة لحساب المالك
      </button>
    </div>
  );
}
