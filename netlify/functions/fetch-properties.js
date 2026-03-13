// =============================================================================
// Netlify Function: Multi-portal Czech Reality Scraper
// Stahuje reálné inzeráty z Sreality.cz + Bezrealitky.cz
// Extrahuje VŠECHNY dostupné údaje z každého inzerátu
// =============================================================================

const SREALITY_API = "https://www.sreality.cz/api/cs/v2/estates";
const BEZREALITKY_API = "https://api.bezrealitky.cz/graphql";

// ===== SREALITY MAPS =====
const TYPE_MAP = { 1: "byt", 2: "dům", 3: "pozemek", 4: "komerční" };
const TX_MAP = { 1: "prodej", 2: "pronájem" };
const CAT_SLUG = { dům: "dum", komerční: "komercni", pozemek: "pozemek", byt: "byt" };
const PER_PAGE = 60;

// Pages per category — total ~4000-5000 listings from Sreality
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

// ===== SREALITY URL BUILDER =====
const SUB_CB_MAP = {
  "1_2": "1+kk", "1_3": "1+1", "1_4": "2+kk", "1_5": "2+1",
  "1_6": "3+kk", "1_7": "3+1", "1_8": "4+kk", "1_9": "4+1",
  "1_10": "5+kk", "1_11": "5+1", "1_12": "6-a-vice", "1_16": "atypicky",
  "2_37": "rodinny", "2_39": "vila", "2_43": "chalupa", "2_33": "chata",
  "2_35": "pamatka-jine", "2_40": "zemedelska-usedlost",
  "3_19": "bydleni", "3_18": "komercni", "3_20": "pole", "3_22": "les",
  "3_21": "louka", "3_46": "zahrada", "3_48": "ostatni",
  "4_23": "kancelare", "4_24": "sklady", "4_25": "vyrobni-prostory",
  "4_26": "obchodni-prostory", "4_27": "ubytovani", "4_28": "restaurace",
  "4_29": "zemedelsky", "4_31": "cinzovni-dum", "4_38": "virtualni-kancelar",
};

function buildSrealityUrl(estate, tx, catSlug, hid) {
  const seo = estate.seo || {};
  const mainCb = seo.category_main_cb || estate.category;
  const subCb = seo.category_sub_cb;
  const locality = seo.locality || "";
  let subSlug = SUB_CB_MAP[`${mainCb}_${subCb}`] || "";
  if (!subSlug) {
    const name = estate.name || "";
    const m = name.match(/(\d\+(?:kk|\d))/i);
    if (m) subSlug = m[1].toLowerCase();
    else subSlug = "ostatni";
  }
  const txSlug = tx === "pronájem" ? "pronajem" : "prodej";
  return `https://www.sreality.cz/detail/${txSlug}/${catSlug}/${subSlug}/${locality}${hid}`;
}

