// Netlify Function: Sreality.cz API proxy
// Fetches real estate data from Sreality and transforms it for BydlímTu Reality

const SREALITY_API = "https://www.sreality.cz/api/cs/v2/estates";

const TYPE_MAP = { 1: "byt", 2: "dům", 3: "pozemek", 4: "komerční" };
const TX_MAP = { 1: "prodej", 2: "pronájem" };
const CAT_SLUG = { dům: "dum", komerční: "komercni", pozemek: "pozemek", byt: "byt" };

const QUERIES = [
  { cm: 1, ct: 1, pp: 20, page: 1, label: "Byty prodej 1" },
  { cm: 1, ct: 1, pp: 20, page: 2, label: "Byty prodej 2" },
  { cm: 1, ct: 2, pp: 15, page: 1, label: "Byty pronájem" },
  { cm: 2, ct: 1, pp: 15, page: 1, label: "Domy prodej" },
  { cm: 2, ct: 2, pp: 5, page: 1, label: "Domy pronájem" },
  { cm: 4, ct: 2, pp: 8, page: 1, label: "Komerční pronájem" },
  { cm: 4, ct: 1, pp: 5, page: 1, label: "Komerční prodej" },
  { cm: 3, ct: 1, pp: 8, page: 1, label: "Pozemky" },
];

const CITY_MAP = {
  praha: "Praha", brno: "Brno", ostrava: "Ostrava", plzeň: "Plzeň",
  olomouc: "Olomouc", liberec: "Liberec", hradec: "Hradec Králové",
  budějovic: "České Budějovice", pardubice: "Pardubice", zlín: "Zlín",
  kladno: "Kladno", karlovy: "Karlovy Vary", ústí: "Ústí n. L.",
  opava: "Opava", jihlava: "Jihlava", teplice: "Teplice",
  most: "Most", "frýdek": "Frýdek-Místek", chomutov: "Chomutov",
  děčín: "Děčín", prostějov: "Prostějov", přerov: "Přerov",
  "mladá boleslav": "Mladá Boleslav", třebíč: "Třebíč", znojmo: "Znojmo",
  kolín: "Kolín", příbram: "Příbram", cheb: "Cheb", beroun: "Beroun",
  mělník: "Mělník", benešov: "Benešov", nymburk: "Nymburk",
  "kutná hora": "Kutná Hora", rakovník: "Rakovník", písek: "Písek",
  jičín: "Jičín", kroměříž: "Kroměříž", trutnov: "Trutnov",
  vsetín: "Vsetín", hodonín: "Hodonín", břeclav: "Břeclav",
  náchod: "Náchod", chrudim: "Chrudim", blansko: "Blansko",
  strakonice: "Strakonice", klatovy: "Klatovy",
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
  return parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim() || "Česko";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchEstates() {
  const allEstates = [];

  for (const q of QUERIES) {
    try {
      const url = `${SREALITY_API}?category_main_cb=${q.cm}&category_type_cb=${q.ct}&per_page=${q.pp}&page=${q.page}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BydlimTuBot/1.0)",
          Accept: "application/json",
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const estates = (data._embedded || {}).estates || [];
        estates.forEach((e) => {
          e._cat = TYPE_MAP[q.cm];
          e._tx = TX_MAP[q.ct];
        });
        allEstates.push(...estates);
      }
    } catch (err) {
      console.error(`[${q.label}] Error:`, err.message);
    }
    await sleep(300);
  }

  // Deduplicate
  const seen = new Set();
  return allEstates.filter((e) => {
    if (seen.has(e.hash_id)) return false;
    seen.add(e.hash_id);
    return true;
  });
}

async function fetchDetails(estates, maxDetails = 20) {
  const details = {};
  const toFetch = estates.slice(0, maxDetails);

  for (const e of toFetch) {
    try {
      const resp = await fetch(`${SREALITY_API}/${e.hash_id}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BydlimTuBot/1.0)",
          Accept: "application/json",
        },
      });
      if (resp.ok) {
        details[e.hash_id] = await resp.json();
      }
    } catch (err) {
      // skip
    }
    await sleep(250);
  }
  return details;
}

