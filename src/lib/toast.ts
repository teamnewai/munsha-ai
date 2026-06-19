"use client";

// بديل خفيف لـ sonner — إشعار صغير يظهر أسفل الشاشة
function show(message: string, color: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;background:${color};color:#fff;padding:10px 18px;border-radius:12px;font-size:14px;font-family:inherit;box-shadow:0 10px 30px rgba(0,0,0,.35);direction:rtl`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = "opacity .4s"; el.style.opacity = "0"; }, 2200);
  setTimeout(() => el.remove(), 2700);
}

export const toast = {
  success: (m: string) => show(m, "#16a34a"),
  error: (m: string) => show(m, "#dc2626"),
  info: (m: string) => show(m, "#2563eb"),
  message: (m: string) => show(m, "#334155"),
};