// ===== SREALITY DETAIL FETCHER (for individual properties) =====
async function fetchSrealityDetail(hashId) {
  const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Extract detailed attributes from Sreality detail API response
function extractDetailAttributes(detail) {
  if (!detail || !detail.items) return {};
  const attrs = {};

  for (const item of detail.items) {
    const name = (item.name || "").toLowerCase();
    const val = item.value;

    // Description / note
    if (name === "popis" || name === "description" || name === "poznamka" || name === "note") {
      if (typeof val === "string" && val.length > 10) {
        attrs.description = val;
      }
    }
    // Usable area
    if (name.includes("užitná") || name.includes("uzitna") || name === "usable_area") {
      attrs.usableArea = parseNum(val);
    }
    // Floor area
    if (name.includes("podlahová") || name.includes("podlahova") || name === "floor_area") {
      attrs.floorArea = parseNum(val);
    }
    // Total area
    if (name.includes("celková") || name.includes("celkova") || name === "estate_area") {
      attrs.totalArea = parseNum(val);
    }
    // Floor
    if ((name === "podlaží" || name === "podlazi" || name === "floor") && !name.includes("plocha")) {
      attrs.floor = parseNum(val);
    }
    // Total floors
    if (name.includes("počet podlaží") || name.includes("pocet podlazi") || name === "building_floors") {
      attrs.floors = parseNum(val);
    }
    // Energy class (PENB)
    if (name.includes("penb") || name.includes("energetická") || name.includes("energeticka") || name === "energy_efficiency_rating") {
      const ec = String(val).trim().toUpperCase();
      if (/^[A-G]$/.test(ec)) attrs.energy = ec;
      else if (ec.includes("A")) attrs.energy = "A";
      else if (ec.includes("B")) attrs.energy = "B";
      else if (ec.includes("C")) attrs.energy = "C";
      else if (ec.includes("D")) attrs.energy = "D";
    }
    // Year built
    if (name.includes("rok výstavby") || name.includes("rok vystavby") || name.includes("rok kolaudac") || name === "building_year") {
      attrs.built = parseNum(val);
    }
    // Reconstruction year
    if (name.includes("rekonstrukce") || name === "reconstruction_year") {
      attrs.recon = parseNum(val);
    }
    // Material (construction type)
    if (name.includes("stavba") || name.includes("konstrukce") || name === "building_type" || name === "material") {
      attrs.material = String(val).trim();
    }
    // Ownership
    if (name.includes("vlastnictví") || name.includes("vlastnictvi") || name === "ownership") {
      attrs.ownership = String(val).trim();
    }
    // Condition/state
    if (name.includes("stav objektu") || name.includes("stav nemovitosti") || name === "object_type") {
      attrs.condition = String(val).trim();
    }
    // Furnishing
    if (name.includes("vybavení") || name.includes("vybaveni") || name === "furnished") {
      attrs.furnished = String(val).trim();
    }
    // Parking
    if (name.includes("parkování") || name.includes("parkovani") || name === "parking") {
      attrs.parking = String(val).trim();
    }
    // Elevator
    if (name.includes("výtah") || name.includes("vytah") || name === "elevator") {
      attrs.elevator = typeof val === "boolean" ? val : String(val).toLowerCase().includes("ano");
    }
    // Balcony
    if (name.includes("balkón") || name.includes("balkon") || name === "balcony") {
      attrs.balcony = typeof val === "boolean" ? val : String(val).toLowerCase().includes("ano");
    }
    // Terrace
    if (name.includes("terasa") || name === "terrace") {
      attrs.terrace = typeof val === "boolean" ? val : String(val).toLowerCase().includes("ano");
    }
    // Cellar
    if (name.includes("sklep") || name === "cellar") {
      attrs.cellar = typeof val === "boolean" ? val : String(val).toLowerCase().includes("ano");
    }
    // Garden
    if (name.includes("zahrada") || name === "garden") {
      attrs.garden = String(val).trim();
    }
    // Garage
    if (name.includes("garáž") || name.includes("garaz") || name === "garage") {
      attrs.garage = typeof val === "boolean" ? val : String(val).toLowerCase().includes("ano");
    }
    // Heating
    if (name.includes("topení") || name.includes("topeni") || name.includes("vytápění") || name === "heating") {
      attrs.heating = String(val).trim();
    }
    // Electricity
    if (name.includes("elektřina") || name.includes("elektrina") || name === "electricity") {
      attrs.electricity = String(val).trim();
    }
    // Water
    if (name.includes("vodovod") || name.includes("voda") || name === "water") {
      attrs.water = String(val).trim();
    }
    // Gas
    if (name.includes("plyn") || name === "gas") {
      attrs.gas = String(val).trim();
    }
    // Sewage
    if (name.includes("odpad") || name.includes("kanalizace") || name === "waste") {
      attrs.sewage = String(val).trim();
    }
    // Telco
    if (name.includes("telekomunikace") || name.includes("internet") || name === "telecomunication") {
      attrs.telecom = String(val).trim();
    }
    // Transport
    if (name.includes("doprava") || name.includes("komunikace") || name === "road") {
      attrs.transport = String(val).trim();
    }
    // Available from
    if (name.includes("datum nastěhování") || name.includes("datum nasazeni") || name.includes("volné od") || name === "available_from") {
      attrs.availableFrom = String(val).trim();
    }
    // Bathrooms
    if (name.includes("koupelna") || name.includes("koupelen") || name === "bathroom") {
      attrs.bathrooms = parseNum(val) || 1;
    }
    // WC
    if (name === "wc" || name.includes("záchod")) {
      attrs.wc = parseNum(val) || 1;
    }
    // Rooms
    if (name === "počet pokojů" || name.includes("pocet pokoju") || name === "rooms_count") {
      attrs.roomsCount = parseNum(val);
    }
    // GPS
    if (name === "lat" || name === "latitude") attrs.lat = parseFloat(val) || null;
    if (name === "lon" || name === "lng" || name === "longitude") attrs.lng = parseFloat(val) || null;
  }

  // Description from text_data
  if (!attrs.description && detail.text) {
    if (detail.text.value) attrs.description = detail.text.value;
  }

  // GPS from map
  if (!attrs.lat && detail.map && detail.map.lat) {
    attrs.lat = detail.map.lat;
    attrs.lng = detail.map.lon;
  }

  return attrs;
}

function parseNum(val) {
  if (typeof val === "number") return val;
  const n = parseInt(String(val).replace(/\s/g, ""));
  return isNaN(n) ? null : n;
}

// ===== PARALLEL BATCH FETCHER (SREALITY) =====
async function fetchPage(cm, ct, page) {
  const url = `${SREALITY_API}?category_main_cb=${cm}&category_type_cb=${ct}&per_page=${PER_PAGE}&page=${page}&tms=${Date.now()}`;
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
  } catch {
    return [];
  }
}

