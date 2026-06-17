import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مُلكي — نظام تشغيل الأعمال",
    short_name: "مُلكي",
    description: "مكتبك الكامل — بلا جدران، بلا إيجار، بلا حدود.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e1a",
    theme_color: "#1f59e0",
    lang: "ar",
    dir: "rtl",
  };
}
