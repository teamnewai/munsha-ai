export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt مفقود' });
    const API_KEY = process.env.ANTHROPIC_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'مفتاح الذكاء الاصطناعي غير مُهيأ' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: 'أنت خبير في التصميم التنظيمي والموارد البشرية ودراسات الجدوى في منطقة الخليج العربي. أجب فقط بـ JSON صالح دون markdown أو backticks. جميع القيم باللغة العربية ما عدا أسماء الخصائص.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data?.error?.message || 'خطأ في الذكاء الاصطناعي' });

    const txt = data.content.map(b => b.text || '').join('').replace(/```json|```/gi, '').trim();
    return res.status(200).json(JSON.parse(txt));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
