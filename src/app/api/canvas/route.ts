import { NextRequest } from "next/server";

// Expect Authorization: Bearer <API_KEY>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const path = searchParams.get("path");
  const method = searchParams.get("method") || "GET";

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const apiKey = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  if (!domain || !path || !apiKey) {
    return new Response(JSON.stringify({ error: "Missing domain, path, or Authorization header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `https://${domain}/api/v1/${path}`;

  try {
    const canvasRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json'
      }
    });
    const data = await canvasRes.text();
    return new Response(data, {
      status: canvasRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
