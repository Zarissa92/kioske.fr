#!/usr/bin/env bash
# kioske.sh — déploiement de kioske.fr. Un seul point d'entrée pour toutes les parties.
#
# Sans argument, déploie TOUT, dans cet ordre. Chaque étape s'arrête à sa première erreur :
#   immuable   le bloc immuable doit être enregistré (sinon rien n'est publié)
#   serveur    venv et timer de publication (installer_serveur.sh)
#   veille     construit le site dans build/ (page, flux, images), puis le publie dans la racine web
#   nginx      configure le site : HTTP, puis HTTPS si le certificat existe (deployer_nginx.sh)
#   fail2ban   page « Tu es banni », filtres et jails du site ; étape ignorée si la jail sans_pitie manque
#   statut     contrôle final (verifier_serveur.sh), sans bloquer le déploiement
#
# Usage :
#   deploy/kioske.sh                          # tout
#   deploy/kioske.sh --email toi@exemple.fr   # tout, et demande le certificat Let's Encrypt
#   deploy/kioske.sh --sans-certificat        # tout, HTTP seulement (nginx)
#   deploy/kioske.sh --certificat-ok          # tout, nginx seul (config mise à jour, pas de certificats)
#   deploy/kioske.sh veille nginx             # seulement ces étapes, dans l'ordre donné
#   deploy/kioske.sh --simulation             # affiche ce qui serait fait, sans rien lancer
#   deploy/kioske.sh aide
#
# Étapes : immuable, serveur, veille, nginx, fail2ban, statut.
# À lancer sur le serveur, en utilisateur normal (meli) : les étapes qui en ont besoin demandent sudo.
# Jamais le Python système : le venv du projet (venv/ sur le serveur, venv_blog/ sur le PC) est utilisé.
# Domaine et racine web : lus dans kioske.cfg.
set -Eeuo pipefail

DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DOSSIER/deploy/lib_config.sh"  # cfg <section> <clé> : valeurs de kioske.cfg
DOMAINE="$(cfg site domaine)"
RACINE_WEB="$(cfg serveur racine_web)"
SITE_NGINX="/etc/nginx/sites-available/$DOMAINE"
CERT_DIR="/etc/letsencrypt/live/$DOMAINE"
LOG_NGINX="/var/log/nginx/$DOMAINE.access.log"
LOG_HORS_SITE="/var/log/nginx/$DOMAINE.hors-site.log"   # écrit par nginx : adresses que le site n'a pas
DOSSIER_FILTRES_F2B="/etc/fail2ban/filter.d"
JAIL_F2B="/etc/fail2ban/jail.d/kioske.local"
ANCIENNE_JAIL_F2B="/etc/fail2ban/jail.d/kioske-scan.local"
JAILS_F2B=(kioske-scan kioske-hors-site kioske-interdit kioske-debit)   # un filtre deploy/fail2ban/<nom>.conf chacune
IP_JAMAIS_BANNIES="$(cfg serveur ip_jamais_bannies)"
JAIL_PREREQUIS="sans_pitie"

EMAIL=" "
SANS_CERT=0
NGINX_SIMPLE=0
SIMULATION=0
ETAPES=()
ETAPES_TOUT=(immuable serveur veille nginx fail2ban statut)