function extractDetail(detail) {
  const r = { size: 0, bath: 0, floor: null, floors: null, energy: null, built: null, recon: null, desc: "", amenities: [] };
  if (!detail || !detail.items) return r;

  for (const item of detail.items) {
    const name = (item.name || "").toLowerCase();
    const val = item.value;

    if ((name.includes("celková") || name.includes("užitná")) && name.includes("plocha")) {
      try { r.size = parseInt(parseFloat(String(val).replace(",", ".").replace(" ", ""))); } catch (e) {}
    } else if (name.includes("plocha") && !r.size) {
      try { r.size = parseInt(parseFloat(String(val).replace(",", ".").replace(" ", ""))); } catch (e) {}
    }
    if (name.includes("podlaží") && !name.includes("celkem") && !name.includes("počet")) {
      try { r.floor = parseInt(val); } catch (e) {}
    }
    if ((name.includes("celkem") || name.includes("počet")) && name.includes("podlaží")) {
      try { r.floors = parseInt(val); } catch (e) {}
    }
    if (name.includes("energetická") && val) r.energy = String(val).trim().toUpperCase().charAt(0);
    if (name.includes("rok") && (name.includes("kolaud") || name.includes("výstavb"))) {
      try { r.built = parseInt(val); } catch (e) {}
    }
    if (name.includes("rekonstrukce") && val) { try { r.recon = parseInt(val); } catch (e) {} }
    if (name.includes("koupeln")) { try { r.bath = parseInt(val); } catch (e) { r.bath = 1; } }
    if (item.type === "set" && Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === "object" && v.value) r.amenities.push(v.value);
        else if (typeof v === "string") r.amenities.push(v);
      }
    }
  }

  const text = detail.text;
  if (text && typeof text === "object" && text.value) {
    r.desc = text.value.replace(/<[^>]+>/g, "").substring(0, 400).replace(/\r?\n/g, " ").trim();
  } else if (detail.meta_description) {
    r.desc = detail.meta_description.substring(0, 400);
  }
  return r;
}

function toProperty(estate, detail, idx) {
  const hid = estate.hash_id;
  const cat = estate._cat;
  const tx = estate._tx;
  const slug = CAT_SLUG[cat] || cat;
  const d = detail ? extractDetail(detail) : { size: 0, bath: 0, floor: null, floors: null, energy: null, built: null, recon: null, desc: "", amenities: [] };

  const imgs = [];
  for (const img of ((estate._links || {}).images || []).slice(0, 5)) {
    let href = img.href || "";
    if (href.startsWith("//")) href = "https:" + href;
    // Remove query params
    href = href.split("?")[0];
    if (href) imgs.push(href);
  }
  if (!imgs.length) imgs.push("https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600");

  const name = estate.name || "Nemovitost";
  const locality = estate.locality || "";
  let size = d.size || 0;
  if (!size) {
    const m = name.match(/(\d+)\s*m[²2]/);
    if (m) size = parseInt(m[1]);
  }
  const rm = name.match(/(\d)\+/);
  const rooms = rm ? parseInt(rm[1]) : 0;
  const daysAgo = Math.floor(Math.random() * 22);
  const badges = estate.new || daysAgo <= 2 ? ["new"] : [];

  let amenities = d.amenities.filter((a) => a && a.length < 40).slice(0, 8);
  if (!amenities.length && estate.labels) amenities = estate.labels.filter((l) => l.length < 40).slice(0, 5);
  if (!amenities.length) amenities = ["Kontaktujte nás"];

  return {
    id: `SR-${hid}`,
    type: cat,
    tx: tx,
    title: name,
    loc: extractCity(locality),
    addr: locality || "",
    price: estate.price || 1,
    size,
    rooms,
    bath: d.bath || (rooms > 0 ? 1 : 0),
    floor: d.floor,
    floors: d.floors,
    imgs,
    badges,
    desc: d.desc || `${name}. ${locality}.`,
    amenities,
    energy: d.energy,
    avail: "Ihned",
    built: d.built,
    recon: d.recon,
    added: daysAgo,
    source: "sreality.cz",
    sourceUrl: `https://www.sreality.cz/detail/${tx}/${slug}/${hid}`,
  };
}

// In-memory cache (persists across warm Lambda invocations, ~5-15 min)
let cachedData = null;
let cachedAt = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function handler(event) {
  const now = Date.now();

  // Return cached if fresh
  if (cachedData && now - cachedAt < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "HIT",
        "X-Cache-Age": String(Math.round((now - cachedAt) / 1000)),
      },
      body: cachedData,
    };
  }

  try {
    console.log("[BydlímTu] Fetching fresh data from Sreality.cz...");
    const estates = await fetchEstates();
    console.log(`[BydlímTu] Fetched ${estates.length} estates`);

    // Fetch details for first 20
    const details = await fetchDetails(estates, 20);
    console.log(`[BydlímTu] Fetched ${Object.keys(details).length} details`);

    const properties = estates.map((e, i) => toProperty(e, details[e.hash_id] || null, i));

    const result = {
      updated: new Date().toISOString(),
      source: "sreality.cz",
      count: properties.length,
      properties,
    };

    const body = JSON.stringify(result);
    cachedData = body;
    cachedAt = now;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS",
      },
      body,
    };
  } catch (error) {
    console.error("[BydlímTu] Error:", error);
    // If we have stale cache, return it
    if (cachedData) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "STALE",
        },
        body: cachedData,
      };
    }
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch properties", message: error.message }),
    };
  }
}
