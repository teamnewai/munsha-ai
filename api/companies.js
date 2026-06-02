export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'غير مصرح' });

  // Get user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
  });
  const user = await userRes.json();
  if (!user.id) return res.status(401).json({ error: 'جلسة منتهية' });

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/companies?user_id=eq.${user.id}&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
      });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'POST') {
      const { name, data, formData } = req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: JSON.stringify({ user_id: user.id, name, data: JSON.stringify(data), form_data: JSON.stringify(formData) })
      });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'PUT') {
      const { id, name, data, formData } = req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}&user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: JSON.stringify({ name, data: JSON.stringify(data), form_data: JSON.stringify(formData), updated_at: new Date().toISOString() })
      });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}&user_id=eq.${user.id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
      });
      return res.status(200).json({ success: true });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
