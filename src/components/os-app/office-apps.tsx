"use client";

import { createContext, useContext, useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { Calculator as CalcIcon, StickyNote, LayoutDashboard, Calendar as CalIcon, Mic, Eraser, Trash2 } from "lucide-react";

export type OfficeAppId =
  | "calculator" | "notes" | "whiteboard" | "date-calc" | "voice-memo"
  | "email" | "chat" | "calls" | "printer" | "scanner" | "camera" | "flash" | "merge"
  | "hours" | "leave" | "vehicles" | "office-suite" | "guest-chair";

type Ctx = { open: (id: OfficeAppId) => void };
const OfficeAppsCtx = createContext<Ctx>({ open: () => {} });
export const useOfficeApps = () => useContext(OfficeAppsCtx);

const TITLES: Record<OfficeAppId, string> = {
  calculator: "الآلة الحاسبة", notes: "الملاحظات", whiteboard: "اللوحة البيضاء",
  "date-calc": "حاسبة التاريخ", "voice-memo": "ملاحظة صوتية", email: "البريد الإلكتروني",
  chat: "المحادثات الداخلية", calls: "سجل المكالمات", printer: "الطابعة", scanner: "الماسح الضوئي",
  camera: "آلة التصوير", flash: "فلاش ميموري", merge: "تحويل/دمج الملفات", hours: "ساعات العمل",
  leave: "الإجازات", vehicles: "إدارة المركبات", "office-suite": "برامج الأوفيس", "guest-chair": "كرسي الضيف",
};

export function OfficeAppsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<OfficeAppId | null>(null);
  const ctx = useMemo(() => ({ open: (id: OfficeAppId) => setActive(id) }), []);
  return (
    <OfficeAppsCtx.Provider value={ctx}>
      {children}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{active ? TITLES[active] : ""}</DialogTitle>
          </DialogHeader>
          {active === "calculator" && <CalculatorApp />}
          {active === "notes" && <NotesApp />}
          {active === "whiteboard" && <WhiteboardApp />}
          {active === "date-calc" && <DateCalcApp />}
          {active === "voice-memo" && <VoiceMemoApp />}
          {active === "email" && <SimpleListApp items={["لا توجد رسائل جديدة في صندوق الوارد", "البريد متصل بخادم المؤسسة"]} />}
          {active === "chat" && <SimpleListApp items={["لا توجد محادثات نشطة", "حالة الاتصال: متاح"]} />}
          {active === "calls" && <SimpleListApp items={["لا يوجد سجل مكالمات اليوم"]} />}
          {active === "hours" && <WorkHoursApp />}
          {active === "leave" && <LeaveApp />}
          {active === "vehicles" && <SimpleListApp items={["لا توجد طلبات مركبات مفتوحة", "للحجز، استخدم مركز طلبات الخدمات"]} />}
          {active === "office-suite" && <OfficeSuiteApp />}
          {active === "guest-chair" && <SimpleListApp items={["كرسي الضيف متاح للاجتماعات الفردية", "للحجز، أنشئ موعداً جديداً"]} />}
          {(active === "printer" || active === "scanner" || active === "camera" || active === "flash" || active === "merge") && (
            <ComingSoonApp id={active} />
          )}
        </DialogContent>
      </Dialog>
    </OfficeAppsCtx.Provider>
  );
}

function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const press = (v: string) => {
    if (v === "C") { setDisplay("0"); setExpr(""); return; }
    if (v === "=") {
      try {
        const safe = expr.replace(/[^0-9+\-*/.() ]/g, "");
        const r = Function(`"use strict"; return (${safe || 0})`)();
        setDisplay(String(r)); setExpr(String(r));
      } catch { setDisplay("خطأ"); }
      return;
    }
    const next = (expr === "0" || expr === "" ? "" : expr) + v;
    setExpr(next); setDisplay(next);
  };
  const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted p-4 text-end font-mono text-2xl break-all min-h-[60px]">{display}</div>
      <div className="grid grid-cols-4 gap-2">
        <Button variant="destructive" className="col-span-4" onClick={() => press("C")}><Eraser className="size-4 ml-1" /> مسح</Button>
        {keys.map((k) => (
          <Button key={k} variant={["+","-","*","/","="].includes(k) ? "default" : "outline"} onClick={() => press(k)} className="h-12 text-lg font-mono">{k}</Button>
        ))}
      </div>
    </div>
  );
}

