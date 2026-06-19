import { createBrowserClient } from "@supabase/ssr";

// قيم عامة افتراضية لمشروع mulki-reos (الرابط والمفتاح العام آمنان للنشر).
// تُتجاوز عبر متغيّرات البيئة عند الحاجة.
const DEFAULT_URL = "https://fgincdqvhnuarqcdnsfe.supabase.co";
const DEFAULT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnaW5jZHF2aG51YXJxY2Ruc2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODY3NTYsImV4cCI6MjA5Njk2Mjc1Nn0.MwhsrfGDFhvSSgUPb1x9v34TQE5_wV5vF9eOl3ITczM";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON;

/** عميل Supabase للمتصفح. */
export function createClient() {
  if (!SB_URL || !SB_ANON) return null;
  return createBrowserClient(SB_URL, SB_ANON);
}

export const isSupabaseConfigured = () => Boolean(SB_URL && SB_ANON);
