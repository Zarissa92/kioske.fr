#!/usr/bin/env bash
# sauvegarder.sh — sauvegarde de kioske.fr sur le serveur (Debian) : projet, racine web, certificats, configuration.
#
# Usage, depuis le dossier deploy/ du projet, en utilisateur normal (sudo demandé quand il faut) :
#   bash deploy/sauvegarder.sh                    état et aide, sans rien modifier
#   bash deploy/sauvegarder.sh sauvegarder       crée une sauvegarde (trois archives, vérifiées)
#   bash deploy/sauvegarder.sh sauvegarder --simulation   affiche ce qui serait sauvegardé, sans rien écrire
#   bash deploy/sauvegarder.sh lister             sauvegardes présentes
#   bash deploy/sauvegarder.sh planifier         installe le timer systemd : sauvegarde chaque jour à minuit
#   bash deploy/sauvegarder.sh planifier --simulation   affiche ce qui serait installé
#
# Ce qui est sauvegardé :
#   projet/        le dossier kioske.fr : code, réglages (kioske.cfg), données (data/ : historique, caches,
#                  instantané des plus lus), bot Mastodon (comptes.cfg, mastodon.db), sources, menu, .git.
#                  Exclus : build/ (régénéré par le timer), venv/ et venv_blog/ (recréables),
#                  tests/node_modules/, __pycache__.
#   racine-web/    la racine servie par nginx (RACINE_WEB, /srv/kioske.fr par défaut) : régénérable, mais
#                  copié pour une restauration immédiate.
#   systeme/       certificats Let's Encrypt (/etc/letsencrypt), nginx (/etc/nginx), fail2ban (/etc/fail2ban),
#                  unités systemd du site et des bots (/etc/systemd/system/kioske-* et mastodon-*).
#
# Les sauvegardes vont dans ~/kioske-sauvegardes (dossier de l'utilisateur propriétaire du projet), en 700 ; les
# archives sont en 600. Elles contiennent des secrets (clés privées des certificats, jetons Mastodon) : ne jamais
# les déposer dans le dépôt git.
#
# Une sauvegarde n'est gardée que si ses trois archives sont lisibles. Rotation : la plus récente et les
# trois précédentes sont gardées (SAUVEGARDES_GARDEES=4), les plus anciennes sont supprimées.
set -euo pipefail

# ---------------------------------------------------------------------------
# Chemins et réglages (déclarés une seule fois ; modifiables au lancement)
# ---------------------------------------------------------------------------
DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # racine de kioske.fr sur le serveur
RACINE_WEB="${RACINE_WEB:-/srv/kioske.fr}"
# Destination : le dossier kioske-sauvegardes de l'utilisateur propriétaire du projet (SUDO_USER, sinon le
# propriétaire du dossier : cas d'une tâche planifiée en root). Les archives lui appartiennent.
COMPTE_SAUV="${SUDO_USER:-$(stat -c %U "$DOSSIER")}"
HOME_SAUV="$(getent passwd "$COMPTE_SAUV" | cut -d: -f6)"
SAUVEGARDES="${SAUVEGARDES:-$HOME_SAUV/kioske-sauvegardes}"
SAUVEGARDES_GARDEES="${SAUVEGARDES_GARDEES:-4}"   # la plus récente + trois précédentes
OS_RELEASE="${OS_RELEASE:-/etc/os-release}"

# Chemins système sauvegardés (ceux qui existent ; les autres sont signalés)
CHEMINS_SYSTEME=(
    /etc/letsencrypt
    /etc/nginx
    /etc/fail2ban
    /etc/systemd/system/kioske-veille.service
    /etc/systemd/system/kioske-veille.timer
    /etc/systemd/system/mastodon-articles.service
    /etc/systemd/system/mastodon-articles.timer
    /etc/systemd/system/mastodon-plus-lus.service
    /etc/systemd/system/mastodon-plus-lus.timer
)

ACTION="${1:-aide}"
SIMULATION=0
for arg in "$@"; do [[ "$arg" == "--simulation" ]] && SIMULATION=1; done

