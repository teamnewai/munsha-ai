import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FeedbackWidget } from "@/components/FeedbackWidget";

export const metadata: Metadata = {
  title: {
    default: "مُلكي إدراك — مكتبك الكامل بلا جدران",
    template: "%s | مُلكي إدراك",
  },
  description:
    "مُلكي إدراك لحلول الأعمال والتقنية: مكتبك الكامل — بلا جدران، بلا إيجار، بلا حدود. نظام تشغيل أعمال يفصل العمل عن المكان: مكتب افتراضي، سوق بيني، وحوكمة بالذكاء الاصطناعي — عربي أولاً.",
  applicationName: "مُلكي إدراك",
  keywords: ["مُلكي", "مُلكي إدراك", "مكتب افتراضي", "نظام تشغيل أعمال", "حلول الأعمال والتقنية", "السعودية", "PropTech"],
  authors: [{ name: "MULKI" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f59e0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
