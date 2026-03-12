#!/usr/bin/env python3
"""
BydlímTu Reality — Stahování reálných hypotečních sazeb
Zdroje: CNB (PRIBOR), Finparáda, aktuální data bank

Výstup: data/rates.json
"""

import requests
import json
import os
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "rates.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "cs-CZ,cs;q=0.9",
}


def fetch_cnb_pribor():
    """Fetch PRIBOR rates from CNB (Czech National Bank)."""
    print(">> Stahuji PRIBOR z ČNB...")
    # CNB publishes daily PRIBOR in plain text
    today = datetime.now()
    url = f"https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/denni.txt"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        text = resp.text
        lines = text.strip().split("\n")

        # Parse the last data line
        pribor = {}
        for line in reversed(lines):
            parts = line.strip().split("|")
            if len(parts) >= 3 and re.match(r'\d{2}\.\d{2}\.\d{4}', parts[0].strip()):
                pribor["date"] = parts[0].strip()
                # PRIBOR tenors: 1D, 1W, 2W, 1M, 2M, 3M, 6M, 9M, 1Y
                tenors = ["1D", "1W", "2W", "1M", "2M", "3M", "6M", "9M", "1Y"]
                for i, tenor in enumerate(tenors):
                    if i + 1 < len(parts):
                        try:
                            pribor[tenor] = float(parts[i + 1].strip().replace(",", "."))
                        except:
                            pass
                break

        if pribor:
            print(f"  PRIBOR datum: {pribor.get('date', '?')}")
            print(f"  PRIBOR 3M: {pribor.get('3M', '?')}%")
            print(f"  PRIBOR 1Y: {pribor.get('1Y', '?')}%")
        return pribor

    except Exception as e:
        print(f"  [CHYBA] CNB PRIBOR: {e}")
        return {}


def fetch_hypoindex():
    """Try to get current Hypoindex value via web scraping."""
    print(">> Stahuji Hypoindex...")
    try:
        # Try Finparáda or hypoindex.cz
        urls = [
            "https://www.hypoindex.cz/",
            "https://www.finparada.cz/hypoteky/",
        ]
        for url in urls:
            try:
                resp = requests.get(url, headers=HEADERS, timeout=10)
                if resp.status_code == 200:
                    # Look for percentage patterns in the text
                    text = resp.text
                    # Common patterns: "4,89 %" or "4.89%"
                    matches = re.findall(r'(\d[,\.]\d{1,2})\s*%', text)
                    if matches:
                        rates = []
                        for m in matches:
                            try:
                                val = float(m.replace(",", "."))
                                if 2.0 < val < 10.0:  # reasonable mortgage rate range
                                    rates.append(val)
                            except:
                                pass
                        if rates:
                            # Most common rate is likely the hypoindex
                            from collections import Counter
                            common = Counter(rates).most_common(5)
                            print(f"  Nalezené sazby: {[c[0] for c in common[:3]]}")
                            return common[0][0]
            except:
                continue

    except Exception as e:
        print(f"  [CHYBA] Hypoindex: {e}")

    return None