async function fetchAllSrealityEstates() {
  const requests = [];
  for (const cat of CATEGORIES) {
    const key = `${cat.cm}_${cat.ct}`;
    const maxPages = CATEGORY_PAGES[key] || 3;
    for (let page = 1; page <= maxPages; page++) {
      requests.push({ cm: cat.cm, ct: cat.ct, page, label: cat.label });
    }
  }
  console.log(`[BydlímTu] Fetching ${requests.length} pages from Sreality.cz...`);

  const BATCH_SIZE = 6;
  const allEstates = [];
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((r) => fetchPage(r.cm, r.ct, r.page)));
    for (const estates of results) allEstates.push(...estates);
    if (i + BATCH_SIZE < requests.length) await new Promise((r) => setTimeout(r, 200));
  }

  const seen = new Set();
  return allEstates.filter((e) => {
    if (seen.has(e.hash_id)) return false;
    seen.add(e.hash_id);
    return true;
  });
}

// ===== TRANSFORM SREALITY =====
function toSrealityProperty(estate) {
  const hid = estate.hash_id;
  const cat = estate._cat;
  const tx = estate._tx;
  const slug = CAT_SLUG[cat] || cat;

  // Images — full array, upgraded resolution, proxy
  const imgs = [];
  const imgSources = (estate._links || {}).images || [];
  for (const img of imgSources.slice(0, 12)) {
    let href = img.href || "";
    if (href.startsWith("//")) href = "https:" + href;
    href = href.replace(/fl=res,\d+,\d+,/, "fl=res,800,600,");
    if (href && href.startsWith("http")) {
      imgs.push(`/api/img?url=${encodeURIComponent(href)}`);
    }
  }
  if (!imgs.length) imgs.push("https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600");

  const name = estate.name || "Nemovitost";
  const locality = estate.locality || "";

  // Extract size from name
  let size = 0;
  const sizeMatch = name.match(/(\d+)\s*m[²2]/);
  if (sizeMatch) size = parseInt(sizeMatch[1]);

  // Extract rooms from name
  let rooms = 0;
  const rmMatch = name.match(/(\d)\+(?:kk|\d)/i);
  if (rmMatch) rooms = parseInt(rmMatch[1]);

  // Extract disposition from name (e.g. "3+kk", "2+1")
  let disposition = "";
  const dispMatch = name.match(/(\d\+(?:kk|\d))/i);
  if (dispMatch) disposition = dispMatch[1];

  // Labels as amenities + features
  let amenities = [];
  if (estate.labelsAll && Array.isArray(estate.labelsAll)) {
    amenities = estate.labelsAll.filter((l) => typeof l === "string" && l.length < 50).slice(0, 10);
  }
  if (!amenities.length && estate.labels && Array.isArray(estate.labels)) {
    amenities = estate.labels.filter((l) => typeof l === "string" && l.length < 50).slice(0, 10);
  }

  // Check labels for useful info
  const allLabels = (estate.labelsAll || estate.labels || []).map(l => typeof l === "string" ? l.toLowerCase() : "");
  const hasElevator = allLabels.some(l => l.includes("výtah"));
  const hasBalcony = allLabels.some(l => l.includes("balkón") || l.includes("balkon"));
  const hasTerrace = allLabels.some(l => l.includes("terasa"));
  const hasGarage = allLabels.some(l => l.includes("garáž") || l.includes("garážov"));
  const hasParking = allLabels.some(l => l.includes("parkování") || l.includes("parkovací"));
  const hasCellar = allLabels.some(l => l.includes("sklep"));
  const hasGarden = allLabels.some(l => l.includes("zahrada"));
  const isNew = estate.new || allLabels.some(l => l.includes("novostavba"));
  const hasLoweredPrice = allLabels.some(l => l.includes("zlevněno") || l.includes("sleva"));

  // Price info
  const price = estate.price || 1;
  const priceNote = estate.price_czk && estate.price_czk.name ? estate.price_czk.name : null;

  // Badges — based on real data
  const badges = [];
  if (isNew) badges.push("new");
  if (hasLoweredPrice) badges.push("price");

  // SEO data for additional info
  const seo = estate.seo || {};

  // GPS from the list endpoint (if available)
  const gps = estate.gps || {};

  return {
    id: `SR-${hid}`,
    hashId: hid,
    type: cat,
    tx,
    disposition,
    title: name,
    loc: extractCity(locality),
    addr: locality,
    price,
    priceNote,
    size,
    rooms,
    bath: null,  // will be populated from detail
    floor: null, // will be populated from detail
    floors: null,
    imgs,
    badges,
    desc: null, // will be populated from detail — no more fake desc
    amenities: amenities.length ? amenities : [],
    energy: null,    // from detail
    avail: null,     // from detail
    built: null,     // from detail
    recon: null,     // from detail
    material: null,  // from detail
    ownership: null, // from detail
    condition: null, // from detail
    furnished: null, // from detail
    elevator: hasElevator || null,
    balcony: hasBalcony || null,
    terrace: hasTerrace || null,
    cellar: hasCellar || null,
    garage: hasGarage || null,
    parking: hasParking || null,
    garden: hasGarden || null,
    heating: null,   // from detail
    gps: gps.lat ? { lat: gps.lat, lng: gps.lon } : null,
    source: "sreality.cz",
    sourceUrl: buildSrealityUrl(estate, tx, slug, hid),
    added: null, // we don't know the real date from list API
  };
}