info()   { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
ok()     { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
avert()  { printf '\033[1;33m[attention]\033[0m %s\n' "$*"; }
erreur() { printf '\033[1;31m[erreur]\033[0m %s\n' "$*" >&2; exit 1; }

aide() {
    sed -n '2,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# Lance une commande, ou l'affiche seulement en simulation.
lancer() {
    if (( SIMULATION == 1 )); then
        printf '  [simulation] %s\n' "$*"
    else
        "$@"
    fi
}

# Le Python du projet : venv/ sur le serveur, venv_blog/ sur le PC. Jamais le Python système.
python_projet() {
    if [[ -x "$DOSSIER/venv/bin/python" ]]; then
        echo "$DOSSIER/venv/bin/python"
    elif [[ -x "$DOSSIER/venv_blog/bin/python" ]]; then
        echo "$DOSSIER/venv_blog/bin/python"
    else
        erreur "Aucun venv du projet (venv/ ou venv_blog/). Lance d'abord deploy/installer_serveur.sh."
    fi
}

# ---------- Étapes ----------

etape_immuable() {
    info "Bloc immuable : vérification de l'empreinte"
    lancer "$(python_projet)" "$DOSSIER/bin/garde_immuable.py" verifier
}

etape_serveur() {
    info "Serveur : venv et timer de publication"
    lancer bash "$DOSSIER/deploy/installer_serveur.sh"
}

etape_veille() {
    info "Veille : construction du site (page, flux, images), puis publication dans $RACINE_WEB"
    lancer "$(python_projet)" "$DOSSIER/bin/publier_public.py"
}

etape_nginx() {
    info "nginx : configuration du site $DOMAINE"
    if (( NGINX_SIMPLE == 1 )); then
        info "Mode simple : copie la config, teste, et recharge (sans certificats)"
        lancer bash "$DOSSIER/deploy/deployer_nginx_simple.sh"
    else
        local args=()
        if [[ -n "$EMAIL" ]]; then
            args+=(--email "$EMAIL")
        elif (( SANS_CERT == 1 )); then
            args+=(--sans-certificat)
        fi
        lancer bash "$DOSSIER/deploy/deployer_nginx.sh" "${args[@]}"
    fi
}

etape_fail2ban() {
    info "fail2ban : page « Tu es banni », filtres et jails du site (${JAILS_F2B[*]})"
    if (( SIMULATION == 1 )); then
        printf '  [simulation] f2b.sh (si la jail %s existe), puis installation des filtres et des jails %s\n' "$JAIL_PREREQUIS" "${JAILS_F2B[*]}"
        return 0
    fi
    if ! command -v fail2ban-client >/dev/null 2>&1; then
        avert "fail2ban n'est pas installé (sudo apt-get install fail2ban). Étape ignorée."
        return 0
    fi
    if ! sudo fail2ban-client status "$JAIL_PREREQUIS" >/dev/null 2>&1; then
        avert "La jail [$JAIL_PREREQUIS] n'existe pas dans /etc/fail2ban/jail.d/hardening.local : étape ignorée."
        return 0
    fi
    [[ -f "$SITE_NGINX" ]] || erreur "$SITE_NGINX absent : l'étape nginx doit réussir avant fail2ban."
    sudo grep -q "$(basename "$LOG_HORS_SITE")" "$SITE_NGINX" \
        || erreur "$SITE_NGINX n'écrit pas le journal hors-site : relance d'abord l'étape nginx (configuration à jour)."

    # 1. Page de ban et action nginx-geo-ban (f2b.sh est idempotent)
    sudo bash "$DOSSIER/deploy/fail2ban/f2b.sh" "$SITE_NGINX"

    # 2. Journaux : fail2ban refuse de démarrer une jail dont le journal n'existe pas
    local journal
    for journal in "$LOG_NGINX" "$LOG_HORS_SITE"; do
        sudo test -f "$journal" || sudo install -m 640 -o www-data -g adm /dev/null "$journal"
    done

    # 3. Filtres : test sur le journal réel (nombre de lignes reconnues), puis installation
    local nom
    for nom in "${JAILS_F2B[@]}"; do
        journal="$LOG_NGINX"; [[ "$nom" == "kioske-hors-site" ]] && journal="$LOG_HORS_SITE"
        printf '  %s : ' "$nom"
        sudo fail2ban-regex "$journal" "$DOSSIER/deploy/fail2ban/$nom.conf" | grep -E '^Lines:' || true
        sudo install -m 644 "$DOSSIER/deploy/fail2ban/$nom.conf" "$DOSSIER_FILTRES_F2B/$nom.conf"
    done

    # 4. Jails : sauvegarde des anciennes, puis rechargement. Si fail2ban refuse, on revient en arrière.
    #    L'ancien fichier kioske-scan.local (une seule jail) est remplacé par kioske.local.
    local ancien
    for ancien in "$JAIL_F2B" "$ANCIENNE_JAIL_F2B"; do
        if [[ -f "$ancien" ]]; then sudo cp -p "$ancien" "$ancien.avant"; fi
    done
    sudo rm -f "$ANCIENNE_JAIL_F2B"
    sed -e "s|__DOMAINE__|$DOMAINE|g" -e "s|__IP_JAMAIS_BANNIES__|$IP_JAMAIS_BANNIES|g" \
        "$DOSSIER/deploy/fail2ban/kioske.jail.conf" | sudo install -m 644 /dev/stdin "$JAIL_F2B"
    if ! sudo fail2ban-client reload; then
        avert "fail2ban a refusé les nouvelles jails : retour à l'état précédent."
        for ancien in "$JAIL_F2B" "$ANCIENNE_JAIL_F2B"; do
            if [[ -f "$ancien.avant" ]]; then sudo mv -f "$ancien.avant" "$ancien"; else sudo rm -f "$ancien"; fi
        done
        sudo fail2ban-client reload || true
        erreur "Jails du site non installées."
    fi
    sleep 2
    for nom in "${JAILS_F2B[@]}"; do
        sudo fail2ban-client status "$nom" | sed 's/^/  /'
    done
    info "Adresses jamais bannies : $IP_JAMAIS_BANNIES"
    ok "fail2ban configuré"
}

etape_statut() {
    info "Statut : contrôle de la mise en ligne"
    if (( SIMULATION == 1 )); then
        printf '  [simulation] bash deploy/verifier_serveur.sh\n'
        return 0
    fi
    bash "$DOSSIER/deploy/verifier_serveur.sh" || avert "Le contrôle signale des points à vérifier (voir ci-dessus)."
}

# ---------- Lecture des options ----------

while (( $# > 0 )); do
    case "$1" in
        aide|-h|--help) aide; exit 0 ;;
        --email) EMAIL="${2:-}"; [[ -n "$EMAIL" ]] || erreur "--email attend une adresse"; shift 2 ;;
        --sans-certificat) SANS_CERT=1; shift ;;
        --certificat-ok) NGINX_SIMPLE=1; shift ;;
        --simulation) SIMULATION=1; shift ;;
        immuable|serveur|veille|nginx|fail2ban|statut) ETAPES+=("$1"); shift ;;
        *) erreur "Option ou étape inconnue : $1 (voir deploy/kioske.sh aide)" ;;
    esac
done

if (( ${#ETAPES[@]} == 0 )); then
    ETAPES=("${ETAPES_TOUT[@]}")
    info "Aucune étape indiquée : déploiement complet (${ETAPES[*]})"
fi
if (( SIMULATION == 1 )); then
    avert "Simulation : aucune commande ne sera lancée."
fi

# ---------- Exécution ----------

for etape in "${ETAPES[@]}"; do
    "etape_$etape"
done

if (( SIMULATION == 1 )); then
    ok "Simulation terminée."
else
    ok "Déploiement terminé : ${ETAPES[*]}"
fi
