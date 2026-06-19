"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

// مُلكي — مكوّن محادثة AI عام (يُستخدم لمساعد المالك ووكلاء الأقسام)
export function AiChat({
  endpoint,
  title,
  placeholder = "اكتب رسالتك…",
  emptyHint = "ابدأ المحادثة…",
  payload = {},
  accent = "emerald",
}: {
  endpoint: string;
  title: string;
  placeholder?: string;
  emptyHint?: string;
  payload?: Record<string, unknown>;
  accent?: "emerald" | "gold";
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const bubble = accent === "gold" ? "bg-gold-500/15 text-gold-100" : "bg-emerald-500/15 text-emerald-100";
  const btn = accent === "gold" ? "bg-gold-500 text-brand-950 hover:bg-gold-600" : "bg-emerald-600 text-white hover:bg-emerald-700";
  const label = accent === "gold" ? "text-gold-300" : "text-emerald-300";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, messages: next }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data?.reply || "تعذّر الرد." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "تعذّر الاتصال." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-300">{title}</h3>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {msgs.length === 0 && <p className="text-sm text-slate-500">{emptyHint}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-white/10 text-slate-100" : bubble}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className={`text-end text-xs ${label}`}>يكتب…</p>}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-gold-500 focus:outline-none"
        />
        <button type="submit" disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${btn}`}>
          إرسال
        </button>
      </form>
    </div>
  );
}
