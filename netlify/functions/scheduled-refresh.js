// Netlify Scheduled Function: Hourly cache warm-up
// Runs every hour to pre-fetch data from Sreality.cz
// Schedule defined in netlify.toml: @hourly

import { handler as propertiesHandler } from "./fetch-properties.js";
import { handler as ratesHandler } from "./fetch-rates.js";

export async function handler(event) {
  const start = Date.now();
  console.log("[BydlímTu] Scheduled refresh at", new Date().toISOString());

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
