import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://mulkios.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // الصفحات العامة فقط (الصفحات المحمية لا تُفهرس)
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