def get_bank_rates():
    """
    Aktuální hypoteční sazby českých bank.
    Tyto se aktualizují z webových zdrojů nebo jako záloha z posledních známých dat.
    """
    print(">> Připravuji sazby bank...")

    # These are the latest known rates (March 2026)
    # The fetch script tries to update them from web sources
    banks = [
        {
            "name": "Fio banka",
            "rate": 4.18,
            "fixation": "3 roky",
            "note": "Nejnižší sazba na trhu",
            "logo": "fio",
        },
        {
            "name": "Moneta Money Bank",
            "rate": 4.19,
            "fixation": "5 let",
            "note": "Akce pro nové klienty",
            "logo": "moneta",
        },
        {
            "name": "Česká spořitelna",
            "rate": 4.49,
            "fixation": "5 let",
            "note": "Největší banka v ČR",
            "logo": "csporitelna",
        },
        {
            "name": "ČSOB",
            "rate": 4.59,
            "fixation": "5 let",
            "note": "Zvýhodněná sazba při pojištění",
            "logo": "csob",
        },
        {
            "name": "Komerční banka",
            "rate": 4.69,
            "fixation": "5 let",
            "note": "Možnost fixace 3-10 let",
            "logo": "kb",
        },
        {
            "name": "Raiffeisenbank",
            "rate": 4.59,
            "fixation": "5 let",
            "note": "Bez poplatku za správu",
            "logo": "raiffeisen",
        },
        {
            "name": "UniCredit Bank",
            "rate": 4.39,
            "fixation": "5 let",
            "note": "Online sjednání se slevou",
            "logo": "unicredit",
        },
        {
            "name": "mBank",
            "rate": 4.29,
            "fixation": "3 roky",
            "note": "100% online",
            "logo": "mbank",
        },
    ]

    # Try to scrape actual rates from comparison sites
    try:
        urls_to_try = [
            "https://www.finparada.cz/srovnani-hypotek.aspx",
            "https://www.mesec.cz/produkty/hypoteky/prehled/",
            "https://www.banky.cz/prehled-hypotek/",
        ]
        for url in urls_to_try:
            try:
                resp = requests.get(url, headers=HEADERS, timeout=10)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    text = soup.get_text()

                    # Try to find bank-rate pairs
                    for bank in banks:
                        bank_name_lower = bank["name"].lower()
                        # Look for the bank name near a percentage
                        pattern = rf'{re.escape(bank_name_lower)}[^%]*?(\d[,\.]\d{{1,2}})\s*%'
                        match = re.search(pattern, text.lower())
                        if match:
                            try:
                                new_rate = float(match.group(1).replace(",", "."))
                                if 2.0 < new_rate < 10.0:
                                    bank["rate"] = new_rate
                                    bank["live"] = True
                                    print(f"  Aktualizováno: {bank['name']} = {new_rate}%")
                            except:
                                pass
                    break
            except:
                continue
    except Exception as e:
        print(f"  [VAROVÁNÍ] Scraping sazeb: {e}")

    return sorted(banks, key=lambda x: x["rate"])


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("=" * 60)
    print(f"BydlímTu Reality — Stahování hypotečních sazeb")
    print(f"Čas: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. PRIBOR from CNB
    pribor = fetch_cnb_pribor()

    # 2. Hypoindex
    hypoindex = fetch_hypoindex()
    if not hypoindex:
        hypoindex = 4.89  # Last known value March 2026
        print(f"  Použita záložní hodnota Hypoindex: {hypoindex}%")

    # 3. Bank rates
    banks = get_bank_rates()
    best_rate = banks[0]["rate"] if banks else 4.18
    avg_rate = round(sum(b["rate"] for b in banks) / len(banks), 2) if banks else hypoindex

    print(f"\n{'=' * 60}")
    print(f"Výsledky:")
    print(f"  Hypoindex: {hypoindex}%")
    print(f"  Nejnižší sazba: {best_rate}% ({banks[0]['name']})")
    print(f"  Průměrná sazba: {avg_rate}%")
    print(f"  PRIBOR 3M: {pribor.get('3M', 'N/A')}%")

    # Build output
    output = {
        "updated": datetime.now().isoformat(),
        "hypoindex": hypoindex,
        "hypoindex_note": "Swiss Life Hypoindex — průměrná sazba nových hypoték",
        "pribor": pribor,
        "best_rate": best_rate,
        "avg_rate": avg_rate,
        "default_rate": round(avg_rate, 1),
        "banks": banks,
        "recommendations": [
            {
                "scenario": "Nejnižší splátka",
                "bank": banks[0]["name"] if banks else "Fio banka",
                "rate": best_rate,
                "note": "Krátká fixace, nižší sazba",
            },
            {
                "scenario": "Jistota (5 let fixace)",
                "bank": next((b["name"] for b in banks if "5" in b.get("fixation", "")), "Česká spořitelna"),
                "rate": next((b["rate"] for b in banks if "5" in b.get("fixation", "")), avg_rate),
                "note": "Stabilní splátka na 5 let",
            },
        ],
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nUloženo do: {OUTPUT_FILE}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
