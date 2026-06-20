"use client";

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import {
  Bot, Bell, CalendarDays, Search, User, Building2, Phone, Video,
  MessageSquare, CheckCircle2, XCircle, Send, Clock, ShieldCheck,
  Sparkles, Briefcase, BadgeCheck, ArrowRight, Building, Network, Loader2,
} from "lucide-react";
import { getOrgGroups } from "@/app/actions/access";
import { createCallInvitation, updateCallStatus } from "@/app/actions/calls";
import type { RealGroup } from "@/app/actions/access";
import type { CallInvitation, CallType } from "@/app/actions/calls";

const VideoCallModal = dynamic(() => import("@/components/VideoCallModal"), { ssr: false });

type Screen = "entry" | "reception" | "bell" | "appt" | "inquiry";

const CONTACTS = [
  { label: "رسالة نصية", Icon: MessageSquare, type: null },
  { label: "مكالمة صوتية", Icon: Phone, type: "audio" as CallType },
  { label: "اجتماع مرئي مباشر", Icon: Video, type: "video" as CallType },
];

const FEATURES = [
  { Icon: Clock, title: "استقبال فوري 24/7", desc: "بالذكاء الاصطناعي على مدار الساعة" },
  { Icon: Network, title: "توجيه ذكي", desc: "حسب الهيكل التنظيمي المعتمد" },
  { Icon: Bell, title: "تنبيهات فورية", desc: "للأشخاص المعنيين لحظة الطلب" },
  { Icon: MessageSquare, title: "خيارات متعددة للتواصل", desc: "رسالة · مكالمة · اجتماع مرئي" },
  { Icon: BadgeCheck, title: "تحقق ذكي من المواعيد", desc: "بحث آلي في سجل المواعيد" },
  { Icon: ShieldCheck, title: "أمان وخصوصية عالية", desc: "حماية بيانات الزوار والمنشأة" },
];

const ORG_CHAIN = [
  { label: "المنشأة", value: "شركة ABC", Icon: Building2 },
  { label: "الإدارة", value: "إدارة الموارد البشرية", Icon: Building },
  { label: "القسم", value: "قسم التوظيف", Icon: Briefcase },
  { label: "الوظيفة", value: "أخصائي التوظيف", Icon: BadgeCheck },
  { label: "الموظف", value: "محمد العتيبي", Icon: User },
];

