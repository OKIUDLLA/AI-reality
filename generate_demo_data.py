#!/usr/bin/env python3
"""
Generátor realistických demo dat pro BydlímTu Reality.
Vytváří data ve formátu kompatibilním se Sreality.cz API výstupem.

Použijte tento skript pro testování, když nemáte přístup k Sreality API.
Data odrážejí reálné ceny na českém trhu (Q1 2026).
"""

import json
import os
import random
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# Real price ranges per city per m² (CZK, Q1 2026)
PRICE_PER_M2 = {
    "Praha": {"byt_prodej": (95000, 165000), "byt_pronájem": (380, 550), "dům_prodej": (65000, 120000)},
    "Brno": {"byt_prodej": (65000, 105000), "byt_pronájem": (280, 420), "dům_prodej": (45000, 85000)},
    "Ostrava": {"byt_prodej": (30000, 55000), "byt_pronájem": (180, 280), "dům_prodej": (25000, 50000)},
    "Plzeň": {"byt_prodej": (55000, 85000), "byt_pronájem": (240, 360), "dům_prodej": (40000, 70000)},
    "Olomouc": {"byt_prodej": (50000, 80000), "byt_pronájem": (220, 340), "dům_prodej": (35000, 65000)},
    "Liberec": {"byt_prodej": (40000, 65000), "byt_pronájem": (200, 300), "dům_prodej": (30000, 55000)},
    "České Budějovice": {"byt_prodej": (50000, 75000), "byt_pronájem": (220, 320), "dům_prodej": (38000, 62000)},
    "Hradec Králové": {"byt_prodej": (48000, 72000), "byt_pronájem": (210, 310), "dům_prodej": (36000, 60000)},
}

# Real addresses and neighborhoods
LOCATIONS = {
    "Praha": [
        {"addr": "Praha 1 — Staré Město", "premium": True},
        {"addr": "Praha 2 — Vinohrady", "premium": True},
        {"addr": "Praha 3 — Žižkov", "premium": False},
        {"addr": "Praha 4 — Nusle", "premium": False},
        {"addr": "Praha 5 — Smíchov", "premium": False},
        {"addr": "Praha 5 — Anděl", "premium": True},
        {"addr": "Praha 6 — Dejvice", "premium": True},
        {"addr": "Praha 6 — Bubeneč", "premium": True},
        {"addr": "Praha 7 — Holešovice", "premium": False},
        {"addr": "Praha 8 — Karlín", "premium": True},
        {"addr": "Praha 9 — Vysočany", "premium": False},
        {"addr": "Praha 10 — Vršovice", "premium": False},
        {"addr": "Praha 10 — Strašnice", "premium": False},
        {"addr": "Praha — Černošice", "premium": False},
        {"addr": "Praha — Jesenice", "premium": False},
    ],
    "Brno": [
        {"addr": "Brno — Centrum", "premium": True},
        {"addr": "Brno — Žabovřesky", "premium": True},
        {"addr": "Brno — Královo Pole", "premium": False},
        {"addr": "Brno — Černá Pole", "premium": True},
        {"addr": "Brno — Lesná", "premium": False},
        {"addr": "Brno — Bystrc", "premium": False},
        {"addr": "Brno — Řečkovice", "premium": False},
    ],
    "Ostrava": [
        {"addr": "Ostrava — Centrum", "premium": False},
        {"addr": "Ostrava — Poruba", "premium": False},
        {"addr": "Ostrava — Mariánské Hory", "premium": False},
        {"addr": "Ostrava — Zábřeh", "premium": False},
    ],
    "Plzeň": [
        {"addr": "Plzeň — Centrum", "premium": True},
        {"addr": "Plzeň — Slovany", "premium": False},
        {"addr": "Plzeň — Bory", "premium": False},
    ],
    "Olomouc": [
        {"addr": "Olomouc — Centrum", "premium": True},
        {"addr": "Olomouc — Nová Ulice", "premium": False},
        {"addr": "Olomouc — Neředín", "premium": False},
    ],
    "Liberec": [
        {"addr": "Liberec — Centrum", "premium": False},
        {"addr": "Liberec — Vratislavice", "premium": False},
        {"addr": "Liberec — Rochlice", "premium": False},
    ],
}

