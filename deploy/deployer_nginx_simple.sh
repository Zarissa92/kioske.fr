#!/usr/bin/env bash
# Déploie la configuration nginx SUR LE SERVEUR (Debian 13) sans modifier les certificats.
# À lancer en utilisateur normal (meli). Demande sudo pour nginx.
#
# Copie deploy/kioske-nginx.conf dans /etc/nginx/sites-available/kioske.fr,
# teste la configuration avec nginx -t, et recharge nginx.
# Les certificats existants ne sont pas touchés.
#
# Usage :
#   ./deploy/deployer_nginx_simple.sh
#
set -euo pipefail

DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SRC="$DOSSIER/deploy/kioske-nginx.conf"
DISPO="/etc/nginx/sites-available/kioske.fr"
ACTIF="/etc/nginx/sites-enabled/kioske.fr"

info()    { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
avert()   { printf '\033[1;33m[attention]\033[0m %s\n' "$*"; }
erreur()  { printf '\033[1;31m[erreur]\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "$EUID" -eq 0 && -z "${SUDO_USER:-}" ]]; then
    erreur "Lance ce script en utilisateur normal (meli), pas en root : il utilise sudo."
fi

[[ -f "$CONF_SRC" ]] || erreur "Fichier de configuration absent : $CONF_SRC"

info "Déploiement de la configuration nginx depuis $CONF_SRC"

# Sauvegarde l'ancienne config
if [[ -f "$DISPO" ]]; then
    sauvegarde="${DISPO}.backup.$(date +%s)"
    sudo cp -p "$DISPO" "$sauvegarde"
    info "Ancienne configuration sauvegardée : $sauvegarde"
fi

# Copie la nouvelle config
sudo install -m 644 "$CONF_SRC" "$DISPO"
sudo ln -sfn "$DISPO" "$ACTIF"
info "Configuration copiée dans $DISPO"

# Teste la configuration
if ! sudo nginx -t 2>/tmp/nginx-test.$$; then
    cat /tmp/nginx-test.$$ >&2
    rm -f /tmp/nginx-test.$$

    # Restaure l'ancienne config
    if [[ -n "${sauvegarde:-}" && -f "$sauvegarde" ]]; then
        sudo cp -p "$sauvegarde" "$DISPO"
        info "Configuration restaurée depuis la sauvegarde"
    fi
    erreur "Configuration nginx invalide. L'ancienne configuration a été restaurée."
fi
rm -f /tmp/nginx-test.$$
info "Configuration testée avec succès"

# Recharge nginx
sudo systemctl reload nginx
info "nginx rechargé"

# Vérifie l'état
if sudo nginx -t >/dev/null 2>&1; then
    info "✓ Déploiement réussi"
    info "État : sudo systemctl status nginx --no-pager"
else
    avert "Attention : la configuration nginx a un problème (vérifier les certificats ?)"
fi