export function VisitorPortal() {
  const [screen, setScreen] = useState<Screen>("entry");
  // مسار الجرس
  const [org, setOrg] = useState<string | null>(null);
  const [selectedOrgKey, setSelectedOrgKey] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [selectedCallType, setSelectedCallType] = useState<CallType | null>(null);
  // مسار الموعد
  const [apptNo, setApptNo] = useState("");
  const [apptResult, setApptResult] = useState<null | "found" | "notfound">(null);
  // بيانات حقيقية
  const [orgGroups, setOrgGroups] = useState<RealGroup[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  // المكالمة الفعلية
  const [activeCall, setActiveCall] = useState<CallInvitation | null>(null);
  const [creatingCall, setCreatingCall] = useState(false);
  const [visitorId] = useState(() => `visitor-${Date.now()}`);

  useEffect(() => {
    getOrgGroups().then((res) => {
      if (res.ok) setOrgGroups(res.groups);
      setLoadingOrgs(false);
    });
  }, []);

  const orgList = orgGroups.map((g) => ({ value: g.deptKey, label: g.deptName }));
  const memberList = orgGroups.find((g) => g.deptKey === selectedOrgKey)?.members ?? [];

  function reset() {
    setScreen("entry");
    setOrg(null); setSelectedOrgKey(null);
    setPerson(null); setSelectedMemberId(null);
    setContact(null); setSelectedCallType(null);
    setApptNo(""); setApptResult(null);
  }
  function resetBell() {
    setOrg(null); setSelectedOrgKey(null);
    setPerson(null); setSelectedMemberId(null);
    setContact(null); setSelectedCallType(null);
  }

  const bellDone = org && person && contact;

  const handleCallAccept = async () => {
    if (!selectedCallType) {
      toast.info("الرسائل النصية — ميزة قادمة قريباً");
      return;
    }
    if (!selectedMemberId || !person) {
      toast.error("يرجى اختيار الشخص المطلوب");
      return;
    }
    setCreatingCall(true);
    try {
      const result = await createCallInvitation({
        callerId: visitorId,
        callerName: "زائر",
        calleeId: selectedMemberId,
        calleeName: person,
        callType: selectedCallType,
      });
      if (result.ok && result.invitation) {
        setActiveCall(result.invitation);
      } else {
        toast.error("تعذّر بدء المكالمة");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setCreatingCall(false);
    }
  };

  const endCall = async () => {
    if (activeCall) await updateCallStatus(activeCall.id, "ended");
    setActiveCall(null);
  };

  return (
    <section id="visitor" className="mx-auto max-w-7xl px-6 py-20">
      {/* نافذة المكالمة */}
      {activeCall && (
        <VideoCallModal
          channelName={activeCall.room_name}
          memberName={person ?? ""}
          callType={activeCall.call_type}
          invitationId={activeCall.id}
          isWaiting={true}
          onClose={endCall}
        />
      )}

      {/* العنوان */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-primary mulki-glow">
          <Sparkles className="size-3.5" /> بوابة الزائر الذكية
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold mt-3 text-fg">
          MULKI OS — <span className="mulki-gold-text">البوابة الذكية</span>
        </h2>
        <p className="text-muted-foreground mt-3">تجربة استقبال ذكية متكاملة للزوار والمواعيد.</p>
      </div>

      {/* الواجهة التفاعلية */}
      <div className="mulki-card p-5 md:p-8 relative overflow-hidden">
        <div className="absolute -start-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          {/* شريط علوي للتنقل */}
          {screen !== "entry" && (
            <div className="flex items-center justify-between mb-6">
              <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-3.5" /> البداية
              </button>
              <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                <span className="size-7 rounded-lg bg-primary/15 text-primary grid place-items-center"><Bot className="size-4" /></span>
                نور AI · المساعد الذكي للاستقبال
              </div>
            </div>
          )}

          {/* ١) الصفحة الرئيسية */}
          {screen === "entry" && (
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
              <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-background p-8 text-center">
                <div className="size-16 mx-auto rounded-2xl mulki-gold-bg grid place-items-center text-3xl shadow-xl">⬡</div>
                <h3 className="mt-4 text-2xl font-semibold text-fg">مرحباً بك في نظام المكاتب الافتراضية الذكية</h3>
                <p className="text-sm text-muted-foreground mt-2">اختر طريقة دخولك للبوابة</p>
                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span>عن النظام</span><span>·</span><span>مساعدة</span><span>·</span><span>اتصل بنا</span>
                </div>
              </div>
              <div className="grid gap-3">
                <EntryBtn Icon={User} title="دخول زائر" sub="استقبال فوري بالذكاء الاصطناعي" tone="primary" onClick={() => setScreen("reception")} />
                <EntryBtn Icon={CalendarDays} title="لدي موعد" sub="تحقق من موعدك المسجل" tone="emerald" onClick={() => setScreen("appt")} />
                <EntryBtn Icon={MessageSquare} title="استعلام سريع" sub="معلومات عامة وتحدثات" tone="violet" onClick={() => setScreen("inquiry")} />
              </div>
            </div>
          )}

          {/* ٢) صفحة الاستقبال الذكي */}
          {screen === "reception" && (
            <div className="max-w-2xl mx-auto text-center">
              <div className="size-20 mx-auto rounded-3xl bg-primary/15 text-primary grid place-items-center"><Bot className="size-10" /></div>
              <h3 className="mt-4 text-xl font-semibold text-fg">نور AI</h3>
              <p className="text-xs text-muted-foreground">المساعد الذكي للاستقبال</p>
              <p className="mt-3 text-sm text-muted-foreground">مرحباً بك، كيف يمكنني مساعدتك اليوم؟</p>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <button onClick={() => { resetBell(); setScreen("bell"); }}
                  className="rounded-2xl border border-border bg-background/40 p-6 hover:border-primary/60 transition-colors">
                  <Bell className="size-8 mx-auto text-primary" />
                  <div className="mt-3 font-semibold text-fg">جرس</div>
                  <div className="text-xs text-muted-foreground mt-1">تواصل مع شخص الآن</div>
                </button>
                <button onClick={() => setScreen("appt")}
                  className="rounded-2xl border border-border bg-background/40 p-6 hover:border-primary/60 transition-colors">
                  <CalendarDays className="size-8 mx-auto text-emerald-400" />
                  <div className="mt-3 font-semibold text-fg">موعد</div>
                  <div className="text-xs text-muted-foreground mt-1">لدي موعد مسبق</div>
                </button>
              </div>
            </div>
          )}

          {/* ٣) تدفق زر الجرس */}
          {screen === "bell" && (
            <div>
              <Stepper steps={["اختر المنشأة", "اختر الشخص", "نوع التواصل", "تم"]}
                current={bellDone ? 3 : org ? (person ? 2 : 1) : 0} />

              {!bellDone ? (
                <div className="mt-6 max-w-xl mx-auto">
                  {!org && (
                    loadingOrgs ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                        <Loader2 className="size-4 animate-spin" /> جارٍ تحميل المنشآت...
                      </div>
                    ) : (
                      <PickList
                        title="أي منشأة ترغب بزيارتها؟"
                        items={orgList.length > 0 ? orgList : [{ value: "demo", label: "شركة تجريبية" }]}
                        onPick={(key, name) => { setSelectedOrgKey(key); setOrg(name); }}
                      />
                    )
                  )}
                  {org && !person && (
                    memberList.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">لا يوجد موظفون في هذه المنشأة</div>
                    ) : (
                      <PickList
                        title="من تريد تحديداً؟"
                        items={memberList.map((m) => ({ value: m.id, label: m.name }))}
                        onPick={(id, name) => { setSelectedMemberId(id); setPerson(name); }}
                      />
                    )
                  )}
                  {org && person && !contact && (
                    <div>
                      <h4 className="text-center font-semibold text-fg mb-4">كيف تفضل التواصل؟</h4>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {CONTACTS.map(({ label, Icon, type }) => (
                          <button key={label} onClick={() => { setContact(label); setSelectedCallType(type); }}
                            className="rounded-xl border border-border bg-background/40 p-5 hover:border-primary/60 transition-colors text-center">
                            <Icon className="size-7 mx-auto text-primary" />
                            <div className="mt-2 text-sm font-medium text-fg">{label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 grid lg:grid-cols-2 gap-5 items-start">
                  {/* تم إنشاء طلب الزيارة */}
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
                    <CheckCircle2 className="size-12 mx-auto text-emerald-400" />
                    <h4 className="mt-3 font-semibold text-fg">تم إنشاء طلب الزيارة</h4>
                    <p className="text-sm text-muted-foreground mt-1">تم إرسال طلبك بنجاح إلى:</p>
                    <div className="mt-2 font-semibold text-fg">{person}</div>
                    <div className="text-xs text-muted-foreground">{org} · {contact}</div>
                    {selectedCallType && (
                      <p className="text-xs text-emerald-400 mt-3">في انتظار رد الموظف لبدء المكالمة...</p>
                    )}
                    {!selectedCallType && (
                      <p className="text-xs text-amber-400 mt-3">سيتم التواصل معك عبر رسالة</p>
                    )}
                    <button onClick={reset} className="mt-4 text-xs text-primary hover:underline">طلب زيارة جديد</button>
                  </div>
                  {/* إشعار الشخص المطلوب (نموذج محاكاة) */}
                  <div className="rounded-2xl border border-border bg-background/40 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-primary mb-3">إشعار الشخص المطلوب</div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-11 rounded-full bg-primary/15 text-primary grid place-items-center"><User className="size-5" /></div>
                      <div>
                        <div className="font-semibold text-fg text-sm">زائر جديد</div>
                        <div className="text-[11px] text-muted-foreground">{org} · {contact}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleCallAccept}
                        disabled={creatingCall || !selectedCallType}
                        className="rounded-lg bg-emerald-500/15 text-emerald-400 py-2 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {creatingCall ? <Loader2 className="size-3 animate-spin" /> : null}
                        قبول
                      </button>
                      <button
                        onClick={() => toast.error("تم رفض الطلب")}
                        className="rounded-lg bg-destructive/15 text-destructive py-2 text-xs font-medium hover:bg-destructive/25"
                      >
                        رفض
                      </button>
                      <button
                        onClick={() => toast.info("سيتم اقتراح موعد")}
                        className="rounded-lg bg-amber-500/15 text-amber-400 py-2 text-xs font-medium hover:bg-amber-500/25"
                      >
                        طلب موعد
                      </button>
                    </div>
                    {!selectedCallType && contact && (
                      <p className="text-[11px] text-muted-foreground mt-2 text-center">زر القبول متاح فقط للمكالمات الصوتية والمرئية</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ٤) تدفق الموعد */}
          {screen === "appt" && (
            <div className="max-w-xl mx-auto">
              {!apptResult ? (
                <div>
                  <h4 className="text-center font-semibold text-fg mb-1">أدخل بيانات الموعد</h4>
                  <p className="text-center text-xs text-muted-foreground mb-5">جارٍ البحث في سجل المواعيد عند التحقق</p>
                  <div className="space-y-3">
                    <input value={apptNo} onChange={(e) => setApptNo(e.target.value)} className="mulki-input" placeholder="رقم الموعد" />
                    <input className="mulki-input" placeholder="رقم الجوال — 05xxxxxxxx" />
                    <input className="mulki-input" placeholder="البريد الإلكتروني — name@example.com" />
                  </div>
                  <button onClick={() => setApptResult(apptNo.trim() ? "found" : "notfound")}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl mulki-gold-bg px-5 py-2.5 text-sm font-bold hover:opacity-90">
                    <Search className="size-4" /> تحقق من الموعد
                  </button>
                </div>
              ) : apptResult === "found" ? (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
                  <CheckCircle2 className="size-12 mx-auto text-emerald-400" />
                  <h4 className="mt-3 font-semibold text-fg">تم العثور على الموعد</h4>
                  <p className="text-sm text-muted-foreground mt-1">سيتم إشعار الشخص المعني بقدومك، وسيُسمح لك بالدخول.</p>
                  <p className="text-xs text-emerald-400 mt-3">جارٍ توليد المكالمة تلقائياً...</p>
                  <button onClick={reset} className="mt-4 text-xs text-primary hover:underline">تحقق من موعد آخر</button>
                </div>
              ) : (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
                  <XCircle className="size-12 mx-auto text-destructive" />
                  <h4 className="mt-3 font-semibold text-fg">لم يتم العثور على موعد مطابق</h4>
                  <p className="text-sm text-muted-foreground mt-1">تم إرسال تنبيه للشخص المعني — بانتظار الرد للسماح بالدخول أو ترتيب موعد.</p>
                  <button onClick={() => setApptResult(null)} className="mt-4 text-xs text-primary hover:underline">إعادة المحاولة</button>
                </div>
              )}
            </div>
          )}

          {/* استعلام سريع */}
          {screen === "inquiry" && (
            <div className="max-w-xl mx-auto text-center">
              <div className="size-16 mx-auto rounded-2xl bg-primary/15 text-primary grid place-items-center"><Bot className="size-8" /></div>
              <h4 className="mt-3 font-semibold text-fg">استعلام سريع مع نور</h4>
              <p className="text-sm text-muted-foreground mt-1">اسأل عن خدمات المنشأة أو مواعيد العمل أو الوصول.</p>
              <form onSubmit={(e) => { e.preventDefault(); toast.info("نور: شكراً لاستفسارك — سيتم الرد فوراً"); }}
                className="mt-5 flex gap-2">
                <input className="mulki-input flex-1" placeholder="اكتب استفسارك..." />
                <button className="inline-flex items-center gap-1.5 rounded-xl mulki-gold-bg px-4 text-sm font-bold hover:opacity-90"><Send className="size-4" /> إرسال</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* الهيكل التنظيمي الذكي */}
      <div className="mt-6 mulki-card p-6">
        <div className="text-center mb-5">
          <h3 className="font-semibold text-fg">الهيكل التنظيمي الذكي</h3>
          <p className="text-xs text-muted-foreground mt-1">توجيه تلقائي للزائر إلى الشخص الصحيح حسب الهيكل المعتمد</p>
        </div>
        <div className="flex flex-wrap items-stretch justify-center gap-2">
          {ORG_CHAIN.map((node, i) => (
            <div key={node.label} className="flex items-center gap-2">
              <div className="rounded-xl border border-border bg-background/40 px-4 py-3 text-center min-w-[120px]">
                <node.Icon className="size-5 mx-auto text-primary" />
                <div className="text-[10px] text-muted-foreground mt-1.5">{node.label}</div>
                <div className="text-xs font-medium text-fg">{node.value}</div>
              </div>
              {i < ORG_CHAIN.length - 1 && <ArrowRight className="size-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* مميزات البوابة الذكية */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="mulki-card p-5 flex items-start gap-3">
            <span className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0"><f.Icon className="size-5" /></span>
            <div>
              <div className="font-semibold text-sm text-fg">{f.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8 max-w-3xl mx-auto">
        بوابة الزائر الذكية تضمن تجربة احترافية وآمنة وسريعة للزوار، وتربطهم بالأشخاص المناسبين في الوقت المناسب.
      </p>
    </section>
  );
}

function EntryBtn({ Icon, title, sub, tone, onClick }: {
  Icon: typeof User; title: string; sub: string; tone: "primary" | "emerald" | "violet"; onClick: () => void;
}) {
  const tones = {
    primary: "bg-primary/15 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-400",
    violet: "bg-violet-500/15 text-violet-400",
  } as const;
  return (
    <button onClick={onClick} className="group flex items-center gap-4 rounded-2xl border border-border bg-background/40 p-5 text-start hover:border-primary/60 transition-colors">
      <span className={`size-12 rounded-xl grid place-items-center shrink-0 ${tones[tone]}`}><Icon className="size-6" /></span>
      <div className="flex-1">
        <div className="font-semibold text-fg">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </div>
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
}

function PickList({ title, items, onPick }: {
  title: string;
  items: { value: string; label: string }[];
  onPick: (value: string, label: string) => void;
}) {
  return (
    <div>
      <h4 className="text-center font-semibold text-fg mb-4">{title}</h4>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {items.map((it) => (
          <button key={it.value} onClick={() => onPick(it.value, it.label)}
            className="rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-fg hover:border-primary/60 hover:bg-primary/5 transition-colors text-start">
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-1.5 sm:gap-3">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
              done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : active ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-background/40 text-muted-foreground"}`}>
              <span className="grid size-4 place-items-center rounded-full bg-current/20 text-[10px]">{done ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < steps.length - 1 && <span className="text-muted-foreground text-xs">—</span>}
          </div>
        );
      })}
    </div>
  );
}
