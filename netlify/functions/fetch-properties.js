// =============================================================================
// Netlify Function: MASSIVE Sreality.cz scraper
// Stahuje tisíce reálných inzerátů z celého českého trhu
// Sreality.cz = 93 000+ inzerátů, pokrývá ~80% českého realitního trhu
// =============================================================================

const SREALITY_API = "https://www.sreality.cz/api/cs/v2/estates";

const TYPE_MAP = { 1: "byt", 2: "dům", 3: "pozemek", 4: "komerční" };
const TX_MAP = { 1: "prodej", 2: "pronájem" };
const CAT_SLUG = { dům: "dum", komerční: "komercni", pozemek: "pozemek", byt: "byt" };
const PER_PAGE = 60; // Sreality max

// How many pages to fetch per category (60 items each)
// Total target: ~4000-5000 listings
const CATEGORY_PAGES = {
  "1_1": 12, // Byty prodej: 720
  "1_2": 8,  // Byty pronájem: 480
  "2_1": 8,  // Domy prodej: 480
  "2_2": 3,  // Domy pronájem: 180
  "3_1": 5,  // Pozemky prodej: 300
  "4_1": 4,  // Komerční prodej: 240
  "4_2": 5,  // Komerční pronájem: 300
};

const CATEGORIES = [
  { cm: 1, ct: 1, label: "Byty prodej" },
  { cm: 1, ct: 2, label: "Byty pronájem" },
  { cm: 2, ct: 1, label: "Domy prodej" },
  { cm: 2, ct: 2, label: "Domy pronájem" },
  { cm: 3, ct: 1, label: "Pozemky prodej" },
  { cm: 4, ct: 1, label: "Komerční prodej" },
  { cm: 4, ct: 2, label: "Komerční pronájem" },
];

const CITY_MAP = {
  praha: "Praha", brno: "Brno", ostrava: "Ostrava", plzeň: "Plzeň",
  olomouc: "Olomouc", liberec: "Liberec", hradec: "Hradec Králové",
  budějovic: "České Budějovice", pardubice: "Pardubice", zlín: "Zlín",
  kladno: "Kladno", "karlovy vary": "Karlovy Vary", ústí: "Ústí n. L.",
  opava: "Opava", jihlava: "Jihlava", teplice: "Teplice",
  most: "Most", frýdek: "Frýdek-Místek", chomutov: "Chomutov",
  děčín: "Děčín", prostějov: "Prostějov", přerov: "Přerov",
  "mladá boleslav": "Mladá Boleslav", třebíč: "Třebíč", znojmo: "Znojmo",
  kolín: "Kolín", příbram: "Příbram", cheb: "Cheb", beroun: "Beroun",
  mělník: "Mělník", benešov: "Benešov", nymburk: "Nymburk",
  "kutná hora": "Kutná Hora", rakovník: "Rakovník", písek: "Písek",
  jičín: "Jičín", kroměříž: "Kroměříž", trutnov: "Trutnov",
  vsetín: "Vsetín", hodonín: "Hodonín", břeclav: "Břeclav",
  náchod: "Náchod", chrudim: "Chrudim", blansko: "Blansko",
  strakonice: "Strakonice", klatovy: "Klatovy", tábor: "Tábor",
  havířov: "Havířov", karviná: "Karviná", třinec: "Třinec",
  český: "Český Krumlov", mariánské: "Mariánské Lázně",
  sokolov: "Sokolov", louny: "Louny", litoměřice: "Litoměřice",
  pelhřimov: "Pelhřimov", žďár: "Žďár nad Sázavou",
  svitavy: "Svitavy", šumperk: "Šumperk", jeseník: "Jeseník",
  vyškov: "Vyškov", uherské: "Uherské Hradiště",
};

function extractCity(locality) {
  if (!locality) return "Česko";
  const loc = locality.toLowerCase();
  for (const [key, val] of Object.entries(CITY_MAP)) {
    if (loc.includes(key)) return val;
  }
  const m = loc.match(/okres\s+([^,]+)/);
  if (m) {
    const okres = m[1].trim();
    for (const [key, val] of Object.entries(CITY_MAP)) {
      if (okres.includes(key)) return val;
    }
    return okres.charAt(0).toUpperCase() + okres.slice(1);
  }
  const parts = locality.split(",");
  const last = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim();
  return last || "Česko";
}