info()   { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
avert()  { printf '\033[1;33m[attention]\033[0m %s\n' "$*"; }
erreur() { printf '\033[1;31m[erreur]\033[0m %s\n' "$*" >&2; exit 1; }
# Une écriture : affichée en simulation, exécutée sinon.
ecrire() { if (( SIMULATION )); then echo "   [simulation] $*"; else "$@"; fi; }

aide() { awk 'NR > 1 && /^#/ { print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# ---------------------------------------------------------------------------
# Garde-fous
# ---------------------------------------------------------------------------
if [[ "$ACTION" == "aide" || "$ACTION" == "etat" || "$ACTION" == "-h" || "$ACTION" == "--aide" ]]; then
    aide
    echo
    if [[ -d "$SAUVEGARDES" ]]; then
        echo "Sauvegardes présentes dans $SAUVEGARDES :"
        ls -1 "$SAUVEGARDES" 2>/dev/null | sed 's/^/  /' || true
    else
        echo "Aucune sauvegarde pour l'instant ($SAUVEGARDES)."
    fi
    exit 0
fi

grep -q '^ID=debian' "$OS_RELEASE" 2>/dev/null || erreur "Ce script est prévu pour Debian ($OS_RELEASE)."
command -v tar >/dev/null || erreur "tar est requis."
if [[ "$ACTION" != "sauvegarder" && "$ACTION" != "lister" && "$ACTION" != "planifier" ]]; then
    erreur "Action inconnue : $ACTION (voir : bash deploy/sauvegarder.sh)"
fi

# ---------------------------------------------------------------------------
# Lister
# ---------------------------------------------------------------------------
lister() {
    if [[ ! -d "$SAUVEGARDES" ]]; then
        info "Aucune sauvegarde ($SAUVEGARDES)."
        return 0
    fi
    sudo ls -lh "$SAUVEGARDES" | sed -n '1,200p'
}

# ---------------------------------------------------------------------------
# Sauvegarder
# ---------------------------------------------------------------------------
sauvegarder() {
    local date_jour dossier_sauv nom chemin manquants=()
    date_jour="$(date +%Y%m%d-%H%M%S)"
    dossier_sauv="$SAUVEGARDES/$date_jour"

    info "Sauvegarde du $date_jour dans $dossier_sauv"
    [[ -d "$DOSSIER/kioske" && -f "$DOSSIER/kioske.cfg" ]] || erreur "Ce dossier ne ressemble pas à kioske.fr : $DOSSIER"
    [[ -d "$RACINE_WEB" ]] || avert "Racine web introuvable : $RACINE_WEB (étape racine-web ignorée)"
    for chemin in "${CHEMINS_SYSTEME[@]}"; do
        [[ -e "$chemin" ]] || manquants+=("$chemin")
    done
    (( ${#manquants[@]} )) && avert "Absents, non sauvegardés : ${manquants[*]}"

    ecrire sudo mkdir -p "$dossier_sauv"
    ecrire sudo chown "$COMPTE_SAUV": "$SAUVEGARDES" "$dossier_sauv"
    ecrire sudo chmod 700 "$SAUVEGARDES" "$dossier_sauv"

    # Lance une commande tar. Code 1 (« fichier modifié pendant la lecture » : un build tournait en même temps)
    # = archive utilisable, simple avertissement. Code > 1 = échec : le dossier daté, incomplet, est supprimé
    # pour ne pas compter dans la rotation.
    archiver() {
        local code=0
        "$@" || code=$?
        if (( code > 1 )); then
            sudo rm -rf "$dossier_sauv"
            erreur "tar a échoué (code $code). Sauvegarde incomplète écartée : $dossier_sauv"
        fi
        (( code == 1 )) && avert "Des fichiers ont changé pendant l'archivage (build en cours ?) : archive gardée."
        return 0
    }

    # 1. Projet (utilisateur normal, sans sudo : tout appartient à l'utilisateur)
    # L'archive part du dossier parent (-C) : les chemins commencent par le nom du projet, pas par « ./ ».
    local projet excl
    projet="$(basename "$DOSSIER")"
    excl=(
        --exclude="$projet/build" --exclude="$projet/venv" --exclude="$projet/venv_blog"
        --exclude="$projet/tests/node_modules"
        --exclude='__pycache__' --exclude='*.pyc' --exclude='*.tmp'
    )
    info "1/3 projet : $DOSSIER"
    if (( SIMULATION )); then
        echo "   [simulation] tar … $DOSSIER -> projet-$date_jour.tar.gz (sans build/, venv/, venv_blog/, node_modules/)"
    else
        archiver tar -czf "$dossier_sauv/projet-$date_jour.tar.gz" -C "$(dirname "$DOSSIER")" "${excl[@]}" "$projet"
    fi

    # 2. Racine web
    if [[ -d "$RACINE_WEB" ]]; then
        info "2/3 racine web : $RACINE_WEB"
        if (( SIMULATION )); then
            echo "   [simulation] tar … $RACINE_WEB -> racine-web-$date_jour.tar.gz"
        else
            archiver sudo tar -czf "$dossier_sauv/racine-web-$date_jour.tar.gz" -C "$(dirname "$RACINE_WEB")" "$(basename "$RACINE_WEB")"
        fi
    fi

    # 3. Système : certificats, nginx, fail2ban, unités systemd
    local presents=()
    for chemin in "${CHEMINS_SYSTEME[@]}"; do
        [[ -e "$chemin" ]] && presents+=("${chemin#/}")
    done
    info "3/3 système : ${#presents[@]} élément(s) (certificats, nginx, fail2ban, systemd)"
    if (( SIMULATION )); then
        echo "   [simulation] tar … -C / ${presents[*]} -> systeme-$date_jour.tar.gz"
    else
        archiver sudo tar -czf "$dossier_sauv/systeme-$date_jour.tar.gz" -C / "${presents[@]}"
    fi

    (( SIMULATION )) && { info "Simulation : rien écrit."; return 0; }

    # Vérification : chaque archive doit se relire ; sinon la sauvegarde est écartée
    local archive
    for archive in "$dossier_sauv"/*.tar.gz; do
        sudo tar -tzf "$archive" >/dev/null || { sudo rm -rf "$dossier_sauv"; erreur "Archive illisible : $archive. Sauvegarde écartée."; }
    done
    sudo chown "$COMPTE_SAUV": "$dossier_sauv"/*.tar.gz
    sudo chmod 600 "$dossier_sauv"/*.tar.gz
    (cd "$dossier_sauv" && sudo sha256sum ./*.tar.gz | sudo tee SHA256SUMS >/dev/null)
    sudo chmod 600 "$dossier_sauv/SHA256SUMS"
    info "Sauvegarde vérifiée : $(sudo du -sh "$dossier_sauv" | cut -f1)"

    # Rotation : on ne garde que les SAUVEGARDES_GARDEES plus récentes (dossiers au format de ce script)
    local anciens
    mapfile -t anciens < <(sudo ls -1d "$SAUVEGARDES"/[0-9]*-[0-9]* 2>/dev/null | sort | head -n -"$SAUVEGARDES_GARDEES" || true)
    local a
    for a in "${anciens[@]:-}"; do
        [[ -n "$a" ]] || continue
        sudo rm -rf "$a"
        info "Ancienne sauvegarde retirée : $(basename "$a")"
    done
}

# ---------------------------------------------------------------------------
# Planifier : timer systemd, chaque jour à minuit
# ---------------------------------------------------------------------------
planifier() {
    local modeles="$DOSSIER/deploy/systemd" unite fichier cible tmp date_jour
    local unites=(kioske-sauvegarde)
    command -v systemctl >/dev/null || erreur "systemd est requis."
    for unite in "${unites[@]}"; do
        for fichier in "$unite.service" "$unite.timer"; do
            [[ -f "$modeles/$fichier" ]] || erreur "Modèle manquant : $modeles/$fichier"
        done
    done
    tmp="$(mktemp -d)"
    trap "rm -rf '$tmp'" EXIT
    date_jour="$(date +%Y%m%d-%H%M%S)"
    for unite in "${unites[@]}"; do
        for fichier in "$unite.service" "$unite.timer"; do
            sed "s|__DOSSIER__|$DOSSIER|g" "$modeles/$fichier" > "$tmp/$fichier"
            cible="/etc/systemd/system/$fichier"
            if [[ -f "$cible" ]] && cmp -s "$tmp/$fichier" "$cible"; then
                info "$fichier : déjà à jour"
                continue
            fi
            if [[ -f "$cible" ]]; then
                ecrire sudo mkdir -p "$SAUVEGARDES/unites-$date_jour"
                ecrire sudo cp -a "$cible" "$SAUVEGARDES/unites-$date_jour/"
            fi
            info "$fichier : installation dans /etc/systemd/system"
            ecrire sudo install -m 644 "$tmp/$fichier" "$cible"
        done
    done
    ecrire sudo systemctl daemon-reload
    for unite in "${unites[@]}"; do
        ecrire sudo systemctl enable --now "$unite.timer"
    done
    if (( ! SIMULATION )); then
        systemctl list-timers "kioske-sauvegarde.timer" --no-pager || true
        info "Sauvegarde planifiée chaque jour à minuit. Essai immédiat : sudo systemctl start kioske-sauvegarde.service"
    fi
}

case "$ACTION" in
    sauvegarder) sauvegarder ;;
    lister)      lister ;;
    planifier)   planifier ;;
esac
