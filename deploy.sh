#!/bin/bash
# ============================================
# BydlímTu Reality — Netlify Deploy Script
# ============================================
# Spusť tento skript z kořenového adresáře projektu.
# Před spuštěním se ujisti, že máš nainstalované:
#   npm install -g netlify-cli
#   (nebo: brew install netlify-cli)
#
# PRVNÍ NASAZENÍ:
#   ./deploy.sh
#   → Provede tě přihlášením a vytvořením nového webu
#
# AKTUALIZACE:
#   ./deploy.sh
#   → Nasadí aktuální verzi

set -e

echo "🏠 BydlímTu Reality — Netlify Deploy"
echo "======================================"

# Check if netlify-cli is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI není nainstalováno."
    echo "   Nainstaluj pomocí: npm install -g netlify-cli"
    echo "   Nebo: brew install netlify-cli"
    exit 1
fi

# Check if logged in
if ! netlify status 2>/dev/null | grep -q "Logged in"; then
    echo "📌 Přihlašuji k Netlify..."
    netlify login
fi

# Check if site is linked
if [ ! -f ".netlify/state.json" ]; then
    echo ""
    echo "📌 Vytvářím nový Netlify web..."
    echo "   → Zvol 'Create & configure a new site'"
    echo "   → Pojmenuj ho např. 'bydlimtu-reality'"
    echo ""
    netlify init
fi

echo ""
echo "🚀 Nasazuji na Netlify..."
netlify deploy --prod

echo ""
echo "✅ Hotovo! Tvůj web běží 24/7 na Netlify."
echo "   → Serverless funkce automaticky stahují živá data ze Sreality.cz"
echo "   → Hypoteční sazby se aktualizují z českých bank"
echo "   → Scheduled Function obnovuje cache každou hodinu"
echo ""
echo "📊 Stav webu: netlify status"
echo "📋 Logy funkcí: netlify functions:log"
