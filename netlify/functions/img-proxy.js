// =============================================================================
// Netlify Function: Image proxy pro Sreality CDN
// Stahuje obrázky server-side (bez Referer problémů) a cachuje na Netlify CDN
// =============================================================================

export async function handler(event) {
  const url = (event.queryStringParameters || {}).url;

  if (!url) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Missing ?url= parameter",
    };
  }

  // Only allow known reality CDN domains
  const allowedPatterns = [
    ".sdn.cz",         // Sreality CDN
    ".bezrealitky.cz",  // Bezrealitky
    ".bezrealitky.com",
    ".sreality.cz",
  ];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Invalid URL",
    };
  }

  if (!allowedPatterns.some(p => parsed.hostname.endsWith(p))) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "text/plain" },
      body: "Domain not allowed",
    };
  }

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "image/webp,image/jpeg,image/png,image/*,*/*",
        Referer: "https://www.sreality.cz/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "text/plain" },
        body: `Upstream error: ${resp.status}`,
      };
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await resp.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "text/plain" },
      body: "Image fetch failed",
    };
  }
}
