import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// مُلكي — سياسة المحتوى (CSP): تسمح فقط بالمصادر الموثوقة
//  self            = نطاق موقعنا فقط
//  *.supabase.co   = قاعدة البيانات والمصادقة (REST + WebSocket)
//  fonts.google*   = خط Tajawal/Cairo
//  'unsafe-eval'   = في التطوير فقط (Next يحتاجه)؛ مُزال في الإنتاج لأعلى أمان
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https:`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  `frame-ancestors 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

// رؤوس أمان على مستوى الإنتاج (مرجع: MULKI Blueprint §1.2, §20)
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
