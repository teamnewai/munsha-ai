"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateStructure, type GeneratedStructure } from "@/lib/orgGenerator";

interface Saved {
  name: string;
  country: string;
  city: string;
  activity: string;
  structure: GeneratedStructure;
}

export default function StructurePage() {
  const [data, setData] = useState<Saved | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("mulki_structure");
      if (raw) {
        setData(JSON.parse(raw));
        return;
      }
    } catch {
      /* تجاهل */
    }
    // عيّنة افتراضية إن لم يُفتح مكتبٌ بعد
    setData({
      name: "منشأة تجريبية",
      country: "SA",
      city: "الرياض",
      activity: "realestate",
      structure: generateStructure("realestate", 20),
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <header className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/os" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 font-extrabold text-brand-950">
              👑
            </span>
            <span className="text-sm font-extrabold">MULKI OS — الهيكل التنظيمي</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
          >
            🖨️ طباعة الوثيقة
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {!data ? (
          <p className="text-center text-slate-400">جارٍ التحميل...</p>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-2xl font-extrabold">{data.name}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {data.city}، {data.country} · رقم الإصدار:{" "}
                <span className="font-mono font-bold text-gold-400">{data.structure.version}</span>
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="فئة الحجم" value={data.structure.scale} />
                <Stat label="الإدارات" value={String(data.structure.deptCount)} />
                <Stat label="الأقسام" value={String(data.structure.sectionCount)} />
                <Stat label="المناصب" value={String(data.structure.roleCount)} />
              </div>
              <p className="mt-3 text-sm text-slate-400">النموذج: {data.structure.model}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {data.structure.departments.map((d) => (
                <div key={d.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-lg">{d.icon}</span>
                      {d.name}
                    </div>
                    {d.isCore && (
                      <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-bold text-gold-300">
                        أساسي
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-slate-400">الأقسام</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {d.sections.map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-xs"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-slate-400">المناصب</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {d.roles.map((r) => (
                        <span key={r} className="text-xs text-slate-300">
                          • {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-6 py-3 font-bold text-brand-950 hover:bg-gold-600"
              >
                الدخول إلى المكتب ←
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-xl font-extrabold text-gold-400">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
