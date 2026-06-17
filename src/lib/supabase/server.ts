import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * عميل Supabase للخادم (Server Components / Route Handlers).
 * يُرجع null إذا لم تُضبط المفاتيح بعد.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // يُستدعى من Server Component — يمكن تجاهله مع وجود middleware لتحديث الجلسة.
        }
      },
    },
  });
}

/** عميل بصلاحيات الخدمة (Service Role) — للعمليات الإدارية فقط على الخادم */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const { createClient: createSb } = require("@supabase/supabase-js");
  return createSb(url, serviceKey, { auth: { persistSession: false } });
}
