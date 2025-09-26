// Deprecated legacy API route (pages directory style). Prefer /api/canvas with Authorization header.
// Keeping for backward compatibility; adjust to header-based auth if still used.
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { domain, path, method = 'GET' } = req.query;
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined;
  if (!domain || !path || !apiKey) {
    res.status(400).json({ error: 'Missing domain, path, or Authorization header (Bearer token)' });
    return;
  }
  const url = `https://${domain}/api/v1/${path}`;
  try {
    const canvasRes = await fetch(url, {
      method: method as string,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: ['POST', 'PUT', 'PATCH'].includes((method as string).toUpperCase()) ? JSON.stringify(req.body) : undefined
    });
    const text = await canvasRes.text();
    res.status(canvasRes.status).send(text);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
