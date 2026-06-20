import { RtcTokenBuilder, RtcRole } from "agora-token";

export const runtime = "nodejs";

// يولّد توكن Agora مؤقت (صالح ساعة) لكل مستخدم وغرفة
export async function POST(req: Request) {
  const appId = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCert) {
    return Response.json({ ok: false, error: "Agora غير مُفعّل" }, { status: 200 });
  }

  let body: { channelName?: string; uid?: number; email?: string } = {};
  try { body = await req.json(); } catch { /* تجاهل */ }

  const channelName = (body.channelName || "").trim();
  if (!channelName) {
    return Response.json({ ok: false, error: "channelName مطلوب" }, { status: 400 });
  }

  const uid = body.uid ?? Math.floor(Math.random() * 100000);
  const expireTime = Math.floor(Date.now() / 1000) + 3600; // ساعة واحدة

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCert,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime,
    expireTime
  );

  return Response.json({ ok: true, token, uid, channelName, appId });
}
