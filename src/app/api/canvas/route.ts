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

// Generic POST proxy (also used for uploads & submissions initiation)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const path = searchParams.get("path");
  const method = searchParams.get("method") || "POST"; // allow override (PUT/DELETE)

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const apiKey = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  if (!domain || !path || !apiKey) {
    return new Response(JSON.stringify({ error: "Missing domain, path, or Authorization header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `https://${domain}/api/v1/${path}`;

  // Forward body as-is (works for JSON, form-data, urlencoded). We can't easily clone FormData without reading it; streaming pass-through via req.blob().
  let body: BodyInit | undefined = undefined;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('application/x-www-form-urlencoded')) {
    body = await req.text();
  } else if (contentType.startsWith('multipart/')) {
    // For multipart we need the raw binary; blob() should preserve boundaries
    const blob = await req.blob();
    body = blob;
  } else if (contentType) {
    body = await req.arrayBuffer();
  }

  try {
    const canvasRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Don't set content-type manually for multipart so boundary is preserved
        ...(contentType.startsWith('multipart/') ? {} : { 'Content-Type': contentType || 'application/octet-stream' }),
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body
    });
    const text = await canvasRes.text();
    return new Response(text, {
      status: canvasRes.status,
      headers: { 'Content-Type': canvasRes.headers.get('Content-Type') || 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