function NotesApp() {
  const [notes, setNotes] = useState<string[]>([]);
  const [text, setText] = useState("");
  useEffect(() => { try { setNotes(JSON.parse(localStorage.getItem("mulki:notes") ?? "[]")); } catch { /* ignore */ } }, []);
  const save = () => {
    if (!text.trim()) return;
    const next = [text.trim(), ...notes].slice(0, 50);
    setNotes(next); localStorage.setItem("mulki:notes", JSON.stringify(next)); setText("");
    toast.success("تم حفظ الملاحظة");
  };
  const remove = (i: number) => {
    const next = notes.filter((_, idx) => idx !== i);
    setNotes(next); localStorage.setItem("mulki:notes", JSON.stringify(next));
  };
  return (
    <div className="space-y-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ملاحظتك..." rows={3} />
      <Button onClick={save} className="w-full"><StickyNote className="size-4 ml-1" /> حفظ</Button>
      <div className="space-y-2 max-h-64 overflow-auto">
        {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد ملاحظات بعد</p>}
        {notes.map((n, i) => (
          <div key={i} className="rounded-lg border p-3 text-sm flex items-start justify-between gap-2">
            <span className="flex-1 whitespace-pre-wrap">{n}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(i)} className="h-7 w-7"><Trash2 className="size-3.5 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhiteboardApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#1e40af"; ctx.lineWidth = 2; ctx.lineCap = "round";
  }, []);
  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ev = ("touches" in e ? e.touches[0] : e) as { clientX: number; clientY: number };
    return { x: (ev.clientX - r.left) * (c.width / r.width), y: (ev.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => { const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); drawing.current = true; };
  const move = (e: React.MouseEvent | React.TouchEvent) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); };
  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} width={640} height={360}
        className="w-full rounded-lg border bg-white touch-none cursor-crosshair"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <Button variant="outline" onClick={clear} className="w-full"><Eraser className="size-4 ml-1" /> مسح اللوحة</Button>
    </div>
  );
}

function DateCalcApp() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const diff = useMemo(() => {
    const d1 = new Date(from).getTime(); const d2 = new Date(to).getTime();
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }, [from, to]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="rounded-lg border p-4 text-center">
        <CalIcon className="size-6 mx-auto mb-2 text-primary" />
        <div className="text-3xl font-bold">{diff ?? "—"}</div>
        <div className="text-xs text-muted-foreground mt-1">يوم</div>
      </div>
    </div>
  );
}

function VoiceMemoApp() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => { const blob = new Blob(chunks.current, { type: "audio/webm" }); setUrl(URL.createObjectURL(blob)); stream.getTracks().forEach((t) => t.stop()); };
      rec.start(); recRef.current = rec; setRecording(true);
    } catch { toast.error("تعذّر الوصول للميكروفون"); }
  };
  const stop = () => { recRef.current?.stop(); setRecording(false); };
  return (
    <div className="space-y-3 text-center">
      <div className={`size-24 rounded-full mx-auto grid place-items-center ${recording ? "bg-destructive/20 animate-pulse" : "bg-muted"}`}>
        <Mic className={`size-12 ${recording ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      {!recording ? <Button onClick={start} className="w-full">بدء التسجيل</Button> : <Button variant="destructive" onClick={stop} className="w-full">إيقاف</Button>}
      {url && <audio src={url} controls className="w-full mt-3" />}
    </div>
  );
}

function SimpleListApp({ items }: { items: string[] }) {
  return <div className="space-y-2">{items.map((it, i) => <div key={i} className="rounded-lg border p-3 text-sm">{it}</div>)}</div>;
}

function WorkHoursApp() {
  const [start] = useState(() => {
    const s = localStorage.getItem("mulki:work-start");
    if (s) return Number(s);
    const now = Date.now(); localStorage.setItem("mulki:work-start", String(now)); return now;
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const ms = now - start; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000);
  return (
    <div className="text-center space-y-3">
      <div className="text-5xl font-mono font-bold text-primary">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</div>
      <p className="text-sm text-muted-foreground">مدة الجلسة الحالية</p>
      <Button variant="outline" onClick={() => { localStorage.removeItem("mulki:work-start"); window.location.reload(); }}>تصفير العدّاد</Button>
    </div>
  );
}

function LeaveApp() {
  return (
    <div className="space-y-3 text-center">
      <div className="rounded-lg border p-6">
        <div className="text-4xl font-bold text-primary">12</div>
        <div className="text-sm text-muted-foreground mt-1">يوم متبقي من رصيد الإجازة السنوية</div>
      </div>
      <Button className="w-full" onClick={() => { window.location.href = "/service-requests"; }}>تقديم طلب إجازة جديد</Button>
    </div>
  );
}

function OfficeSuiteApp() {
  const apps = [
    { name: "محرر النصوص", color: "text-blue-500" },
    { name: "الجداول", color: "text-emerald-500" },
    { name: "العروض التقديمية", color: "text-orange-500" },
    { name: "البريد", color: "text-sky-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {apps.map((a) => (
        <button key={a.name} onClick={() => toast.info(`${a.name} — قيد التطوير`)}
          className="rounded-lg border p-4 hover:border-primary/40 transition-colors text-center">
          <div className={`size-12 rounded-lg mx-auto mb-2 bg-muted grid place-items-center ${a.color}`}>
            <LayoutDashboard className="size-6" />
          </div>
          <div className="text-sm font-medium">{a.name}</div>
        </button>
      ))}
    </div>
  );
}

function ComingSoonApp({ id }: { id: OfficeAppId }) {
  return (
    <div className="text-center py-6 space-y-3">
      <div className="size-16 mx-auto rounded-full bg-muted grid place-items-center"><CalcIcon className="size-8 text-muted-foreground" /></div>
      <p className="text-sm">أداة <strong>{TITLES[id]}</strong> ستتوفر قريباً.</p>
      <p className="text-xs text-muted-foreground">يمكنك حالياً استخدام البدائل الرقمية من مركز الخدمات.</p>
      <DialogFooter>
        <Button variant="outline" onClick={() => { window.location.href = "/service-requests"; }}>طلب الخدمة</Button>
      </DialogFooter>
    </div>
  );
}
