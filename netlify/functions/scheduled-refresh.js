// Netlify Scheduled Function: Hourly cache warm-up
// Runs every hour to pre-fetch data from Sreality.cz
// Schedule defined in netlify.toml: @hourly

import { handler as propertiesHandler } from "./fetch-properties.js";
import { handler as ratesHandler } from "./fetch-rates.js";

// Rate limiter for manual /api/refresh calls
const refreshLimiter = new Map();
const REFRESH_LIMIT = 5; // max 5 manual refreshes per IP per hour
const REFRESH_WINDOW = 3600000; // 1 hour

function checkRefreshLimit(ip) {
  const now = Date.now();
  const entry = refreshLimiter.get(ip);
  if (!entry || now - entry.start > REFRESH_WINDOW) {
    refreshLimiter.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= REFRESH_LIMIT;
}

export async function handler(event) {
  // Check if this is a scheduled invocation (from Netlify cron)
  const isScheduled = event.httpMethod === undefined || event.httpMethod === null;

  // For HTTP calls (via /api/refresh redirect), apply rate limiting
  if (!isScheduled) {
    const clientIp = (event.headers || {})["x-forwarded-for"] || "unknown";
    if (!checkRefreshLimit(clientIp)) {
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "3600" },
        body: JSON.stringify({ ok: false, error: "Too many refresh requests. Try again later." }),
      };
    }
  }

  const start = Date.now();
  console.log("[BydlímTu] Scheduled refresh at", new Date().toISOString(), isScheduled ? "(cron)" : "(manual)");

  try {
    // Warm both caches in parallel
    const [propResult, ratesResult] = await Promise.all([
      propertiesHandler({ queryStringParameters: { limit: "60", page: "1" } }),
      ratesHandler(event),
    ]);

    const propData = JSON.parse(propResult.body);
    const ratesData = JSON.parse(ratesResult.body);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`[BydlímTu] Refresh done in ${elapsed}s: ${propData.totalAll || propData.count || 0} properties, ${ratesData.banks?.length || 0} banks`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        elapsed: elapsed + "s",
        totalProperties: propData.totalAll || propData.count || 0,
        pageProperties: propData.count || 0,
        banks: ratesData.banks?.length || 0,
      }),
    };
  } catch (error) {
    console.error("[BydlímTu] Scheduled refresh error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
}
