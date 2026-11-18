#!/usr/bin/env bash
# Déploie la configuration nginx SUR LE SERVEUR (Debian 13) sans modifier les certificats.
# À lancer en utilisateur normal (<utilisateur>). Demande sudo pour nginx.
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
    erreur "Lance ce script en utilisateur normal (<utilisateur>), pas en root : il utilise sudo."
fi

[[ -f "$CONF_SRC" ]] || erreur "Fichier de configuration absent : $CONF_SRC"

# Racine publique : demandée au terminal (ou reçue de RACINE_WEB), défaut /srv/kioske.fr
source "$DOSSIER/deploy/lib_config.sh"
RACINE_WEB="$(demander_repertoire RACINE_WEB 'Répertoire public servi par nginx' "/srv/kioske.fr")" || exit 1

# Remplace le marqueur __RACINE_WEB__ de la configuration par la racine choisie
CONF_TMP="$(mktemp)"
trap 'rm -f "$CONF_TMP"' EXIT
sed "s|__RACINE_WEB__|$RACINE_WEB|g" "$CONF_SRC" > "$CONF_TMP"
grep -q '__RACINE_WEB__' "$CONF_TMP" && erreur "Marqueur __RACINE_WEB__ non remplacé dans la configuration"
CONF_SRC="$CONF_TMP"

info "Déploiement de la configuration nginx depuis $DOSSIER/deploy/kioske-nginx.conf avec racine=$RACINE_WEB"

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
