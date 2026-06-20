"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { enterAs } from "@/components/os-app/ImpersonationBanner";
import { PERMISSIONS } from "@/lib/access-data";
import {
  getOrgGroups, setMemberPerms, setMemberSuspended,
  getAccessRequests, createAccessRequest, decideAccessRequest,
  getSecretaryMessages, sendSecretaryMessage,
  type RealGroup, type RealMember, type PermMap, type Grant,
  type RealAccessRequest, type SecretaryMessage,
} from "@/app/actions/access";
import {
  ShieldCheck, LogIn, KeyRound, User, Check, X, ArrowUpToLine, Mail, Inbox, Crown, Ban, RotateCcw, Loader2, RefreshCw,
} from "lucide-react";

export default function AccessPage() {
  const router = useRouter();

  const [groups, setGroups] = useState<RealGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [permFor, setPermFor] = useState<RealMember | null>(null);

  const [requests, setRequests] = useState<RealAccessRequest[]>([]);
  const [reqLive, setReqLive] = useState(false);
  const [reqLoading, setReqLoading] = useState(true);

  const [inbox, setInbox] = useState<SecretaryMessage[]>([]);
  const [inboxLive, setInboxLive] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(true);

  const [showSecretary, setShowSecretary] = useState(false);
  const [showRequestUp, setShowRequestUp] = useState(false);
  const [sending, setSending] = useState(false);

  // secretary form refs
  const secFromRef = useRef<HTMLInputElement>(null);
  const secSubjectRef = useRef<HTMLInputElement>(null);
  const secBodyRef = useRef<HTMLTextAreaElement>(null);

  // request-up form refs
  const reqFromRef = useRef<HTMLInputElement>(null);
  const reqScopeRef = useRef<HTMLInputElement>(null);
  const reqReasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getOrgGroups().then((r) => {
      setGroups(r.groups);
      setLive(r.ok && r.groups.some((g) => g.members.length > 0));
      setLoading(false);
    });
    getAccessRequests().then((r) => {
      setRequests(r.requests);
      setReqLive(r.ok);
      setReqLoading(false);
    });
    getSecretaryMessages().then((r) => {
      setInbox(r.messages);
      setInboxLive(r.ok);
      setInboxLoading(false);
    });
  }, []);

  function doEnter(m: RealMember, deptName: string) {
    enterAs(m.name, m.role, "employee");
    toast.success(`دخلت بصلاحيات: ${m.name} (${deptName})`);
    void deptName;
    router.push("/command-center");
  }

  async function toggleSuspend(m: RealMember) {
    const next = !m.suspended;
    setGroups((gs) => gs.map((g) => ({ ...g, members: g.members.map((x) => (x.id === m.id ? { ...x, suspended: next } : x)) })));
    const r = await setMemberSuspended(m.id, next);
    if (!r.ok) toast.error(r.error ?? "تعذّر الحفظ");
    else toast.success(next ? `تم إيقاف صلاحيات ${m.name}` : `تم تفعيل ${m.name}`);
  }

  async function handleApprove(id: string) {
    const r = await decideAccessRequest(id, "approved");
    if (r.ok) {
      setRequests((p) => p.filter((x) => x.id !== id));
      toast.success("تمت الموافقة — تم حفظها فعلياً");
    } else toast.error(r.error ?? "تعذّر الحفظ");
  }

  async function handleReject(id: string) {
    const r = await decideAccessRequest(id, "rejected");
    if (r.ok) {
      setRequests((p) => p.filter((x) => x.id !== id));
      toast.error("تم الرفض — تم حفظه فعلياً");
    } else toast.error(r.error ?? "تعذّر الحفظ");
  }

  async function handleSendSecretary(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const r = await sendSecretaryMessage({
      from: secFromRef.current?.value ?? "زائر",
      subject: secSubjectRef.current?.value ?? "",
      body: secBodyRef.current?.value ?? "",
    });
    setSending(false);
    if (r.ok) {
      setShowSecretary(false);
      toast.success("أُرسلت رسالتك إلى سكرتير المالك — حُفظت فعلياً");
      getSecretaryMessages().then((res) => { if (res.ok) setInbox(res.messages); });
    } else toast.error(r.error ?? "تعذّر الإرسال");
  }

  async function handleRequestUp(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const r = await createAccessRequest({
      from: reqFromRef.current?.value ?? "موظف",
      scope: reqScopeRef.current?.value ?? "",
      reason: reqReasonRef.current?.value ?? "",
    });
    setSending(false);
    if (r.ok) {
      setShowRequestUp(false);
      toast.info("أُرسل طلب الإذن — حُفظ فعلياً في قاعدة البيانات");
      getAccessRequests().then((res) => { if (res.ok) { setRequests(res.requests); setReqLive(true); } });
    } else toast.error(r.error ?? "تعذّر الإرسال");
  }

  function grantCount(p: PermMap) {
    return Object.values(p).filter((g) => g.granted).length;
  }

  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center"><ShieldCheck className="size-5" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold">الوصول والصلاحيات</h1>
            <p className="text-sm text-muted-foreground">تحكّم المالك: دخول لأي مكتب، ومنح/سحب الصلاحيات مع حق التفويض — يُحفظ فعلياً.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${live ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            <span className={`size-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            {live ? "موظفون حقيقيون" : "عرض تجريبي"}
          </span>
          <Button variant="outline" onClick={() => setShowRequestUp(true)}><ArrowUpToLine className="size-4 ms-1" /> طلب وصول أعلى</Button>
          <Button onClick={() => setShowSecretary(true)}><Mail className="size-4 ms-1" /> سكرتير المالك</Button>
        </div>
      </div>

      <Card className="mulki-card p-4 text-xs text-muted-foreground grid sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2"><span className="text-primary">⬇️</span> النزول: المالك يدخل المستويات الأدنى تلقائياً.</div>
        <div className="flex items-center gap-2"><span className="text-amber-400">⬆️</span> الصعود: يتطلب إذن المدير المباشر.</div>
        <div className="flex items-center gap-2"><span className="text-emerald-400">✉️</span> مراسلة سكرتير المالك متاحة للجميع.</div>
      </Card>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-4">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-muted-foreground">الموظفون — دخول ومنح صلاحيات</h2>
          {loading ? (
            <Card className="mulki-card p-10 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></Card>
          ) : groups.every((g) => g.members.length === 0) ? (
            <Card className="mulki-card p-8 text-center text-sm text-muted-foreground">لا يوجد موظفون بعد في القاعدة.</Card>
          ) : (
            groups.filter((g) => g.members.length > 0).map((g) => (
              <Card key={g.deptKey} className="mulki-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  <h3 className="font-semibold">{g.deptName}</h3>
                  <span className="text-xs text-muted-foreground">({g.members.length})</span>
                </div>
                <ul className="space-y-2">
                  {g.members.map((m) => (
                    <li key={m.id} className={`flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5 ${m.suspended ? "opacity-60" : ""}`}>
                      <span className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0"><User className="size-4" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {m.name}
                          {m.suspended && <span className="text-[10px] text-destructive me-2"> موقوف</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{m.role}{grantCount(m.perms) > 0 && ` · ${grantCount(m.perms)} صلاحية`}</div>
                      </div>
                      <button onClick={() => doEnter(m, g.deptName)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-primary/50"><LogIn className="size-3.5" /> دخول كـ</button>
                      <button onClick={() => setPermFor(m)} className="inline-flex items-center gap-1 rounded-lg bg-primary/15 text-primary px-2.5 py-1.5 text-xs hover:bg-primary/25"><KeyRound className="size-3.5" /> الصلاحيات</button>
                      <button onClick={() => toggleSuspend(m)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs ${m.suspended ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-destructive/15 text-destructive hover:bg-destructive/25"}`}>
                        {m.suspended ? <><RotateCcw className="size-3.5" /> تفعيل</> : <><Ban className="size-3.5" /> إيقاف</>}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          {/* طلبات الصعود */}
          <Card className="mulki-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ArrowUpToLine className="size-4 text-amber-400" /> طلبات الصعود
                {reqLive && <span className="size-1.5 rounded-full bg-emerald-500 inline-block" title="بيانات حقيقية" />}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{reqLoading ? "…" : requests.length}</span>
                <button onClick={() => { setReqLoading(true); getAccessRequests().then((r) => { setRequests(r.requests); setReqLive(r.ok); setReqLoading(false); }); }} className="text-muted-foreground hover:text-foreground">
                  <RefreshCw className="size-3.5" />
                </button>
              </div>
            </div>
            {reqLoading ? (
              <div className="py-4 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات معلّقة.</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="text-sm font-medium">{r.from}</div>
                    <div className="text-[11px] text-muted-foreground">إلى: {r.scope} · {r.time}</div>
                    <div className="text-xs mt-1">{r.reason}</div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleApprove(r.id)} className="flex-1 rounded-lg bg-emerald-500/15 text-emerald-400 py-1.5 text-xs font-medium hover:bg-emerald-500/25 inline-flex items-center justify-center gap-1"><Check className="size-3.5" /> موافقة</button>
                      <button onClick={() => handleReject(r.id)} className="flex-1 rounded-lg bg-destructive/15 text-destructive py-1.5 text-xs font-medium hover:bg-destructive/25 inline-flex items-center justify-center gap-1"><X className="size-3.5" /> رفض</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* صندوق سكرتير المالك */}
          <Card className="mulki-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Inbox className="size-4 text-primary" /> رسائل سكرتير المالك
                {inboxLive && <span className="size-1.5 rounded-full bg-emerald-500 inline-block" title="بيانات حقيقية" />}
              </h3>
              <button onClick={() => { setInboxLoading(true); getSecretaryMessages().then((r) => { setInbox(r.messages); setInboxLive(r.ok); setInboxLoading(false); }); }} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className="size-3.5" />
              </button>
            </div>
            {inboxLoading ? (
              <div className="py-4 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد رسائل بعد.</p>
            ) : (
              <ul className="space-y-2">
                {inbox.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.from}</span>
                      <span className="text-[10px] text-muted-foreground">{m.time}</span>
                    </div>
                    {m.subject && <div className="text-xs font-medium mt-0.5">{m.subject}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{m.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {permFor && (
        <PermissionsDialog
          member={permFor}
          onClose={() => setPermFor(null)}
          onSaved={(map) => {
            setGroups((gs) => gs.map((g) => ({ ...g, members: g.members.map((x) => (x.id === permFor.id ? { ...x, perms: map } : x)) })));
            setPermFor(null);
          }}
        />
      )}

      {/* نافذة مراسلة سكرتير المالك */}
      <Dialog open={showSecretary} onOpenChange={setShowSecretary}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-4 text-primary" /> مراسلة سكرتير المالك</DialogTitle></DialogHeader>
          <form onSubmit={handleSendSecretary} className="space-y-3">
            <Input ref={secFromRef} placeholder="اسمك" required />
            <Input ref={secSubjectRef} placeholder="الموضوع" required />
            <Textarea ref={secBodyRef} rows={4} placeholder="نص الرسالة..." required />
            <p className="text-[11px] text-muted-foreground">تُحفظ رسالتك مباشرةً في قاعدة البيانات ويطّلع عليها المالك.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSecretary(false)}>إلغاء</Button>
              <Button type="submit" disabled={sending}>{sending ? "جارٍ الإرسال…" : "إرسال"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* نافذة طلب وصول أعلى */}
      <Dialog open={showRequestUp} onOpenChange={setShowRequestUp}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpToLine className="size-4 text-amber-400" /> طلب وصول لمستوى أعلى</DialogTitle></DialogHeader>
          <form onSubmit={handleRequestUp} className="space-y-3">
            <Input ref={reqFromRef} placeholder="اسمك" required />
            <Input ref={reqScopeRef} placeholder="المستوى/المكتب المطلوب" required />
            <Textarea ref={reqReasonRef} rows={3} placeholder="سبب الطلب..." required />
            <p className="text-[11px] text-muted-foreground">يُرسَل لمديرك المباشر للموافقة ويُحفظ فعلياً. (للعاجل: راسل سكرتير المالك.)</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRequestUp(false)}>إلغاء</Button>
              <Button type="submit" disabled={sending}>{sending ? "جارٍ الإرسال…" : "إرسال الطلب"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PermissionsDialog({ member, onClose, onSaved }: { member: RealMember; onClose: () => void; onSaved: (m: PermMap) => void }) {
  const [map, setMap] = useState<PermMap>(() => ({ ...member.perms }));
  const [saving, setSaving] = useState(false);

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
  async function save() {
    setSaving(true);
    const clean: PermMap = {};
    for (const [k, v] of Object.entries(map)) if (v.granted) clean[k] = v;
    const r = await setMemberPerms(member.id, clean);
    setSaving(false);
    if (r.ok) { toast.success(`تم حفظ صلاحيات ${member.name} فعلياً`); onSaved(clean); }
    else toast.error(r.error ?? "تعذّر الحفظ");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> صلاحيات: {member.name}</DialogTitle></DialogHeader>
        <p className="text-[11px] text-muted-foreground -mt-2">المالك يمنح/يسحب أي صلاحية، ويحدّد إن كان يجوز للمستفيد منحها لغيره (تفويض). يُحفظ في قاعدة البيانات.</p>
        <ul className="space-y-2 max-h-80 overflow-y-auto mt-2">
          {PERMISSIONS.map((perm) => {
            const g: Grant = map[perm.key] ?? { granted: false, delegate: false };
            return (
              <li key={perm.key} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{perm.label}</span>
                  <button onClick={() => toggleGrant(perm.key)} className={`relative h-6 w-11 rounded-full transition-colors ${g.granted ? "bg-primary" : "bg-border"}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${g.granted ? "left-0.5" : "right-0.5"}`} />
                  </button>
                </div>
                {g.granted && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <span onClick={() => toggleDelegate(perm.key)} className={`size-4 rounded border grid place-items-center ${g.delegate ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>{g.delegate && <Check className="size-3" />}</span>
                    يجوز له منح هذه الصلاحية لغيره (تفويض)
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
