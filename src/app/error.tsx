"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

// حدّ خطأ على مستوى المسار — يلتقط أخطاء العرض ويسجّلها ويعرض واجهة لطيفة.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error.message || "Render error", { source: "react-error-boundary", stack: error.stack });
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-bad/10 text-3xl">⚠️</div>
        <h2 className="mt-4 text-xl font-extrabold text-fg">حدث خطأ غير متوقع</h2>
        <p className="mt-2 text-sm text-mut">سُجّل الخطأ تلقائياً وسيُراجَع. يمكنك المحاولة من جديد.</p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-gold px-5 py-2 text-sm font-bold text-golddark hover:bg-gold/90"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
