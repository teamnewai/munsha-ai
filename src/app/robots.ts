import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://mulkios.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing"],
        disallow: ["/dashboard", "/os", "/portal", "/onboarding", "/login", "/api"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
