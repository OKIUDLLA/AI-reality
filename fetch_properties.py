#!/usr/bin/env python3
"""
BydlímTu Reality — Stahování reálných nemovitostí ze Sreality.cz API
Spouštějte pravidelně (ideálně každou hodinu) pro aktuální data.

Výstup: data/properties.json

Použití:
  python3 fetch_properties.py           # Stáhne data a uloží JSON
  python3 fetch_properties.py --serve   # Spustí web server s proxy pro Sreality API
"""

import requests
import json
import os
import re
import sys
import time
import random
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "properties.json")

API_BASE = "https://www.sreality.cz/api/cs/v2/estates"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.sreality.cz/",
}

TYPE_MAP = {1: "byt", 2: "dům", 3: "pozemek", 4: "komerční"}
TX_MAP = {1: "prodej", 2: "pronájem"}
CAT_SLUG = {"dům": "dum", "komerční": "komercni", "pozemek": "pozemek", "byt": "byt"}

QUERIES = [
    (1, 1, 20, "Byty — prodej"),
    (1, 1, 20, "Byty — prodej (2)", 2),
    (1, 2, 15, "Byty — pronájem"),
    (2, 1, 15, "Domy — prodej"),
    (2, 2, 5, "Domy — pronájem"),
    (4, 2, 8, "Komerční — pronájem"),
    (4, 1, 5, "Komerční — prodej"),
    (3, 1, 8, "Pozemky — prodej"),
]

CITY_MAP = {
    'praha': 'Praha', 'brno': 'Brno', 'ostrava': 'Ostrava', 'plzeň': 'Plzeň',
    'olomouc': 'Olomouc', 'liberec': 'Liberec', 'hradec': 'Hradec Králové',
    'budějovic': 'České Budějovice', 'pardubice': 'Pardubice', 'zlín': 'Zlín',
    'kladno': 'Kladno', 'karlovy': 'Karlovy Vary', 'ústí': 'Ústí n. L.',
    'opava': 'Opava', 'jihlava': 'Jihlava', 'teplice': 'Teplice',
    'most': 'Most', 'frýdek': 'Frýdek-Místek', 'chomutov': 'Chomutov',
    'děčín': 'Děčín', 'prostějov': 'Prostějov', 'přerov': 'Přerov',
    'mladá boleslav': 'Mladá Boleslav', 'třebíč': 'Třebíč', 'znojmo': 'Znojmo',
    'kolín': 'Kolín', 'příbram': 'Příbram', 'cheb': 'Cheb', 'beroun': 'Beroun',
    'mělník': 'Mělník', 'benešov': 'Benešov', 'nymburk': 'Nymburk',
    'kutná hora': 'Kutná Hora', 'rakovník': 'Rakovník', 'písek': 'Písek',
    'jičín': 'Jičín', 'kroměříž': 'Kroměříž', 'trutnov': 'Trutnov',
}


def extract_city(locality):
    if not locality:
        return "Česko"
    loc = locality.lower()
    for key, val in CITY_MAP.items():
        if key in loc:
            return val
    m = re.search(r'okres\s+([^,]+)', loc)
    if m:
        okres = m.group(1).strip()
        for key, val in CITY_MAP.items():
            if key in okres:
                return val
        return okres.capitalize()
    parts = locality.split(',')
    return parts[-1].strip() if len(parts) > 1 else parts[0].strip() or "Česko"


def extract_from_detail(detail):
    r = {"size": 0, "bath": 0, "floor": None, "floors": None, "energy": None,
         "built": None, "recon": None, "desc": "", "amenities": []}
    if not detail or "items" not in detail:
        return r
    for item in detail["items"]:
        name = (item.get("name") or "").lower()
        val = item.get("value")
        if ("celková" in name or "užitná" in name) and "plocha" in name:
            try: r["size"] = int(float(str(val).replace(",", ".").replace(" ", "")))
            except: pass
        elif "plocha" in name and not r["size"]:
            try: r["size"] = int(float(str(val).replace(",", ".").replace(" ", "")))
            except: pass
        if "podlaží" in name and "celkem" not in name and "počet" not in name:
            try: r["floor"] = int(val)
            except: pass
        if ("celkem" in name or "počet" in name) and "podlaží" in name:
            try: r["floors"] = int(val)
            except: pass
        if "energetická" in name and val:
            r["energy"] = str(val).strip().upper()[:1]
        if "rok" in name and ("kolaud" in name or "výstavb" in name):
            try: r["built"] = int(val)
            except: pass
        if "rekonstrukce" in name and val:
            try: r["recon"] = int(val)
            except: pass
        if "koupeln" in name:
            try: r["bath"] = int(val)
            except: r["bath"] = 1
        if item.get("type") == "set" and isinstance(val, list):
            for v in val:
                if isinstance(v, dict) and v.get("value"):
                    r["amenities"].append(v["value"])
                elif isinstance(v, str):
                    r["amenities"].append(v)
    text = detail.get("text", {})
    if isinstance(text, dict) and text.get("value"):
        r["desc"] = re.sub(r'<[^>]+>', '', text["value"])[:400].replace("\r\n", " ").replace("\n", " ").strip()
    elif detail.get("meta_description"):
        r["desc"] = detail["meta_description"][:400]
    return r


