#!/usr/bin/env python3
"""
BydlímTu Reality — Hlavní aktualizační skript
Spouští stahování nemovitostí i hypotečních sazeb.

Použití:
  python3 update.py          # Jednorázová aktualizace
  python3 update.py --loop   # Smyčka každou hodinu (pro běh na pozadí)

Pro plánování přes cron:
  0 * * * * cd /cesta/k/projektu && python3 update.py >> data/update.log 2>&1
"""

import sys
import os
import time
import json
from datetime import datetime

# Add script directory to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from fetch_properties import main as fetch_properties
from fetch_rates import main as fetch_rates


def run_update():
    """Run full data update."""
    start = time.time()
    print("\n" + "=" * 70)
    print(f"  BYDLÍMTU REALITY — AKTUALIZACE DAT")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    results = {"time": datetime.now().isoformat(), "success": True, "errors": []}

    # 1. Fetch properties
    try:
        print("\n[1/2] Stahování nemovitostí...")
        count = fetch_properties()
        results["properties_count"] = count
        print(f"  >> Staženo {count} nemovitostí")
    except Exception as e:
        print(f"  [CHYBA] Nemovitosti: {e}")
        results["errors"].append(f"properties: {str(e)}")

    # 2. Fetch rates
    try:
        print("\n[2/2] Stahování hypotečních sazeb...")
        fetch_rates()
        results["rates_updated"] = True
        print(f"  >> Sazby aktualizovány")
    except Exception as e:
        print(f"  [CHYBA] Sazby: {e}")
        results["errors"].append(f"rates: {str(e)}")

    elapsed = round(time.time() - start, 1)
    results["elapsed_seconds"] = elapsed

    if results["errors"]:
        results["success"] = False

    # Save update status
    status_file = os.path.join(SCRIPT_DIR, "data", "status.json")
    try:
        with open(status_file, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
    except:
        pass

    print(f"\n{'=' * 70}")
    print(f"  HOTOVO za {elapsed}s")
    if results["errors"]:
        print(f"  CHYBY: {', '.join(results['errors'])}")
    else:
        print(f"  Vše v pořádku!")
    print(f"{'=' * 70}\n")

    return results


def main():
    if "--loop" in sys.argv:
        print("Spouštím v režimu smyčky (aktualizace každou hodinu)...")
        print("Ukončení: Ctrl+C")
        while True:
            try:
                run_update()
                print(f"Další aktualizace za 60 minut... (Ctrl+C pro ukončení)")
                time.sleep(3600)  # 1 hour
            except KeyboardInterrupt:
                print("\nUkončeno uživatelem.")
                break
    else:
        run_update()


if __name__ == "__main__":
    main()