// ===== BEZREALITKY SCRAPER =====
async function fetchBezrealitky() {
  const query = `
    query AdvertList($input: AdvertListInput!) {
      listAdverts(input: $input) {
        list {
          id
          uri
          type
          offerType
          mainCategory
          subCategory
          address
          gps { lat lng }
          mainImage { url }
          images { url }
          price
          priceOriginal
          currency
          surface
          surfaceLand
          disposition
          ownership
          status
          energy
          floor
          floorNumber
          building
          equipped
          parking
          balcony
          terrace
          cellar
          elevator
          garage
          garden
          loggia
          description
          note
          createdAt
          updatedAt
          rooms
          bathrooms
          wc
          heating
          yearBuilt
          yearReconstruction
          availableFrom
        }
        totalCount
      }
    }
  `;

  const allProperties = [];
  const offerTypes = ["PRODEJ", "PRONAJEM"];
  const categories = ["BYT", "DUM", "POZEMEK", "KOMERCNI"];

  for (const offer of offerTypes) {
    for (const cat of categories) {
      try {
        const resp = await fetch(BEZREALITKY_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            query,
            variables: {
              input: {
                offerType: offer,
                mainCategory: cat,
                page: 1,
                limit: 50,
                order: "TIME_ORDER_DESC",
                regionOsmIds: [],
              }
            }
          }),
        });

        if (!resp.ok) continue;
        const data = await resp.json();
        const adverts = data?.data?.listAdverts?.list || [];

        for (const ad of adverts) {
          const p = toBezrealitkyProperty(ad, offer, cat);
          if (p) allProperties.push(p);
        }

        // Delay between requests
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.log(`[BydlímTu] Bezrealitky ${offer}/${cat} failed:`, err.message);
      }
    }
  }

  console.log(`[BydlímTu] Fetched ${allProperties.length} from Bezrealitky.cz`);
  return allProperties;
}

