"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { enterAs } from "@/components/os-app/ImpersonationBanner";
import {
  GROUPS, PERMISSIONS, ACCESS_REQUESTS_SEED, SECRETARY_SEED,
  type Entity, type AccessRequest, type SecretaryMsg,
} from "@/lib/access-data";
import {
  ShieldCheck, LogIn, KeyRound, Bot, User, Check, X, ArrowUpToLine, Mail, Inbox, Crown,
} from "lucide-react";

type Grant = { granted: boolean; delegate: boolean };
type GrantMap = Record<string, Record<string, Grant>>;

export default function AccessPage() {
  const router = useRouter();
  const [grants, setGrants] = useState<GrantMap>({});
  const [permFor, setPermFor] = useState<Entity | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>(ACCESS_REQUESTS_SEED);
  const [inbox] = useState<SecretaryMsg[]>(SECRETARY_SEED);
  const [showSecretary, setShowSecretary] = useState(false);
  const [showRequestUp, setShowRequestUp] = useState(false);

  function doEnter(e: Entity) {
    enterAs(e.name, e.role);
    toast.success(`دخلت بصلاحيات: ${e.name}`);
    router.push("/command-center");
  }

  function grantCount(id: string) {
    const m = grants[id]; if (!m) return 0;
    return Object.values(m).filter((g) => g.granted).length;
  }

  return (
    <section className="space-y-6" dir="rtl">
      {/* الترويسة */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center"><ShieldCheck className="size-5" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold">الوصول والصلاحيات</h1>
            <p className="text-sm text-muted-foreground">تحكّم المالك الكامل: دخول لأي مكتب، ومنح/سحب الصلاحيات مع حق التفويض.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRequestUp(true)}><ArrowUpToLine className="size-4 ms-1" /> طلب وصول لمستوى أعلى</Button>
          <Button onClick={() => setShowSecretary(true)}><Mail className="size-4 ms-1" /> مراسلة سكرتير المالك</Button>
        </div>
      </div>

      {/* قاعدة الوصول */}
      <Card className="mulki-card p-4 text-xs text-muted-foreground grid sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2"><span className="text-primary">⬇️</span> النزول: المالك/المدير يدخل المستويات الأدنى تلقائياً.</div>
        <div className="flex items-center gap-2"><span className="text-amber-400">⬆️</span> الصعود: يتطلب إذن المدير المباشر.</div>
        <div className="flex items-center gap-2"><span className="text-emerald-400">✉️</span> مراسلة سكرتير المالك متاحة للجميع.</div>
      </Card>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* الكيانات */}
        <div className="space-y-4">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-muted-foreground">الكيانات — دخول ومنح صلاحيات</h2>
          {GROUPS.map((g) => (
            <Card key={g.deptKey} className="mulki-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                <h3 className="font-semibold">{g.deptName}</h3>
              </div>
              <ul className="space-y-2">
                {g.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5">
                    <span className={`size-9 rounded-lg grid place-items-center shrink-0 ${m.kind === "agent" ? "bg-violet-500/15 text-violet-400" : "bg-primary/15 text-primary"}`}>
                      {m.kind === "agent" ? <Bot className="size-4" /> : <User className="size-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.role}{grantCount(m.id) > 0 && ` · ${grantCount(m.id)} صلاحية ممنوحة`}</div>
                    </div>
                    <button onClick={() => doEnter(m)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-primary/50">
                      <LogIn className="size-3.5" /> دخول كـ
                    </button>
                    <button onClick={() => setPermFor(m)} className="inline-flex items-center gap-1 rounded-lg bg-primary/15 text-primary px-2.5 py-1.5 text-xs hover:bg-primary/25">
                      <KeyRound className="size-3.5" /> الصلاحيات
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* الجانب: الطلبات + سكرتير المالك */}
        <div className="space-y-4">
          <Card className="mulki-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><ArrowUpToLine className="size-4 text-amber-400" /> طلبات الصعود</h3>
              <span className="text-xs text-muted-foreground">{requests.length}</span>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات.</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="text-sm font-medium">{r.from}</div>
                    <div className="text-[11px] text-muted-foreground">إلى {r.to} · {r.time}</div>
                    <div className="text-xs mt-1">{r.reason}</div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { setRequests((p) => p.filter((x) => x.id !== r.id)); toast.success("تمت الموافقة — مُنح وصول مؤقت"); }}
                        className="flex-1 rounded-lg bg-emerald-500/15 text-emerald-400 py-1.5 text-xs font-medium hover:bg-emerald-500/25 inline-flex items-center justify-center gap-1"><Check className="size-3.5" /> موافقة</button>
                      <button onClick={() => { setRequests((p) => p.filter((x) => x.id !== r.id)); toast.error("تم رفض الطلب"); }}
                        className="flex-1 rounded-lg bg-destructive/15 text-destructive py-1.5 text-xs font-medium hover:bg-destructive/25 inline-flex items-center justify-center gap-1"><X className="size-3.5" /> رفض</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mulki-card p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><Inbox className="size-4 text-primary" /> رسائل سكرتير المالك</h3>
            <ul className="space-y-2">
              {inbox.map((m) => (
                <li key={m.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{m.from}</span>
                    <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{m.msg}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* نافذة الصلاحيات */}
      {permFor && (
        <PermissionsDialog
          entity={permFor}
          initial={grants[permFor.id] ?? {}}
          onClose={() => setPermFor(null)}
          onSave={(map) => { setGrants((p) => ({ ...p, [permFor.id]: map })); setPermFor(null); toast.success(`تم تحديث صلاحيات ${permFor.name}`); }}
        />
      )}

      {/* مراسلة سكرتير المالك */}
      <Dialog open={showSecretary} onOpenChange={setShowSecretary}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-4 text-primary" /> مراسلة سكرتير المالك</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setShowSecretary(false); toast.success("أُرسلت رسالتك إلى سكرتير المالك"); }} className="space-y-3">
            <Input placeholder="الموضوع" required />
            <Textarea rows={4} placeholder="نص الرسالة..." required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSecretary(false)}>إلغاء</Button>
              <Button type="submit">إرسال</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* طلب وصول لمستوى أعلى */}
      <Dialog open={showRequestUp} onOpenChange={setShowRequestUp}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpToLine className="size-4 text-amber-400" /> طلب وصول لمستوى أعلى</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setShowRequestUp(false); toast.info("أُرسل طلب الإذن إلى مديرك المباشر"); }} className="space-y-3">
            <Input placeholder="المستوى/المكتب المطلوب الوصول إليه" required />
            <Textarea rows={3} placeholder="سبب الطلب..." required />
            <p className="text-[11px] text-muted-foreground">يُرسَل الطلب لمديرك المباشر للموافقة. (للوصول العاجل: راسل سكرتير المالك.)</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRequestUp(false)}>إلغاء</Button>
              <Button type="submit">إرسال الطلب</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PermissionsDialog({ entity, initial, onClose, onSave }: {
  entity: Entity; initial: Record<string, Grant>; onClose: () => void; onSave: (m: Record<string, Grant>) => void;
}) {
  const [map, setMap] = useState<Record<string, Grant>>(() => ({ ...initial }));

  function toggleGrant(key: string) {
    setMap((p) => {
      const cur = p[key] ?? { granted: false, delegate: false };
      const granted = !cur.granted;
      return { ...p, [key]: { granted, delegate: granted ? cur.delegate : false } };
    });
  }
  function toggleDelegate(key: string) {
    setMap((p) => {
      const cur = p[key] ?? { granted: false, delegate: false };
      if (!cur.granted) return p;
      return { ...p, [key]: { ...cur, delegate: !cur.delegate } };
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> صلاحيات: {entity.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground -mt-2">المالك يمنح/يسحب أي صلاحية، ويحدّد إن كان يجوز للمستفيد منحها لغيره (تفويض).</p>
        <ul className="space-y-2 max-h-80 overflow-y-auto mt-2">
          {PERMISSIONS.map((perm) => {
            const g = map[perm.key] ?? { granted: false, delegate: false };
            return (
              <li key={perm.key} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{perm.label}</span>
                  <button onClick={() => toggleGrant(perm.key)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${g.granted ? "bg-primary" : "bg-border"}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${g.granted ? "left-0.5" : "right-0.5"}`} />
                  </button>
                </div>
                {g.granted && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <span onClick={() => toggleDelegate(perm.key)}
                      className={`size-4 rounded border grid place-items-center ${g.delegate ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {g.delegate && <Check className="size-3" />}
                    </span>
                    يجوز له منح هذه الصلاحية لغيره (تفويض)
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave(map)}>حفظ الصلاحيات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
