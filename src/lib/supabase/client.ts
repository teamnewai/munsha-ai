import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل Supabase للمتصفح.
 * يُرجع null إذا لم تُضبط المفاتيح بعد — حتى يعمل التطبيق محلياً قبل ربط قاعدة البيانات.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
