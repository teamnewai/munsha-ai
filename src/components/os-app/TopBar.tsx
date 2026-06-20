"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { LogOut, Sparkles, Bell, Crown } from "lucide-react";

export function TopBar({ title }: { title?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [secretary, setSecretary] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient()!;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    if (isSupabaseConfigured()) await createClient()!.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-background/60 backdrop-blur px-6 py-3.5">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">مُلكي OS</div>
        <h1 className="font-display text-lg font-semibold">{title ?? "مساحة العمل التنفيذية"}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/noor" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-primary hover:bg-sidebar-accent/60">
          <Sparkles className="size-4" /> اسأل نور
        </Link>
        <button onClick={() => setSecretary(true)} className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
          <Crown className="size-4" /> سكرتير المالك
        </button>
        <Link href="/notifications" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/60" aria-label="الإشعارات">
          <Bell className="size-4" />
        </Link>
        <div className="hidden sm:block text-xs text-muted-foreground border-s border-border ps-3 ms-1">{email}</div>
        <button onClick={signOut} aria-label="تسجيل الخروج" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/60">
          <LogOut className="size-4" />
        </button>
      </div>

      <Dialog open={secretary} onOpenChange={setSecretary}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-4 text-primary" /> مراسلة سكرتير المالك</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setSecretary(false); toast.success("أُرسلت رسالتك إلى سكرتير المالك"); }} className="space-y-3">
            <Input placeholder="الموضوع" required />
            <Textarea rows={4} placeholder="نص الرسالة..." required />
            <DialogFooter>
              <button type="button" onClick={() => setSecretary(false)} className="rounded-lg border border-border px-4 py-2 text-sm">إلغاء</button>
              <button type="submit" className="rounded-lg mulki-gold-bg px-4 py-2 text-sm font-bold">إرسال</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
