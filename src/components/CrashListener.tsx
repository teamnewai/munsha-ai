"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

// مُلكي إدراك — مراقب الأعطال (Crash Monitoring):
// يلتقط الأخطاء غير المُلتقَطة ووعود الرفض غير المُعالَجة على مستوى النافذة.
export function CrashListener() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      reportError(e.message || "Uncaught error", {
        source: "window.onerror",
        stack: e.error?.stack,
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      reportError(
        typeof reason === "string" ? reason : reason?.message || "Unhandled rejection",
        { source: "unhandledrejection", stack: reason?.stack }
      );
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
