"use client";

import { useRef, useState } from "react";
import { ASSISTANT_NAME } from "@/lib/assistant";

// مُلكي إدراك — المساعد الذكي. يستدعي /api/ai/chat (OpenAI) عند توفّر المفتاح،
// ويسقط تلقائياً للتوجيه المحلي إن لم يُفعّل.

const QUICK_ACTIONS = [
  { key: "summary", label: "تلخيص المعاملات", icon: "📋" },
  { key: "letter", label: "إنشاء خطاب", icon: "✉️" },
  { key: "report", label: "إنشاء تقرير", icon: "📊" },
  { key: "tasks", label: "اقتراح مهام", icon: "✅" },
  { key: "search", label: "البحث في الملفات", icon: "🔎" },
  { key: "follow", label: "متابعة الطلبات", icon: "📨" },
];

const SUGGESTIONS = [
  "لديك 3 عقود تنتهي خلال 30 يوماً — أراجعها؟",
  "فاتورتان متأخرتان بقيمة 12,400 ر.س — أرسل تذكيراً؟",
  "طلب صيانة تجاوز SLA في برج العليا.",
];

interface Msg {
  role: "user" | "noor";
  text: string;
}

function routeReply(input: string): string {
  const t = input.trim();
  if (/عقد|عقود|تجديد/.test(t)) return "لديك 31 عقداً نشطاً، منها 3 تنتهي قريباً. أفتح لك قائمة العقود؟";
  if (/فاتور|دفع|مستحق|متأخر/.test(t)) return "هناك 7 فواتير معلّقة بإجمالي 12,400 ر.س. أعرض لك تقرير المتأخرات؟";
  if (/صيان/.test(t)) return "4 طلبات صيانة مفتوحة، واحدٌ منها تجاوز SLA. أوجّهك لشاشة الصيانة؟";
  if (/مستأجر|ساكن/.test(t)) return "إجمالي المستأجرين المرتبطين بعقودٍ نشطة هو 28. تبي تفاصيل أحدهم؟";
  if (/تقرير|ملخص/.test(t)) return "أجهّز لك ملخصاً يومياً: الوحدات، العقود، الفواتير، والصيانة. لحظات...";
  return "تمام، سجّلت طلبك. (في النسخة الحيّة سأتصل بمحرّك الذكاء لإنجازه فوراً.)";
}

export function SmartSecretary() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "noor", text: `أهلاً 👋 أنا ${ASSISTANT_NAME}، مساعدك الذكي. كيف أقدر أخدمك اليوم؟` },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const recogRef = useRef<unknown>(null);

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    setInput("");
    const history = messages.map((m) => ({
      role: m.role === "noor" ? "assistant" : "user",
      content: m.text,
    }));
    setMessages((m) => [...m, { role: "user", text: t }]);
    setThinking(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: t }] }),
      });
      const data = await res.json();
      const reply = data?.reply ? String(data.reply) : routeReply(t);
      setMessages((m) => [...m, { role: "noor", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "noor", text: routeReply(t) }]);
    } finally {
      setThinking(false);
    }
  }

  function toggleVoice() {
    const SR =
      (typeof window !== "undefined" &&
        ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      setMessages((m) => [...m, { role: "noor", text: "التعرّف الصوتي غير مدعوم في متصفحك." }]);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog: any = new (SR as any)();
    recog.lang = "ar-SA";
    recog.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) =>
      send(e.results[0][0].transcript);
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-lg">📜</span>
        <div>
          <div className="text-sm font-bold">{ASSISTANT_NAME}</div>
          <div className="text-xs text-emerald-400">{thinking ? "يكتب…" : "● متصل"}</div>
        </div>
      </div>

      {/* إجراءات سريعة */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => send(a.label)}
            className="rounded-xl border border-white/10 bg-black/20 p-2 text-center text-[11px] text-slate-200 hover:bg-white/10"
          >
            <div className="text-lg">{a.icon}</div>
            {a.label}
          </button>
        ))}
      </div>

      {/* المحادثة */}
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-3" style={{ minHeight: 160 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "noor"
                ? "bg-white/10 text-slate-100"
                : "ms-auto bg-gold-500 text-brand-950"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* اقتراحات اليوم */}
      <div className="mt-3">
        <div className="text-xs font-bold text-slate-400">اقتراحات اليوم</div>
        <div className="mt-1 space-y-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="block w-full rounded-lg bg-black/20 px-2 py-1.5 text-right text-[11px] text-slate-300 hover:bg-white/10"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* الإدخال */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={toggleVoice}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            listening ? "animate-pulse bg-rose-500" : "bg-white/10"
          }`}
          aria-label="إدخال صوتي"
        >
          🎤
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`اكتب لـ${ASSISTANT_NAME}...`}
          className="flex-1 rounded-full bg-black/30 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <button type="submit" disabled={thinking} className="rounded-full bg-gold-500 px-4 py-2 text-sm font-bold text-brand-950 disabled:opacity-50">
          {thinking ? "…" : "إرسال"}
        </button>
      </form>
    </div>
  );
}
