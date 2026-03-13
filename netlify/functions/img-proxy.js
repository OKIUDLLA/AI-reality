// =============================================================================
// Netlify Function: Image proxy pro Sreality CDN
// Stahuje obrázky server-side (bez Referer problémů) a cachuje na Netlify CDN
// =============================================================================

// Simple in-memory rate limiter (per IP, resets on cold start)
const rateLimiter = new Map();
const RATE_LIMIT = 100; // max requests per IP per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimiter.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function handler(event) {
  // Rate limiting
  const clientIp = (event.headers || {})["x-forwarded-for"] || "unknown";
  if (!checkRateLimit(clientIp)) {
    return {
      statusCode: 429,
      headers: { "Content-Type": "text/plain", "Retry-After": "60" },
      body: "Too many requests",
    };
  }

  const url = (event.queryStringParameters || {}).url;

  if (!url) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Missing ?url= parameter",
    };
  }

  // URL length limit (prevent abuse)
  if (url.length > 2048) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "URL too long",
    };
  }

  // Only allow known reality CDN domains (prevent SSRF)
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

  // Block non-HTTPS
  if (parsed.protocol !== "https:") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Only HTTPS URLs allowed",
    };
  }

  // Block private/internal IPs (SSRF protection)
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "text/plain" },
      body: "Internal addresses not allowed",
    };
  }

  // Domain allowlist check
  if (!allowedPatterns.some(p => hostname.endsWith(p))) {
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
      redirect: "error", // Don't follow redirects (SSRF protection)
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "text/plain" },
        body: `Upstream error: ${resp.status}`,
      };
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";

    // Verify response is actually an image
    if (!contentType.startsWith("image/")) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain" },
        body: "Response is not an image",
      };
    }

    const buffer = Buffer.from(await resp.arrayBuffer());

    // Limit response size (5MB max)
    if (buffer.length > 5 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers: { "Content-Type": "text/plain" },
        body: "Image too large",
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
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