# Real-looking Unsplash images (high-quality interior/exterior)
IMAGES = {
    "byt": [
        ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
         "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
         "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800"],
        ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
         "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800",
         "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800"],
        ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
         "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
         "https://images.unsplash.com/photo-1560448075-bb485b067938?w=800"],
        ["https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
         "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800",
         "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800"],
        ["https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800",
         "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800",
         "https://images.unsplash.com/photo-1600566753376-12c8ab7c17a0?w=800"],
        ["https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800",
         "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800",
         "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800"],
    ],
    "dům": [
        ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
         "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
         "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"],
        ["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
         "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800",
         "https://images.unsplash.com/photo-1600573472556-e636c2acda9e?w=800"],
        ["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800",
         "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800",
         "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800"],
        ["https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?w=800",
         "https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800",
         "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?w=800"],
    ],
    "komerční": [
        ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
         "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
         "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800"],
        ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800",
         "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800",
         "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"],
    ],
    "pozemek": [
        ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
         "https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800"],
        ["https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
         "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800"],
    ],
}

DISPOSITIONS_BYT = [
    ("1+kk", 1, 25, 42),
    ("1+1", 1, 32, 48),
    ("2+kk", 2, 42, 65),
    ("2+1", 2, 50, 72),
    ("3+kk", 3, 65, 95),
    ("3+1", 3, 72, 105),
    ("4+kk", 4, 85, 130),
    ("4+1", 4, 95, 145),
    ("5+kk", 5, 110, 180),
]

AMENITIES_BYT = [
    "Balkon", "Terasa", "Lodžie", "Sklep", "Garáž", "Garážové stání", "Výtah",
    "Parkování", "Klidná lokalita", "Metro", "Tramvaj", "Novostavba",
    "Rekonstrukce", "Zařízený", "Částečně zařízený", "Prádelna v domě",
    "Plastová okna", "Podlahové topení", "Klimatizace", "Smart Home",
    "Bezpečnostní dveře", "Videotelefon", "Recepce",
]

AMENITIES_DUM = [
    "Zahrada", "Garáž", "Dvojgaráž", "Bazén", "Terasa", "Krb",
    "Podlahové topení", "Tepelné čerpadlo", "Solární panely",
    "Smart Home", "Alarm", "Kameraový systém", "Sklep", "Dílna",
    "Klidná lokalita", "Škola v dosahu", "MHD v dosahu",
]

AMENITIES_KOM = [
    "Klimatizace", "Optické připojení", "Parkování", "Recepce",
    "Zasedací místnost", "Kuchyňka", "Bezbariérový přístup",
    "Výloha", "Alarm", "Přístup 24/7",
]

ENERGY_CLASSES = ["A", "B", "C", "D", "E", "F", "G"]
ENERGY_WEIGHTS = [15, 25, 25, 20, 10, 3, 2]

def generate_flat(idx, city, location):
    disp = random.choice(DISPOSITIONS_BYT)
    disp_name, rooms, min_size, max_size = disp
    size = random.randint(min_size, max_size)

    key = "byt_prodej" if random.random() > 0.3 else "byt_pronájem"
    tx = "prodej" if "prodej" in key else "pronájem"

    price_range = PRICE_PER_M2[city][key]
    premium_mult = 1.15 if location["premium"] else 1.0
    price_per_m2 = random.randint(int(price_range[0] * premium_mult), int(price_range[1] * premium_mult))

    if tx == "prodej":
        price = round(size * price_per_m2, -4)  # round to 10k
    else:
        price = round(size * price_per_m2 / 1000) * 1000  # round to 1k

    floor = random.randint(1, 12)
    floors = max(floor, random.randint(floor, floor + 4))
    built = random.choice([*range(1920, 1940), *range(1960, 1990), *range(2000, 2026)])
    recon = random.choice([None, None, None, 2023, 2024, 2025]) if built < 2010 else None

    energy = random.choices(ENERGY_CLASSES, weights=ENERGY_WEIGHTS, k=1)[0]
    if built >= 2020:
        energy = random.choice(["A", "B"])

    days_ago = random.randint(0, 30)
    badges = []
    if days_ago <= 3:
        badges.append("new")
    if random.random() < 0.15:
        badges.append("hot")

    amenities = random.sample(AMENITIES_BYT, k=random.randint(3, 7))
    if floor >= 3 and "Výtah" not in amenities:
        amenities.append("Výtah")

    imgs = random.choice(IMAGES["byt"])

    title = f"Byt {disp_name}, {size} m²"
    if recon:
        title += f", po rekonstrukci"
    elif built >= 2020:
        title += f", novostavba"

    desc_parts = [
        f"Nabízíme {'' if tx == 'prodej' else 'k pronájmu '}byt {disp_name} o celkové výměře {size} m²",
        f"v {location['addr']}.",
        f"Byt se nachází v {floor}. patře {'s výtahem' if 'Výtah' in amenities else 'bez výtahu'}.",
    ]
    if recon:
        desc_parts.append(f"Kompletní rekonstrukce proběhla v roce {recon}.")
    if "Balkon" in amenities:
        desc_parts.append("Součástí je balkon.")
    if "Terasa" in amenities:
        desc_parts.append(f"K bytu patří prostorná terasa.")
    desc_parts.append(f"Dostupnost: {'ihned' if random.random() > 0.3 else 'od ' + str(random.randint(1,12)) + '.2026'}.")

    return {
        "id": f"SR-{100000 + idx}",
        "type": "byt",
        "tx": tx,
        "title": title,
        "loc": city,
        "addr": location["addr"],
        "price": price,
        "size": size,
        "rooms": rooms,
        "bath": 1 if rooms <= 3 else 2,
        "floor": floor,
        "floors": floors,
        "imgs": imgs,
        "badges": badges,
        "desc": " ".join(desc_parts),
        "amenities": amenities,
        "energy": energy,
        "avail": "Ihned" if random.random() > 0.3 else f"Od {random.randint(1,12)}.2026",
        "built": built,
        "recon": recon,
        "added": days_ago,
        "source": "sreality.cz",
        "sourceUrl": f"https://www.sreality.cz/detail/{tx}/byt/{disp_name.replace('+','%2B')}/{city.lower()}/{100000+idx}",
    }


