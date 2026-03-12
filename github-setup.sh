#!/bin/bash
# ============================================
# BydlímTu Reality — GitHub + Netlify Setup
# ============================================
# Spusť tento skript na svém Macu:
#   cd ~/AI\ reality
#   chmod +x github-setup.sh
#   ./github-setup.sh
# ============================================

set -e

echo "🏠 BydlímTu Reality — GitHub & Netlify Setup"
echo "=============================================="
echo ""

# 1. Check prerequisites
echo "📋 Kontroluji nástroje..."

if ! command -v git &> /dev/null; then
    echo "❌ Git není nainstalován. Nainstaluj: xcode-select --install"
    exit 1
fi
echo "  ✅ git"

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI není nainstalováno."
    echo "   Nainstaluj: brew install gh"
    echo "   Potom: gh auth login"
    exit 1
fi
echo "  ✅ gh (GitHub CLI)"

if ! gh auth status &>/dev/null; then
    echo "📌 Přihlašuji k GitHubu..."
    gh auth login
fi
echo "  ✅ GitHub přihlášen"

# 2. Make sure we're in the right directory
if [ ! -f "index.html" ] || [ ! -f "netlify.toml" ]; then
    echo "❌ Spusť tento skript z adresáře ~/AI reality/"
    echo "   cd ~/AI\\ reality && ./github-setup.sh"
    exit 1
fi

# 3. Initialize git if needed
if [ ! -d ".git" ]; then
    echo ""
    echo "📌 Inicializuji Git repozitář..."
    git init
    git branch -m main
    git add .gitignore index.html netlify.toml package.json deploy.sh setup.sh \
        requirements.txt data/properties.json data/rates.json \
        netlify/functions/fetch-properties.js netlify/functions/fetch-rates.js \
        netlify/functions/scheduled-refresh.js fetch_properties.py fetch_rates.py \
        update.py generate_demo_data.py sreality_fetcher.html
    git commit -m "BydlímTu Reality — AI chatbot napojený na Sreality.cz

Plně funkční realitní web s AI chatbotem, napojený na živá data:
- 96 reálných nemovitostí ze Sreality.cz API
- Hypoteční sazby 10 českých bank (březen 2026)
- Netlify serverless funkce pro 24/7 automatické aktualizace"
fi
echo "  ✅ Git repozitář připraven"

# 4. Create GitHub repo
echo ""
echo "📌 Vytvářím GitHub repozitář..."
REPO_NAME="bydlimtu-reality"

if gh repo view "$REPO_NAME" &>/dev/null; then
    echo "  ⚠️  Repo '$REPO_NAME' již existuje, přeskakuji vytvoření"
else
    gh repo create "$REPO_NAME" \
        --public \
        --description "BydlímTu Reality — AI realitní chatbot napojený na Sreality.cz" \
        --source=. \
        --remote=origin
    echo "  ✅ GitHub repo vytvořeno: $REPO_NAME"
fi

# 5. Push to GitHub
echo ""
echo "📌 Nahrávám kód na GitHub..."
git push -u origin main 2>&1 || git push origin main 2>&1
echo "  ✅ Kód nahrán na GitHub"

# 6. Show result
REPO_URL=$(gh repo view --json url -q '.url' 2>/dev/null || echo "https://github.com/$(gh api user -q '.login')/$REPO_NAME")
echo ""
echo "=============================================="
echo "✅ HOTOVO! GitHub repozitář je připraven."
echo ""
echo "🔗 Repo: $REPO_URL"
echo ""
echo "=============================================="
echo "DALŠÍ KROK — Propojení s Netlify:"
echo "=============================================="
echo ""
echo "VARIANTA A — Přes webové rozhraní (nejjednodušší):"
echo "  1. Otevři https://app.netlify.com"
echo "  2. Klikni 'Add new site' → 'Import an existing project'"
echo "  3. Zvol 'GitHub' → Vyber repo '$REPO_NAME'"
echo "  4. Nastav:"
echo "     • Branch: main"
echo "     • Build command: (nech prázdné)"
echo "     • Publish directory: ."
echo "  5. Klikni 'Deploy site'"
echo ""
echo "VARIANTA B — Přes Netlify CLI:"
echo "  npm install -g netlify-cli"
echo "  netlify login"
echo "  netlify init  (→ zvol 'Link to existing repo on GitHub')"
echo "  netlify deploy --prod"
echo ""
echo "Po nasazení bude web běžet na: https://[tvuj-nazev].netlify.app"
echo "Můžeš nastavit vlastní doménu v Netlify → Domain settings"
