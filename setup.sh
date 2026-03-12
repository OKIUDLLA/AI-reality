#!/bin/bash
# ============================================================
# BydlímTu Reality — Instalace a spuštění
# ============================================================
# Tento skript nainstaluje závislosti, stáhne data a spustí web.
#
# Použití:
#   chmod +x setup.sh
#   ./setup.sh
# ============================================================

set -e

echo ""
echo "============================================================"
echo "  BydlímTu Reality — Instalace"
echo "============================================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[CHYBA] Python 3 není nainstalován!"
    echo "  Nainstalujte Python 3: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VER=$(python3 --version)
echo "[OK] $PYTHON_VER"

# Install dependencies
echo ""
echo ">> Instaluji Python závislosti..."
pip3 install -r requirements.txt --quiet 2>/dev/null || pip3 install -r requirements.txt --break-system-packages --quiet
echo "[OK] Závislosti nainstalovány"

# Create data directory
mkdir -p data
echo "[OK] Adresář data/ vytvořen"

# Check if demo data exists
if [ ! -f "data/properties.json" ] || [ ! -s "data/properties.json" ]; then
    echo ""
    echo ">> Živá data nejsou k dispozici, generuji demo data..."
    python3 generate_demo_data.py
fi

# Fetch live rates
echo ""
echo ">> Stahuji hypoteční sazby..."
python3 fetch_rates.py

# Try to fetch live properties
echo ""
echo ">> Pokouším se stáhnout živá data ze Sreality.cz..."
python3 fetch_properties.py
PROP_COUNT=$(python3 -c "import json; d=json.load(open('data/properties.json')); print(d.get('count',0))")

if [ "$PROP_COUNT" -lt 5 ]; then
    echo "[INFO] Sreality API nedostupné nebo vrací málo dat."
    echo "       Používám demo data s reálnými cenami."
    python3 generate_demo_data.py
fi

echo ""
echo "============================================================"
echo "  Instalace dokončena!"
echo "============================================================"
echo ""
echo "  Soubory:"
echo "    index.html          — Hlavní web"
echo "    data/properties.json — Nemovitosti ($(python3 -c "import json; print(json.load(open('data/properties.json'))['count'])"))"
echo "    data/rates.json      — Hypoteční sazby"
echo ""
echo "  Otevřete web:"
echo "    python3 -m http.server 8080"
echo "    → Poté navštivte http://localhost:8080"
echo ""
echo "  Automatická aktualizace (každou hodinu):"
echo "    python3 update.py --loop &"
echo ""
echo "  Nebo přidejte do crontabu:"
echo "    crontab -e"
echo "    0 * * * * cd $(pwd) && python3 update.py >> data/update.log 2>&1"
echo ""
echo "============================================================"

# Offer to start server
echo ""
read -p "Chcete nyní spustit web? [Y/n] " answer
if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
    echo ""
    echo "  Spouštím server na http://localhost:8080"
    echo "  Ctrl+C pro ukončení"
    echo ""
    python3 -m http.server 8080
fi
