// Netlify Function: Czech mortgage rates API
// Returns current mortgage rates from Czech banks with web scraping fallback

const KNOWN_RATES_2026 = {
  updated: "2026-03-12",
  source: "top.cz, Swiss Life Hypoindex, ČNB",
  avg_rate: 4.42,
  best_rate: 3.99,
  hypoindex: 4.89,
  cnb_avg: 4.53,
  banks: [
    { name: "MONETA Money Bank", rate: 3.99, fixation: "5 let", ltv: "80%", note: "Nejnižší sazba na trhu" },
    { name: "Fio banka", rate: 4.08, fixation: "5 let", ltv: "80%", note: "Online sjednání" },
    { name: "UniCredit Bank", rate: 4.19, fixation: "5 let", ltv: "80%", note: "" },
    { name: "Raiffeisenbank", rate: 4.19, fixation: "5 let", ltv: "80%", note: "Flexibilní splátky" },
    { name: "Air Bank", rate: 4.29, fixation: "5 let", ltv: "80%", note: "Bez poplatků" },
    { name: "Česká spořitelna", rate: 4.59, fixation: "5 let", ltv: "80%", note: "Největší banka" },
    { name: "Komerční banka", rate: 4.59, fixation: "5 let", ltv: "80%", note: "" },
    { name: "ČSOB / Hypoteční banka", rate: 4.59, fixation: "5 let", ltv: "80%", note: "" },
    { name: "mBank", rate: 4.79, fixation: "5 let", ltv: "80%", note: "Online banka" },
    { name: "Partners", rate: 4.89, fixation: "5 let", ltv: "80%", note: "Finanční poradenství" },
  ],
  history: [
    { month: "04/2025", rate: 4.98 },
    { month: "05/2025", rate: 4.95 },
    { month: "06/2025", rate: 4.91 },
    { month: "07/2025", rate: 4.88 },
    { month: "08/2025", rate: 4.85 },
    { month: "09/2025", rate: 4.82 },
    { month: "10/2025", rate: 4.78 },
    { month: "11/2025", rate: 4.75 },
    { month: "12/2025", rate: 4.70 },
    { month: "01/2026", rate: 4.53 },
    { month: "02/2026", rate: 4.45 },
    { month: "03/2026", rate: 4.42 },
  ],
};

async function fetchFreshRates() {
  // Try to scrape current Hypoindex or bank comparison
  try {
    const urls = [
      "https://www.hypoindex.cz/hypoindex-vyvoj/",
      "https://www.top.cz/srovnani-hypotek",
    ];

    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BydlimTuBot/1.0)",
            Accept: "text/html",
          },
        });
        if (resp.ok) {
          const html = await resp.text();
          // Extract Hypoindex value — more specific regex to avoid matching random percentages
          const match = html.match(/[Hh]ypoindex[^0-9]*?(\d[,.]\d{1,2})\s*%/) ||
                        html.match(/průměrná[^0-9]*?sazba[^0-9]*?(\d[,.]\d{1,2})\s*%/) ||
                        html.match(/aktuální[^0-9]*?(\d[,.]\d{1,2})\s*%\s*p\.?\s*a/);
          if (match) {
            const rate = parseFloat(match[1].replace(",", "."));
            if (rate > 2.5 && rate < 8) {
              // Use fresh Hypoindex but keep bank details from known data
              const freshData = { ...KNOWN_RATES_2026 };
              freshData.hypoindex = rate;
              freshData.updated = new Date().toISOString().split("T")[0];
              return freshData;
            }
          }
        }
      } catch (e) {
        // Continue to next URL
      }
    }
  } catch (e) {
    // Fall through to known rates
  }
  return null;
}

let cachedRates = null;
let cachedAt = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (rates don't change often)

// Rate limiter
const rlMap = new Map();
function rl(ip) {
  const now = Date.now();
  const e = rlMap.get(ip);
  if (!e || now - e.s > 60000) { rlMap.set(ip, { s: now, c: 1 }); return true; }
  e.c++;
  return e.c <= 20;
}

export async function handler(event) {
  const now = Date.now();
  const ip = (event.headers || {})["x-forwarded-for"] || "?";
  if (!rl(ip)) {
    return { statusCode: 429, headers: { "Content-Type": "text/plain", "Retry-After": "60" }, body: "Too many requests" };
  }

  if (cachedRates && now - cachedAt < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "HIT",
      },
      body: cachedRates,
    };
  }

  try {
    const freshRates = await fetchFreshRates();
    const data = freshRates || KNOWN_RATES_2026;
    const body = JSON.stringify(data);

    cachedRates = body;
    cachedAt = now;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": freshRates ? "FRESH" : "KNOWN",
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(KNOWN_RATES_2026),
    };
  }
}
