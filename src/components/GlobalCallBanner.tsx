"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const IncomingCallBanner = dynamic(() => import("@/components/IncomingCallBanner"), { ssr: false });

const KEY = "mulki:acting";

export function GlobalCallBanner() {
  const [acting, setActing] = useState<{ id?: string; name?: string } | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        setActing(raw ? (JSON.parse(raw) as { id?: string; name?: string }) : null);
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

  if (!acting?.id) return null;
  return <IncomingCallBanner memberId={acting.id} memberName={acting.name ?? ""} />;
}
