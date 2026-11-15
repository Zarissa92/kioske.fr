#!/bin/bash
# Déploie la config nginx + fail2ban pour kioske.fr
# Sans modification des certificats

set -e

SCRIPT_DIR="$(dirname "$0")"
CONF_SRC="$SCRIPT_DIR/kioske-nginx-simple.conf"
CONF_DST="/etc/nginx/sites-available/kioske.fr"

echo "[info] Déploiement nginx + fail2ban pour kioske.fr..."

if [ ! -f "$CONF_SRC" ]; then
    echo "[ERREUR] Fichier source introuvable : $CONF_SRC"
    exit 1
fi

# Répertoire public : par variable d'environnement ou demander
RACINE_WEB="${RACINE_WEB:-}"
if [ -z "$RACINE_WEB" ]; then
    read -p "Répertoire public pour servir le site (ex: /home/<utilisateur>/kioske.fr/public) : " RACINE_WEB
fi
[ -n "$RACINE_WEB" ] || { echo "[ERREUR] Répertoire public requis"; exit 1; }

# ===== NGINX =====
echo ""
echo "[info] Configuration nginx..."

# Copie la config en remplaçant le chemin
echo "[info] Copie de $CONF_SRC vers $CONF_DST avec racine=$RACINE_WEB..."
sed "s|/home/<utilisateur>/kioske.fr/public|$RACINE_WEB|g" "$CONF_SRC" | sudo tee "$CONF_DST" > /dev/null

# Active le site s'il ne l'est pas
if [ ! -L /etc/nginx/sites-enabled/kioske.fr ]; then
    echo "[info] Activation du site..."
    sudo ln -s "$CONF_DST" /etc/nginx/sites-enabled/kioske.fr
fi

# Test la config
echo "[info] Test de la configuration nginx..."
sudo nginx -t

# Recharge nginx
echo "[info] Rechargement de nginx..."
sudo systemctl reload nginx

# ===== FAIL2BAN =====
echo ""
echo "[info] Configuration fail2ban..."

# Installe fail2ban s'il n'existe pas
if ! command -v fail2ban-client &> /dev/null; then
    echo "[info] fail2ban non trouvé, installation..."
    sudo apt-get update
    sudo apt-get install -y fail2ban
fi

# Copie la config fail2ban
echo "[info] Copie des jails fail2ban..."
sudo cp "$SCRIPT_DIR/fail2ban/kioske.jail.conf" /etc/fail2ban/jail.d/kioske.local
sudo cp "$SCRIPT_DIR/fail2ban/kioske-scan.conf" /etc/fail2ban/filter.d/kioske-scan.conf
sudo cp "$SCRIPT_DIR/fail2ban/kioske-hors-site.conf" /etc/fail2ban/filter.d/kioske-hors-site.conf
sudo cp "$SCRIPT_DIR/fail2ban/kioske-interdit.conf" /etc/fail2ban/filter.d/kioske-interdit.conf
sudo cp "$SCRIPT_DIR/fail2ban/kioske-debit.conf" /etc/fail2ban/filter.d/kioske-debit.conf

# Page "Tu es banni"
echo "[info] Installation de la page « Tu es banni »..."
bash "$SCRIPT_DIR/fail2ban/f2b.sh"

# Redémarre fail2ban
echo "[info] Redémarrage de fail2ban..."
sudo systemctl restart fail2ban

echo ""
echo "[OK] ✅ nginx redeployé"
echo "[OK] ✅ fail2ban configuré"
echo "[OK] Root nginx : /home/<utilisateur>/kioske.fr/public/"
