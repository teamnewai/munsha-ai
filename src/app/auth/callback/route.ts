import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authorizeUser } from "@/app/actions/authz";

// مُلكي — استقبال تأكيد البريد / رابط الدخول / Google OAuth (PKCE code exchange)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && key) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // بوابة التحقق: لا يدخل إلا المصرّح لهم (منصّة داخلية)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { authorized, reason } = await authorizeUser({ userId: user.id, email: user.email });
        if (!authorized) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=${reason ?? "unauthorized"}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