def generate_house(idx, city, location):
    size = random.randint(100, 350)
    rooms = random.randint(4, 7)

    tx = "prodej" if random.random() > 0.2 else "pronájem"
    key = "dům_prodej"

    price_range = PRICE_PER_M2[city][key]
    premium_mult = 1.2 if location["premium"] else 1.0

    if tx == "prodej":
        price_per_m2 = random.randint(int(price_range[0] * premium_mult), int(price_range[1] * premium_mult))
        price = round(size * price_per_m2, -5)  # round to 100k
    else:
        price = random.randint(25000, 65000)
        price = round(price / 1000) * 1000

    built = random.choice([*range(1930, 1960), *range(1970, 2000), *range(2015, 2026)])
    recon = random.choice([None, None, 2022, 2023, 2024, 2025]) if built < 2010 else None
    floors = random.randint(1, 3)

    garden_size = random.choice([300, 400, 500, 600, 800, 1000, 1200])

    energy = random.choices(ENERGY_CLASSES[:5], weights=[20, 30, 25, 15, 10], k=1)[0]
    if built >= 2020:
        energy = random.choice(["A", "B"])

    days_ago = random.randint(0, 30)
    badges = []
    if days_ago <= 3:
        badges.append("new")
    if random.random() < 0.1:
        badges.append("hot")

    amenities = random.sample(AMENITIES_DUM, k=random.randint(4, 8))
    amenities.append(f"Zahrada {garden_size} m²")

    imgs = random.choice(IMAGES["dům"])

    house_type = random.choice(["Rodinný dům", "Vila", "Řadový dům"])
    title = f"{house_type} {rooms}+1, {location['addr']}"

    desc = (
        f"{house_type} o dispozici {rooms}+1 a výměře {size} m² "
        f"na pozemku {garden_size + size} m² v {location['addr']}. "
        f"Dům má {floors} {'podlaží' if floors > 1 else 'podlaží'}, "
        f"{rooms} pokojů a {2 if rooms > 4 else 1} koupelny. "
        f"{'Kompletně zrekonstruováno v ' + str(recon) + '.' if recon else ''} "
        f"{'Novostavba ' + str(built) + '.' if built >= 2020 else ''}"
    )

    return {
        "id": f"SR-{200000 + idx}",
        "type": "dům",
        "tx": tx,
        "title": title,
        "loc": city,
        "addr": location["addr"],
        "price": price,
        "size": size,
        "rooms": rooms,
        "bath": 2 if rooms > 4 else 1,
        "floor": None,
        "floors": floors,
        "imgs": imgs,
        "badges": badges,
        "desc": desc.strip(),
        "amenities": amenities,
        "energy": energy,
        "avail": "Ihned" if random.random() > 0.4 else f"Od {random.randint(1,12)}.2026",
        "built": built,
        "recon": recon,
        "added": days_ago,
        "source": "sreality.cz",
        "sourceUrl": f"https://www.sreality.cz/detail/{tx}/dum/{city.lower()}/{200000+idx}",
    }