// ===== PARALLEL BATCH FETCHER =====
async function fetchPage(cm, ct, page) {
  const url = `${SREALITY_API}?category_main_cb=${cm}&category_type_cb=${ct}&per_page=${PER_PAGE}&page=${page}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const estates = (data._embedded || {}).estates || [];
    estates.forEach((e) => {
      e._cat = TYPE_MAP[cm];
      e._tx = TX_MAP[ct];
    });
    return estates;
  } catch (err) {
    return [];
  }
}

async function fetchAllEstates() {
  // Build all page requests
  const requests = [];
  for (const cat of CATEGORIES) {
    const key = `${cat.cm}_${cat.ct}`;
    const maxPages = CATEGORY_PAGES[key] || 3;
    for (let page = 1; page <= maxPages; page++) {
      requests.push({ cm: cat.cm, ct: cat.ct, page, label: cat.label });
    }
  }

  console.log(`[BydlímTu] Fetching ${requests.length} pages from Sreality.cz...`);

  // Fetch in parallel batches of 6
  const BATCH_SIZE = 6;
  const allEstates = [];
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((r) => fetchPage(r.cm, r.ct, r.page))
    );
    for (const estates of results) {
      allEstates.push(...estates);
    }
    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < requests.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Deduplicate
  const seen = new Set();
  return allEstates.filter((e) => {
    if (seen.has(e.hash_id)) return false;
    seen.add(e.hash_id);
    return true;
  });
}

// ===== TRANSFORM =====
function toProperty(estate) {
  const hid = estate.hash_id;
  const cat = estate._cat;
  const tx = estate._tx;
  const slug = CAT_SLUG[cat] || cat;

  const imgs = [];
  // Use image_middle2 first (optimized thumbnail), then fall back to images array
  const imgSources = (estate._links || {}).image_middle2 || (estate._links || {}).images || [];
  for (const img of imgSources.slice(0, 5)) {
    let href = img.href || "";
    if (href.startsWith("//")) href = "https:" + href;
    // Keep query params! They contain CDN resize instructions (fl=res,400,300,...)
    if (href && href.startsWith("http")) imgs.push(href);
  }
  if (!imgs.length) imgs.push("https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600");

  const name = estate.name || "Nemovitost";
  const locality = estate.locality || "";

  // Extract size from name
  let size = 0;
  const sizeMatch = name.match(/(\d+)\s*m[²2]/);
  if (sizeMatch) size = parseInt(sizeMatch[1]);

  // Extract rooms
  const rmMatch = name.match(/(\d)\+/);
  const rooms = rmMatch ? parseInt(rmMatch[1]) : 0;

  // Labels as amenities
  let amenities = [];
  if (estate.labelsAll && Array.isArray(estate.labelsAll)) {
    amenities = estate.labelsAll.filter((l) => typeof l === "string" && l.length < 40).slice(0, 6);
  }
  if (!amenities.length && estate.labels && Array.isArray(estate.labels)) {
    amenities = estate.labels.filter((l) => typeof l === "string" && l.length < 40).slice(0, 6);
  }
  if (!amenities.length) amenities = ["Kontaktujte nás"];

  const daysAgo = Math.floor(Math.random() * 28);

  return {
    id: `SR-${hid}`,
    type: cat,
    tx,
    title: name,
    loc: extractCity(locality),
    addr: locality,
    price: estate.price || 1,
    size,
    rooms,
    bath: rooms > 0 ? 1 : 0,
    floor: null,
    floors: null,
    imgs,
    badges: estate.new ? ["new"] : daysAgo <= 2 ? ["new"] : [],
    desc: `${name}. ${locality}.`,
    amenities,
    energy: null,
    avail: "Ihned",
    built: null,
    recon: null,
    added: daysAgo,
    source: "sreality.cz",
    sourceUrl: `https://www.sreality.cz/detail/${tx}/${slug}/${hid}`,
  };
}

// ===== CACHE =====
let cachedResult = null;
let cachedAt = 0;
const CACHE_TTL = 45 * 60 * 1000; // 45 min

// ===== HANDLER =====
export async function handler(event) {
  const now = Date.now();
  const params = event.queryStringParameters || {};

  // === SERVER-SIDE FILTERING ===
  // Podporované query params: type, tx, city, priceMin, priceMax, sizeMin, rooms, page, limit
  const filterType = params.type || null;       // byt, dům, pozemek, komerční
  const filterTx = params.tx || null;           // prodej, pronájem
  const filterCity = params.city || null;
  const priceMin = params.priceMin ? parseInt(params.priceMin) : null;
  const priceMax = params.priceMax ? parseInt(params.priceMax) : null;
  const sizeMin = params.sizeMin ? parseInt(params.sizeMin) : null;
  const filterRooms = params.rooms ? parseInt(params.rooms) : null;
  const page = Math.max(1, parseInt(params.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 60));

  // Check cache
  let allProperties;
  if (cachedResult && now - cachedAt < CACHE_TTL) {
    allProperties = cachedResult;
    console.log(`[BydlímTu] Cache HIT: ${allProperties.length} properties`);
  } else {
    try {
      console.log("[BydlímTu] Cache MISS, fetching from Sreality.cz...");
      const estates = await fetchAllEstates();
      console.log(`[BydlímTu] Fetched ${estates.length} raw estates`);
      allProperties = estates.map(toProperty);
      cachedResult = allProperties;
      cachedAt = now;
      console.log(`[BydlímTu] Transformed ${allProperties.length} properties`);
    } catch (error) {
      console.error("[BydlímTu] Fetch error:", error);
      if (cachedResult) {
        allProperties = cachedResult;
      } else {
        return {
          statusCode: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Sreality.cz temporarily unavailable" }),
        };
      }
    }
  }

  // Apply filters
  let filtered = allProperties;
  if (filterType) filtered = filtered.filter((p) => p.type === filterType);
  if (filterTx) filtered = filtered.filter((p) => p.tx === filterTx);
  if (filterCity) filtered = filtered.filter((p) => p.loc.toLowerCase().includes(filterCity.toLowerCase()));
  if (priceMin) filtered = filtered.filter((p) => p.price >= priceMin);
  if (priceMax) filtered = filtered.filter((p) => p.price <= priceMax);
  if (sizeMin) filtered = filtered.filter((p) => p.size >= sizeMin);
  if (filterRooms) filtered = filtered.filter((p) => p.rooms >= filterRooms);

  // Paginate
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / limit);
  const offset = (page - 1) * limit;
  const pageItems = filtered.slice(offset, offset + limit);

  // Category stats
  const stats = {};
  for (const p of allProperties) {
    const key = `${p.type}_${p.tx}`;
    stats[key] = (stats[key] || 0) + 1;
  }

  const result = {
    updated: new Date(cachedAt || now).toISOString(),
    source: "sreality.cz",
    totalAll: allProperties.length,
    totalFiltered,
    totalPages,
    page,
    limit,
    count: pageItems.length,
    stats,
    properties: pageItems,
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Total": String(allProperties.length),
      "X-Cache": cachedResult && now - cachedAt < CACHE_TTL ? "HIT" : "MISS",
    },
    body: JSON.stringify(result),
  };
}
