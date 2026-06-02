export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const { action, email, password, name } = req.body;

  try {
    let url, body;
    if (action === 'signup') {
      url = `${SUPABASE_URL}/auth/v1/signup`;
      body = { email, password, data: { full_name: name } };
    } else if (action === 'login') {
      url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
      body = { email, password };
    } else if (action === 'logout') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const r = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
      });
      return res.status(200).json({ success: true });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) return res.status(400).json({ error: data.error_description || data.msg || 'خطأ في المصادقة' });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
