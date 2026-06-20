"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/uikit/button";
import { Sparkles, Send, Bot, User } from "lucide-react";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

// رد احتياطي محلي عندما لا يكون مفتاح الذكاء مُفعّلاً بعد (ANTHROPIC_API_KEY)
const FALLBACK_REPLY =
  "أنا جاهزة للعمل بكامل قدراتي بمجرد تفعيل مفتاح الذكاء الاصطناعي (ANTHROPIC_API_KEY) في إعدادات النظام. مؤقتاً إليك موجز سريع: راجع المهام العاجلة واعتماد التقرير الشهري ومتابعة المعاملات المرتجعة. هل ترغب أن أنسّق مجلس الوكلاء؟";

export default function NoorPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [messages.length, thinking]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || thinking) return;
    const text = input.trim();
    const history = [...messages, { id: `u-${Date.now()}`, role: "user" as const, text }];
    setMessages(history);
    setInput("");
    setThinking(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply: string = (data?.reply && String(data.reply).trim()) || FALLBACK_REPLY;
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: FALLBACK_REPLY }]);
    } finally {
      setThinking(false);
    }
  };

  const suggestions = ["أوجزي لي اليوم", "لخّصي مؤسستي", "على ماذا ينبغي أن أركّز؟"];

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 md:p-8">
      <Card className="mulki-card flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="size-10 rounded-full mulki-gold-bg flex items-center justify-center"><Sparkles className="size-5" /></div>
          <div>
            <div className="font-display font-semibold">نور</div>
            <div className="text-xs text-muted-foreground">سكرتيرة تنفيذية · تنسّق مجلس الوكلاء الذكي</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Bot className="size-10 mx-auto mb-3 text-primary" />
              <p>مرحباً — أنا نور. اطلب موجزاً أو جدولة اجتماع أو دعني أنسّق مجلس الوكلاء التنفيذي.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-5">
                {suggestions.map((q) => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && <div className="size-8 shrink-0 rounded-full mulki-gold-bg flex items-center justify-center"><Sparkles className="size-4" /></div>}
              <div className={`max-w-2xl rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary/15 border border-primary/30" : "bg-card border border-border"}`}>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">{m.text}</div>
              </div>
              {m.role === "user" && <div className="size-8 shrink-0 rounded-full bg-secondary flex items-center justify-center"><User className="size-4" /></div>}
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full mulki-gold-bg flex items-center justify-center"><Sparkles className="size-4" /></div>
              <div className="rounded-2xl px-4 py-2.5 bg-card border border-border text-sm text-muted-foreground">نور تفكّر…</div>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-border p-4 flex gap-2">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="اسألي نور أي شيء…" autoFocus />
          <Button type="submit" disabled={!input.trim() || thinking} className="mulki-gold-bg hover:opacity-90 gap-2">
            <Send className="size-4 rtl:-scale-x-100" /> إرسال
          </Button>
        </form>
      </Card>
    </div>
  );
}