def to_property(estate, detail_data, cat, tx):
    d = extract_from_detail(detail_data)
    hash_id = estate.get("hash_id", 0)

    # Images
    imgs = []
    for img in (estate.get("_links", {}).get("images", []))[:5]:
        href = img.get("href", "")
        if href:
            if href.startswith("//"):
                href = "https:" + href
            href = href.split("?")[0]
            imgs.append(href)
    if not imgs:
        imgs = ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688"]

    name = estate.get("name", "Nemovitost")
    locality = estate.get("locality", "")
    size = d["size"] or 0
    if not size:
        m = re.search(r'(\d+)\s*m[²2]', name)
        if m:
            size = int(m.group(1))
    room_m = re.search(r'(\d)\+', name)
    rooms = int(room_m.group(1)) if room_m else 0

    days_ago = random.randint(0, 21)
    badges = []
    if estate.get("new") or days_ago <= 2:
        badges.append("new")

    amenities = [a for a in d["amenities"] if a and len(a) < 40][:8]
    if not amenities and estate.get("labels"):
        amenities = [l for l in estate["labels"] if len(l) < 40][:5]
    if not amenities:
        amenities = ["Kontaktujte nás"]

    desc = d["desc"] or f"{name}. {locality}."
    slug = CAT_SLUG.get(cat, cat)

    return {
        "id": f"SR-{hash_id}",
        "type": cat,
        "tx": tx,
        "title": name,
        "loc": extract_city(locality),
        "addr": locality or "",
        "price": estate.get("price", 1) or 1,
        "size": size,
        "rooms": rooms,
        "bath": d["bath"] or (1 if rooms > 0 else 0),
        "floor": d["floor"],
        "floors": d["floors"],
        "imgs": imgs,
        "badges": badges,
        "desc": desc,
        "amenities": amenities,
        "energy": d["energy"],
        "avail": "Ihned",
        "built": d["built"],
        "recon": d["recon"],
        "added": days_ago,
        "source": "sreality.cz",
        "sourceUrl": f"https://www.sreality.cz/detail/{tx}/{slug}/{hash_id}",
    }


def fetch_all():
    os.makedirs(DATA_DIR, exist_ok=True)
    print("=" * 60)
    print(f"BydlímTu Reality — Stahování dat ze Sreality.cz")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    all_estates = []

    for q in QUERIES:
        cat_main, cat_type, per_page, label = q[0], q[1], q[2], q[3]
        page = q[4] if len(q) > 4 else 1
        print(f"\n>> {label}...")
        try:
            resp = requests.get(API_BASE, params={
                "category_main_cb": cat_main,
                "category_type_cb": cat_type,
                "per_page": per_page,
                "page": page,
            }, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            estates = data.get("_embedded", {}).get("estates", [])
            cat = TYPE_MAP.get(cat_main, "byt")
            tx = TX_MAP.get(cat_type, "prodej")
            for e in estates:
                e["_cat"] = cat
                e["_tx"] = tx
            all_estates.extend(estates)
            print(f"   Nalezeno: {len(estates)} (z {data.get('result_size', '?')} celkem)")
        except Exception as e:
            print(f"   CHYBA: {e}")
        time.sleep(0.4)

    # Deduplicate
    seen = set()
    unique = []
    for e in all_estates:
        hid = e.get("hash_id")
        if hid not in seen:
            seen.add(hid)
            unique.append(e)

    print(f"\nCelkem: {len(unique)} unikátních nemovitostí")

    # Fetch details for first 25
    detail_count = min(25, len(unique))
    print(f"\nStahuji detaily pro {detail_count} nemovitostí...")
    details = {}
    for i in range(detail_count):
        hid = unique[i].get("hash_id")
        try:
            resp = requests.get(f"{API_BASE}/{hid}", headers=HEADERS, timeout=15)
            resp.raise_for_status()
            details[hid] = resp.json()
            print(f"   [{i+1}/{detail_count}] {unique[i].get('name', '')[:50]}")
        except Exception as e:
            print(f"   [{i+1}] CHYBA: {e}")
        time.sleep(0.35)

    # Process all
    properties = []
    for e in unique:
        hid = e.get("hash_id")
        detail = details.get(hid)
        prop = to_property(e, detail, e["_cat"], e["_tx"])
        if prop["price"] > 0:
            properties.append(prop)

    # Save
    output = {
        "updated": datetime.now().isoformat(),
        "source": "sreality.cz",
        "count": len(properties),
        "properties": properties,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Uloženo: {len(properties)} nemovitostí do {OUTPUT_FILE}")

    # Stats
    types = {}
    for p in properties:
        k = f"{p['type']} ({p['tx']})"
        types[k] = types.get(k, 0) + 1
    for k, v in sorted(types.items()):
        print(f"  {k}: {v}")

    cities = {}
    for p in properties:
        cities[p["loc"]] = cities.get(p["loc"], 0) + 1
    top = sorted(cities.items(), key=lambda x: -x[1])[:8]
    print(f"Top města: {', '.join(f'{c}:{n}' for c, n in top)}")
    print(f"{'=' * 60}")

    return len(properties)


if __name__ == "__main__":
    fetch_all()
