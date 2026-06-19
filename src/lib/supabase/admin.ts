import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase للخادم بمفتاح Service-Role (يتجاوز RLS للقراءة فقط).
 * يُستخدم في مكوّنات الخادم فقط — لا يُستورد في كود العميل.
 * يُرجع null إذا لم تُضبط المفاتيح، فيتراجع التطبيق إلى بيانات العرض.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
