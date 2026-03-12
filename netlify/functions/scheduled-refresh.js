// Netlify Scheduled Function: Hourly data refresh
// This runs on a cron schedule to keep the Sreality API cache warm
// Schedule is defined in netlify.toml: @hourly

import { handler as propertiesHandler } from "./fetch-properties.js";
import { handler as ratesHandler } from "./fetch-rates.js";

export async function handler(event) {
  console.log("[BydlímTu] Scheduled refresh triggered at", new Date().toISOString());

  try {
    // Warm up both caches
    const [propResult, ratesResult] = await Promise.all([
      propertiesHandler(event),
      ratesHandler(event),
    ]);

    const propData = JSON.parse(propResult.body);
    const ratesData = JSON.parse(ratesResult.body);

    console.log(`[BydlímTu] Refreshed: ${propData.count || 0} properties, ${ratesData.banks?.length || 0} bank rates`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        properties: propData.count || 0,
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
