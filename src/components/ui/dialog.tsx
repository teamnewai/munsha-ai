"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// نافذة حوارية خفيفة (بديل Radix) — نفس واجهة shadcn المستخدمة في الصفحات المنقولة
type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode };

const Ctx = React.createContext<(o: boolean) => void>(() => {});

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onOpenChange(false); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <Ctx.Provider value={onOpenChange}>
      <div className="fixed inset-0 z-[9999] grid place-items-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const onOpenChange = React.useContext(Ctx);
  return (
    <div
      className={cn("relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto", className)}
      {...props}
    >
      <button onClick={() => onOpenChange(false)} aria-label="إغلاق" className="absolute left-4 top-4 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1.5 text-right", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-display text-lg font-semibold", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex justify-end gap-2", className)} {...props} />;
}