function toBezrealitkyProperty(ad, offerType, mainCat) {
  if (!ad || !ad.id) return null;

  const typeMap = { BYT: "byt", DUM: "dům", POZEMEK: "pozemek", KOMERCNI: "komerční" };
  const txMap = { PRODEJ: "prodej", PRONAJEM: "pronájem" };

  const type = typeMap[mainCat] || "byt";
  const tx = txMap[offerType] || "prodej";

  // Images
  const imgs = [];
  if (ad.images && ad.images.length) {
    for (const img of ad.images.slice(0, 12)) {
      if (img.url) imgs.push(img.url);
    }
  } else if (ad.mainImage && ad.mainImage.url) {
    imgs.push(ad.mainImage.url);
  }
  if (!imgs.length) imgs.push("https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600");

  // Disposition / rooms
  const disposition = ad.disposition || "";
  let rooms = ad.rooms || 0;
  if (!rooms && disposition) {
    const m = disposition.match(/(\d)/);
    if (m) rooms = parseInt(m[1]);
  }

  // Size
  const size = ad.surface || ad.surfaceLand || 0;

  // Address / locality
  const addr = ad.address || "";
  const loc = extractCity(addr);

  // Badges
  const badges = [];
  const created = ad.createdAt ? new Date(ad.createdAt) : null;
  if (created && (Date.now() - created.getTime()) < 7 * 24 * 60 * 60 * 1000) badges.push("new");
  if (ad.priceOriginal && ad.price < ad.priceOriginal) badges.push("price");

  // Days since added
  let added = null;
  if (created) {
    added = Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000));
  }

  // Energy class
  let energy = null;
  if (ad.energy) {
    const ec = String(ad.energy).toUpperCase().replace(/[^A-G]/g, "");
    if (ec.length === 1) energy = ec;
  }

  return {
    id: `BR-${ad.id}`,
    hashId: ad.id,
    type,
    tx,
    disposition: disposition || null,
    title: buildBezrealitkyTitle(type, disposition, size, addr),
    loc,
    addr,
    price: ad.price || 1,
    priceNote: null,
    size,
    rooms,
    bath: ad.bathrooms || null,
    floor: ad.floor || null,
    floors: ad.floorNumber || null,
    imgs,
    badges,
    desc: ad.description || ad.note || null,
    amenities: buildBezrealitkyAmenities(ad),
    energy,
    avail: ad.availableFrom || null,
    built: ad.yearBuilt || null,
    recon: ad.yearReconstruction || null,
    material: ad.building || null,
    ownership: ad.ownership || null,
    condition: ad.status || null,
    furnished: ad.equipped || null,
    elevator: ad.elevator || null,
    balcony: ad.balcony || null,
    terrace: ad.terrace || null,
    cellar: ad.cellar || null,
    garage: ad.garage || null,
    parking: ad.parking || null,
    garden: ad.garden || null,
    heating: ad.heating || null,
    gps: ad.gps ? { lat: ad.gps.lat, lng: ad.gps.lng } : null,
    source: "bezrealitky.cz",
    sourceUrl: ad.uri ? `https://www.bezrealitky.cz${ad.uri}` : `https://www.bezrealitky.cz/nemovitosti-byty-domy/${ad.id}`,
    added,
  };
}