def generate_commercial(idx, city, location):
    size = random.randint(50, 500)
    tx = random.choice(["prodej", "pronájem", "pronájem"])

    if tx == "pronájem":
        price = round(size * random.randint(200, 500) / 100) * 100
    else:
        price = round(size * random.randint(30000, 80000), -5)

    space_type = random.choice(["Kancelář", "Obchodní prostor", "Sklad", "Restaurace", "Ateliér"])

    imgs = random.choice(IMAGES["komerční"])
    amenities = random.sample(AMENITIES_KOM, k=random.randint(3, 6))
    days_ago = random.randint(0, 30)

    return {
        "id": f"SR-{300000 + idx}",
        "type": "komerční",
        "tx": tx,
        "title": f"{space_type} {size} m², {location['addr']}",
        "loc": city,
        "addr": location["addr"],
        "price": price,
        "size": size,
        "rooms": max(1, size // 30),
        "bath": max(1, size // 100),
        "floor": random.choice([0, 1, 2, 3]),
        "floors": random.randint(3, 8),
        "imgs": imgs,
        "badges": ["new"] if days_ago <= 2 else [],
        "desc": f"{space_type} o výměře {size} m² v {location['addr']}. {' '.join(amenities[:3])}. Vhodné pro podnikání.",
        "amenities": amenities,
        "energy": random.choice(["B", "C", "D"]),
        "avail": "Ihned" if random.random() > 0.3 else f"Od {random.randint(1,12)}.2026",
        "built": random.randint(1900, 2024),
        "recon": random.choice([None, 2022, 2023, 2024]),
        "added": days_ago,
        "source": "sreality.cz",
        "sourceUrl": f"https://www.sreality.cz/detail/{tx}/komercni/{city.lower()}/{300000+idx}",
    }


def generate_land(idx, city, location):
    size = random.randint(400, 3000)
    price = round(size * random.randint(1500, 8000), -4)

    imgs = random.choice(IMAGES["pozemek"])
    days_ago = random.randint(0, 30)

    amenities = random.sample([
        "IS na hranici", "Elektřina", "Voda", "Kanalizace", "Plyn",
        "Přístupová cesta", "Rovinatý", "Klidná lokalita",
        f"ÚP pro RD", "Výhled",
    ], k=random.randint(3, 6))

    return {
        "id": f"SR-{400000 + idx}",
        "type": "pozemek",
        "tx": "prodej",
        "title": f"Stavební pozemek {size} m², {location['addr']}",
        "loc": city,
        "addr": location["addr"],
        "price": price,
        "size": size,
        "rooms": 0,
        "bath": 0,
        "floor": None,
        "floors": None,
        "imgs": imgs,
        "badges": ["price"] if random.random() < 0.2 else [],
        "desc": f"Stavební pozemek o výměře {size} m² v {location['addr']}. {' '.join(amenities[:4])}.",
        "amenities": amenities,
        "energy": None,
        "avail": "Ihned",
        "built": None,
        "recon": None,
        "added": days_ago,
        "source": "sreality.cz",
        "sourceUrl": f"https://www.sreality.cz/detail/prodej/pozemek/{city.lower()}/{400000+idx}",
    }


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    random.seed(42)  # Reproducible for consistency

    properties = []
    idx = 0

    # Generate properties per city
    city_weights = {
        "Praha": (12, 4, 2, 2),       # flats, houses, commercial, land
        "Brno": (6, 3, 1, 1),
        "Ostrava": (3, 2, 1, 1),
        "Plzeň": (3, 1, 1, 0),
        "Olomouc": (2, 1, 0, 1),
        "Liberec": (2, 1, 0, 1),
    }

    for city, (flats, houses, coms, lands) in city_weights.items():
        locs = LOCATIONS[city]

        for _ in range(flats):
            loc = random.choice(locs)
            properties.append(generate_flat(idx, city, loc))
            idx += 1

        for _ in range(houses):
            loc = random.choice(locs)
            properties.append(generate_house(idx, city, loc))
            idx += 1

        for _ in range(coms):
            loc = random.choice(locs)
            properties.append(generate_commercial(idx, city, loc))
            idx += 1

        for _ in range(lands):
            loc = random.choice(locs)
            properties.append(generate_land(idx, city, loc))
            idx += 1

    # Sort by added date
    properties.sort(key=lambda x: x["added"])

    output = {
        "updated": datetime.now().isoformat(),
        "source": "sreality.cz (demo)",
        "count": len(properties),
        "properties": properties,
    }

    out_file = os.path.join(DATA_DIR, "properties.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Vygenerováno {len(properties)} nemovitostí:")
    types = {}
    for p in properties:
        key = f"{p['type']} ({p['tx']})"
        types[key] = types.get(key, 0) + 1
    for k, v in sorted(types.items()):
        print(f"  {k}: {v}")

    cities = {}
    for p in properties:
        cities[p["loc"]] = cities.get(p["loc"], 0) + 1
    print("\nPo městech:")
    for k, v in sorted(cities.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    prices = [p["price"] for p in properties if p["tx"] == "prodej" and p["type"] == "byt"]
    if prices:
        print(f"\nCeny bytů (prodej): {min(prices):,} — {max(prices):,} Kč")

    print(f"\nUloženo: {out_file}")


if __name__ == "__main__":
    main()
