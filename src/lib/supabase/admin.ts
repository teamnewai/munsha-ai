import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// رابط mulki-reos العام (آمن). يتبقّى متغيّر سرّي واحد فقط لتفعيل القراءة الحيّة.
const DEFAULT_URL = "https://fgincdqvhnuarqcdnsfe.supabase.co";

/**
 * عميل Supabase للخادم بمفتاح Service-Role (يتجاوز RLS للقراءة فقط).
 * يُستخدم في مكوّنات الخادم فقط — لا يُستورد في كود العميل.
 * يُرجع null إذا لم يُضبط SUPABASE_SERVICE_ROLE_KEY، فيتراجع التطبيق إلى بيانات العرض.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