function buildBezrealitkyTitle(type, disposition, size, addr) {
  const parts = [];
  const typeName = { byt: "Byt", dům: "Dům", pozemek: "Pozemek", komerční: "Komerční prostor" };
  parts.push(typeName[type] || "Nemovitost");
  if (disposition) parts.push(disposition);
  if (size) parts.push(`${size} m²`);
  const loc = addr.split(",")[0];
  if (loc) parts.push(loc);
  return parts.join(", ");
}

function buildBezrealitkyAmenities(ad) {
  const amenities = [];
  if (ad.elevator) amenities.push("Výtah");
  if (ad.balcony) amenities.push("Balkón");
  if (ad.terrace) amenities.push("Terasa");
  if (ad.cellar) amenities.push("Sklep");
  if (ad.garage) amenities.push("Garáž");
  if (ad.garden) amenities.push("Zahrada");
  if (ad.parking) amenities.push("Parkování");
  if (ad.loggia) amenities.push("Lodžie");
  if (ad.equipped) amenities.push(ad.equipped === "FULLY" ? "Plně vybavený" : ad.equipped === "PARTIALLY" ? "Částečně vybavený" : "Nevybavený");
  if (ad.heating) amenities.push(`Topení: ${ad.heating}`);
  if (ad.ownership) amenities.push(`Vlastnictví: ${ad.ownership}`);
  if (ad.building) amenities.push(`Stavba: ${ad.building}`);
  return amenities;
}

// ===== COMBINED CACHE =====
let cachedResult = null;
let cachedAt = 0;
const CACHE_TTL = 45 * 60 * 1000;

// Detail cache — small LRU for on-demand fetches
const detailCache = new Map();
const DETAIL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ===== MAIN HANDLER =====
export async function handler(event) {
  const now = Date.now();
  const params = event.queryStringParameters || {};

  // === ON-DEMAND DETAIL FETCH ===
  // If ?detail=SR-12345 is passed, fetch full detail for that property
  if (params.detail) {
    return await handleDetailRequest(params.detail);
  }

  // === SERVER-SIDE FILTERING ===
  const filterType = params.type || null;
  const filterTx = params.tx || null;
  const filterCity = params.city || null;
  const priceMin = params.priceMin ? parseInt(params.priceMin) : null;
  const priceMax = params.priceMax ? parseInt(params.priceMax) : null;
  const sizeMin = params.sizeMin ? parseInt(params.sizeMin) : null;
  const filterRooms = params.rooms ? parseInt(params.rooms) : null;
  const filterSource = params.source || null; // "sreality", "bezrealitky"
  const page = Math.max(1, parseInt(params.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 60));

  // Check cache
  let allProperties;
  if (cachedResult && now - cachedAt < CACHE_TTL) {
    allProperties = cachedResult;
    console.log(`[BydlímTu] Cache HIT: ${allProperties.length} properties`);
  } else {
    try {
      console.log("[BydlímTu] Cache MISS, fetching from all portals...");

      // Fetch Sreality + Bezrealitky in parallel
      const [srealityEstates, bezrealitkyProperties] = await Promise.all([
        fetchAllSrealityEstates(),
        fetchBezrealitky().catch(err => {
          console.log("[BydlímTu] Bezrealitky fetch failed:", err.message);
          return [];
        }),
      ]);

      console.log(`[BydlímTu] Sreality: ${srealityEstates.length} raw estates`);
      const srealityProperties = srealityEstates.map(toSrealityProperty);

      // Combine and deduplicate (by address similarity)
      allProperties = [...srealityProperties, ...bezrealitkyProperties];

      cachedResult = allProperties;
      cachedAt = now;
      console.log(`[BydlímTu] Total: ${allProperties.length} properties (Sreality: ${srealityProperties.length}, Bezrealitky: ${bezrealitkyProperties.length})`);
    } catch (error) {
      console.error("[BydlímTu] Fetch error:", error);
      if (cachedResult) {
        allProperties = cachedResult;
      } else {
        return {
          statusCode: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Portals temporarily unavailable" }),
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
  if (filterSource) {
    if (filterSource === "sreality") filtered = filtered.filter(p => p.source === "sreality.cz");
    else if (filterSource === "bezrealitky") filtered = filtered.filter(p => p.source === "bezrealitky.cz");
  }

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

  // Source stats
  const sourceStats = {};
  for (const p of allProperties) {
    sourceStats[p.source] = (sourceStats[p.source] || 0) + 1;
  }

  const result = {
    updated: new Date(cachedAt || now).toISOString(),
    sources: Object.keys(sourceStats),
    sourceStats,
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
      "X-Sources": Object.keys(sourceStats).join(","),
    },
    body: JSON.stringify(result),
  };
}

// ===== DETAIL ENDPOINT =====
// Fetches full detail for a single property on-demand
async function handleDetailRequest(propertyId) {
  // Check detail cache
  if (detailCache.has(propertyId)) {
    const cached = detailCache.get(propertyId);
    if (Date.now() - cached.at < DETAIL_CACHE_TTL) {
      return jsonResponse(cached.data);
    }
    detailCache.delete(propertyId);
  }

  // Sreality detail
  if (propertyId.startsWith("SR-")) {
    const hashId = propertyId.replace("SR-", "");
    const detail = await fetchSrealityDetail(hashId);
    if (!detail) {
      return jsonResponse({ error: "Detail not found" }, 404);
    }

    const attrs = extractDetailAttributes(detail);

    // Also get all images from detail (higher resolution)
    const detailImgs = [];
    if (detail._links && detail._links.images) {
      for (const img of detail._links.images.slice(0, 20)) {
        let href = img.href || "";
        if (href.startsWith("//")) href = "https:" + href;
        // Use 1280x960 for detail view
        href = href.replace(/fl=res,\d+,\d+,/, "fl=res,1280,960,");
        if (href && href.startsWith("http")) {
          detailImgs.push(`/api/img?url=${encodeURIComponent(href)}`);
        }
      }
    }

    const result = {
      id: propertyId,
      ...attrs,
      imgs: detailImgs.length ? detailImgs : undefined,
      name: detail.name?.value || detail.name || null,
      locality: detail.locality?.value || detail.locality || null,
      price: detail.price_czk?.value_raw || null,
      priceNote: detail.price_czk?.name || null,
    };

    // Cache result
    detailCache.set(propertyId, { data: result, at: Date.now() });

    // Cleanup old cache entries
    if (detailCache.size > 100) {
      const oldest = [...detailCache.entries()].sort((a, b) => a[1].at - b[1].at);
      for (let i = 0; i < 50; i++) detailCache.delete(oldest[i][0]);
    }

    return jsonResponse(result);
  }

  // Bezrealitky — details are already in the list data, but we could fetch more if needed
  if (propertyId.startsWith("BR-")) {
    // For Bezrealitky, the list endpoint already returns full data
    // Just return the cached property data
    if (cachedResult) {
      const prop = cachedResult.find(p => p.id === propertyId);
      if (prop) return jsonResponse(prop);
    }
    return jsonResponse({ error: "Detail not found" }, 404);
  }

  return jsonResponse({ error: "Unknown property source" }, 400);
}

function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "public, max-age=3600" : "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data),
  };
}
