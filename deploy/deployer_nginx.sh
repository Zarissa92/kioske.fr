#!/usr/bin/env bash
# Déploie nginx pour le site SUR LE SERVEUR (Debian 13). À lancer en utilisateur normal (meli).
# Domaine et racine web : lus dans kioske.cfg.
# Le script demande sudo pour apt, nginx et certbot.
#
# Usage :
#   ./deploy/deployer_nginx.sh --email toi@exemple.fr   # nginx + certificat Let's Encrypt + HTTPS
#   ./deploy/deployer_nginx.sh --sans-certificat        # HTTP seulement (pour tester ou avant le DNS)
#   ./deploy/deployer_nginx.sh --desinstaller           # retire le site de nginx
#
# Ce que fait le script, dans l'ordre :
#   1. installe nginx et certbot (apt) si besoin ;
#   2. vérifie que nginx peut lire la racine web (sinon il s'arrête avec la commande à lancer) ;
#   3. écrit une configuration HTTP seule (avec les protections ci-dessous) et la teste (nginx -t) ;
#   4. si le DNS du domaine pointe vers ce serveur, demande un certificat Let's Encrypt ;
#   5. écrit la configuration HTTPS, la teste, puis recharge nginx.
# En cas d'erreur à une étape, la configuration précédente est remise en place.
# Les autres sites nginx (ex. blog.zarisse.fr) ne sont pas modifiés.
#
# Protections écrites dans la configuration (voir README, « Sécurité nginx ») :
#   - HTTPS seul (HSTS), TLS 1.3 seul, courbes X25519/secp384r1, 0-RTT refusé ;
#   - version de nginx masquée, méthodes limitées à GET et HEAD, aucun envoi de données ;
#   - en-têtes de sécurité, politique de contenu : aucune image, script ou police venant d'un autre site ;
#   - liste blanche : seules les adresses que le build produit sont servies, le reste est noté dans
#     /var/log/nginx/<domaine>.hors-site.log pour fail2ban ; fichiers cachés refusés ;
#   - débit limité par adresse IP (réponse 429 au-delà) ;
#   - si la page de ban fail2ban est installée (deploy/fail2ban/), elle est incluse dans chaque site.
set -euo pipefail

DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$DOSSIER/deploy/lib_config.sh"  # cfg <section> <clé> : valeurs de kioske.cfg
DOMAINE="$(cfg site domaine)"
# Vérification de sécurité : ce script est destiné à kioske.fr seulement
if [[ "$DOMAINE" != "kioske.fr" ]]; then
    erreur "ERREUR : Ce script est configuré pour kioske.fr, pas pour $DOMAINE. Arrêt pour éviter les mélanges de domaines."
fi
RACINE="$(cfg serveur racine_web)"  # racine servie : la même que la publication
DISPO="/etc/nginx/sites-available/$DOMAINE"
ACTIF="/etc/nginx/sites-enabled/$DOMAINE"
CERT_DIR="/etc/letsencrypt/live/$DOMAINE"
WEBROOT_ACME="/var/www/html"
SNIPPET_BAN="/etc/nginx/snippets/fail2ban-banni.conf"
EMAIL=""
SANS_CERT=0

# Politique de contenu : le site ne charge rien d'un autre site (images du KiosKe comprises,
# qui sont téléchargées par le build et servies depuis img/veille/ dans la racine web).
# Scripts : ceux écrits dans les pages et /theme.js ; connect-src pour fetch (recherche, carte ouverte,
# favoris) ; manifest-src et worker-src pour la PWA (manifest.json, sw.js).
CSP="default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"

# Tables et zones du niveau « http », écrites en tête du fichier généré.
CARTE_CACHE="$(cat <<'NGINX'
# Durée de cache selon le fichier demandé. Une seule variable, lue par un seul add_header au niveau
# « server » : dans nginx, un add_header placé dans un bloc « location » annule tous ceux du niveau
# « server » (HSTS, politique de contenu…). Aucun bloc « location » ne doit donc contenir d'add_header.
map $uri $kioske_cache_control {
    # Service worker : toujours revérifié
    /sw.js                            "no-cache, must-revalidate, max-age=0";
    # Manifest PWA : 1 jour
    /manifest.json                    "public, max-age=86400";
    # Icônes PWA : 1 an
    ~/icon-[0-9]+\.png$               "public, max-age=31536000, immutable";
    # Images de la veille : 30 jours
    ~/img/                            "public, max-age=2592000";
    # Polices, favicon : 1 an
    ~\.(css|woff2|woff|ttf|svg)$      "public, max-age=31536000, immutable";
    # Flux RSS/XML : toujours revérifiés
    ~\.xml$                           "no-cache, must-revalidate, max-age=0";
    # Pages, theme.js, index des articles : 30 min (durée du timer de mise à jour)
    default                           "public, max-age=1800, must-revalidate";
}

# Langue du site : en-tête Content-Language sur les pages HTML seulement. Une valeur vide n'envoie pas
# l'en-tête (images, scripts, flux…). Lu par un seul add_header au niveau « server », comme le cache.
map $sent_http_content_type $kioske_langue {
    ~^text/html                       "fr";
    default                           "";
}

# Débit par adresse IP. Deux compteurs : les pages (HTML, JSON, flux), qu'un visiteur demande une à une,
# et les fichiers (images, polices, scripts, icônes), qu'une seule page demande par dizaines.
# Au-delà : réponse 429, que la jail fail2ban kioske-debit compte.
limit_req_zone  $binary_remote_addr zone=kioske_pages:10m      rate=10r/s;
limit_req_zone  $binary_remote_addr zone=kioske_fichiers:10m   rate=100r/s;
limit_conn_zone $binary_remote_addr zone=kioske_connexions:10m;
NGINX
)"

# Blocs « location » communs aux configurations HTTP et HTTPS : la liste des adresses du site.
# Aucun add_header ici (voir CARTE_CACHE). __DOMAINE__ est remplacé plus bas.
EMPLACEMENTS="$(cat <<'NGINX'
    # ---------------------------------------------------------------------------------------------
    # Le site est statique : seules les adresses que le build produit sont servies. Tout le reste
    # tombe dans « location / » tout en bas (404, et une ligne dans le journal hors-site que lit
    # fail2ban). En ajoutant un fichier ou un dossier à la racine du site, l'ajouter ici aussi.
    # ---------------------------------------------------------------------------------------------

    # Accueil
    location = / {
        limit_req zone=kioske_pages burst=40 nodelay;
        try_files /index.html =404;
    }

    # Pages et données à la racine : accueil, page des flux, flux RSS, plan du site, index de recherche
    location ~ ^/(index\.html|rss\.html|rss\.xml|sitemap\.xml|robots\.txt|articles-index\.json)$ {
        limit_req zone=kioske_pages burst=40 nodelay;
        try_files $uri =404;
    }

    # Pages d'article et de catégorie : /articles/<id>-<titre>/ et /categories/<nom>/
    location ~ ^/(articles|categories)/[a-z0-9-]+(/|/index\.html)?$ {
        limit_req zone=kioske_pages burst=40 nodelay;
        try_files $uri $uri/ =404;
    }

    # Flux RSS par catégorie : /rss/<nom>.xml
    location ~ ^/rss/[a-z0-9-]+\.xml$ {
        limit_req zone=kioske_pages burst=40 nodelay;
        try_files $uri =404;
    }

    # Manifest PWA : type MIME des manifestes
    location = /manifest.json {
        limit_req zone=kioske_fichiers burst=300 nodelay;
        types { }
        default_type application/manifest+json;
    }

    # Scripts, icônes et image de partage à la racine
    location ~ ^/(theme\.js|sw\.js|favicon\.svg|preview\.png|apple-touch-icon\.png|icon-[0-9]+\.png)$ {
        limit_req zone=kioske_fichiers burst=300 nodelay;
        try_files $uri =404;
    }

    # Images de la veille et polices
    location ~ ^/(img/veille|fonts)/[A-Za-z0-9._-]+$ {
        limit_req zone=kioske_fichiers burst=300 nodelay;
        try_files $uri =404;
    }

    # Fichiers que navigateurs et robots demandent d'eux-mêmes et que le site n'a pas : 404 ordinaire,
    # sans passer par le journal hors-site (un visiteur ne doit pas être banni pour un favicon.ico).
    location ~ ^/(favicon\.ico|apple-touch-icon[a-z0-9-]*\.png|browserconfig\.xml|ads\.txt|app-ads\.txt|humans\.txt|security\.txt|fonts/?)$ {
        return 404;
    }
    location ^~ /.well-known/ {
        return 404;
    }

    # Fichiers cachés (.git, .env…) : refusés (la jail kioske-scan bannit à la première demande)
    location ~ /\. {
        return 404;
    }

    # Tout le reste n'existe pas sur ce site
    location / {
        access_log /var/log/nginx/__DOMAINE__.access.log;
        access_log /var/log/nginx/__DOMAINE__.hors-site.log;
        return 404;
    }
NGINX
)"
EMPLACEMENTS="${EMPLACEMENTS//__DOMAINE__/$DOMAINE}"

info()    { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
avert()   { printf '\033[1;33m[attention]\033[0m %s\n' "$*"; }
erreur()  { printf '\033[1;31m[erreur]\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "$EUID" -eq 0 && -z "${SUDO_USER:-}" ]]; then
    erreur "Lance ce script en utilisateur normal (meli), pas en root : il utilise sudo."
fi

MODE="installer"
while (( $# > 0 )); do
    case "$1" in
        --email) EMAIL="${2:-}"; shift 2 ;;
        --sans-certificat) SANS_CERT=1; shift ;;
        --desinstaller) MODE="desinstaller"; shift ;;
        *) erreur "Option inconnue : $1" ;;
    esac
done

# Écrit un fichier de configuration à partir de stdin, le teste, puis l'active.
# En cas d'échec de nginx -t, restaure l'ancien fichier (ou le supprime).
appliquer_config() {
    local tmp sauvegarde
    tmp="$(mktemp)"
    cat > "$tmp"
    sauvegarde="$(mktemp -u)"
    if [[ -f "$DISPO" ]]; then sudo cp -p "$DISPO" "$sauvegarde"; fi
    sudo install -m 644 "$tmp" "$DISPO"
    sudo ln -sfn "$DISPO" "$ACTIF"
    rm -f "$tmp"
    if ! sudo nginx -t 2>/tmp/nginx-test.$$; then
        cat /tmp/nginx-test.$$ >&2; rm -f /tmp/nginx-test.$$
        if [[ -f "$sauvegarde" ]]; then sudo cp -p "$sauvegarde" "$DISPO"; else sudo rm -f "$DISPO" "$ACTIF"; fi
        erreur "Configuration nginx invalide : l'état précédent a été rétabli."
    fi
    rm -f /tmp/nginx-test.$$
    sudo systemctl reload nginx
}

if [[ "$MODE" == "desinstaller" ]]; then
    info "Retrait du site $DOMAINE de nginx (les certificats sont conservés)"
    sudo rm -f "$ACTIF" "$DISPO"
    sudo nginx -t && sudo systemctl reload nginx
    info "Désinstallé."
    exit 0
fi

# 1. Paquets
manquants=()
for p in nginx certbot; do dpkg -s "$p" >/dev/null 2>&1 || manquants+=("$p"); done
if (( ${#manquants[@]} > 0 )); then
    info "Installation des paquets : ${manquants[*]}"
    sudo apt-get update
    sudo apt-get install -y "${manquants[@]}"
else
    info "nginx et certbot déjà installés"
fi

# 2. nginx (www-data) doit pouvoir lire la racine web
[[ -d "$RACINE" ]] || erreur "$RACINE absent : lance d'abord l'installation serveur (installer_serveur.sh)."
if ! sudo -u www-data test -x "$RACINE" || ! sudo -u www-data test -r "$RACINE"; then
    erreur "nginx (www-data) ne peut pas lire $RACINE. Relance deploy/installer_serveur.sh (il crée ce dossier avec les bons droits)."
fi
[[ -f "$RACINE/index.html" ]] || avert "$RACINE/index.html n'existe pas encore : le site sera vide jusqu'à la première publication."

sudo mkdir -p "$WEBROOT_ACME/.well-known/acme-challenge"

# Blocs communs aux deux configurations (HTTP et HTTPS), écrits dans les heredocs ci-dessous.
# Si la page de ban fail2ban existe, elle est incluse : sinon nginx -t échouerait.
if [[ -f "$SNIPPET_BAN" ]]; then
    INCLUDE_BAN="    include $SNIPPET_BAN; # fail2ban-banni"
else
    INCLUDE_BAN="    # page de ban fail2ban absente : lancer deploy/kioske.sh fail2ban, puis relancer ce script"
fi
PROTECTIONS="$(cat <<'NGINX'
    # Ne pas annoncer la version de nginx
    server_tokens off;

    # Site statique : seules les lectures sont acceptées
    if ($request_method !~ ^(GET|HEAD)$) {
        return 405;
    }

    # Site statique : aucun envoi de données, connexions courtes, peu de connexions par adresse IP
    client_max_body_size 1k;
    client_body_timeout 5s;
    client_header_timeout 10s;
    send_timeout 15s;
    keepalive_timeout 30s;
    limit_conn kioske_connexions 40;
    limit_conn_status 429;
    limit_req_status 429;

    # En-têtes de sécurité (always : aussi sur les réponses d'erreur)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "__CSP__" always;
    # Durée de cache : voir la table « map » en tête de fichier. Sans « always » : pas sur les erreurs.
    add_header Cache-Control $kioske_cache_control;
    # Langue des pages (français) : voir la table « map » en tête de fichier.
    add_header Content-Language $kioske_langue;
NGINX
)"
PROTECTIONS="${PROTECTIONS//__CSP__/$CSP}"

# 3. Configuration HTTP seule : sert le site directement, sans redirection
info "Configuration HTTP seule"
appliquer_config <<EOF
# Généré par deploy/deployer_nginx.sh : ne pas éditer à la main (relancer le script).
$CARTE_CACHE

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAINE;

$INCLUDE_BAN

$PROTECTIONS

    root $RACINE;
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT_ACME;
    }

$EMPLACEMENTS

    access_log /var/log/nginx/$DOMAINE.access.log;
    error_log  /var/log/nginx/$DOMAINE.error.log;
}
EOF
info "Site HTTP en ligne"

# 4. Certificat
IP_SERVEUR="$(hostname -I 2>/dev/null | awk '{print $1}')"  # IP locale, indicative seulement
IP_DNS="$(getent ahostsv4 "$DOMAINE" 2>/dev/null | awk 'NR==1{print $1}' || true)"  # vide si le DNS ne répond pas
if [[ -d "$CERT_DIR" ]]; then
    info "Certificat déjà présent dans $CERT_DIR"
elif (( SANS_CERT == 1 )); then
    info "Option --sans-certificat : pas de HTTPS pour l'instant"
elif [[ -z "$EMAIL" ]]; then
    avert "Pas d'adresse e-mail (--email) : pas de certificat. Relance avec --email pour activer le HTTPS."
elif [[ -z "$IP_DNS" ]]; then
    avert "Le DNS de $DOMAINE ne répond pas : certificat non demandé. Relance le script quand il est en place."
else
    # Derrière une box, le DNS donne l'IP publique et le serveur n'en connaît que l'IP locale :
    # on ne compare pas. On tente directement, et certbot dira si le domaine atteint le serveur.
    info "DNS de $DOMAINE : $IP_DNS (IP locale du serveur : $IP_SERVEUR, normal derrière une box)"
    info "Demande du certificat Let's Encrypt"
    if sudo certbot certonly --webroot -w "$WEBROOT_ACME" \
        -d "$DOMAINE" \
        --email "$EMAIL" --agree-tos --no-eff-email -n \
        --deploy-hook "systemctl reload nginx"; then
        info "Certificat obtenu"
    else
        avert "Échec de certbot : le site reste en HTTP. Voir /var/log/letsencrypt/letsencrypt.log"
    fi
fi

# 5. Configuration HTTPS, si le certificat existe
if [[ -d "$CERT_DIR" ]]; then
    info "Configuration HTTPS"
    appliquer_config <<EOF
# Généré par deploy/deployer_nginx.sh : ne pas éditer à la main (relancer le script).
$CARTE_CACHE

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAINE;

$INCLUDE_BAN

    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT_ACME;
    }

    location / {
        return 301 https://$DOMAINE\$request_uri;
    }

    # Même journal que le HTTPS : les sondes faites en HTTP comptent aussi pour fail2ban
    access_log /var/log/nginx/$DOMAINE.access.log;
    error_log  /var/log/nginx/$DOMAINE.error.log;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAINE;

$INCLUDE_BAN

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    # TLS 1.3 seul : TLS 1.0, 1.1 et 1.2 sont refusés. (Pour réaccepter 1.2, ajouter « TLSv1.2 » ici.)
    ssl_protocols       TLSv1.3;
    # Courbes elliptiques modernes uniquement ; pas de DH classique, pas de reprise de session par ticket.
    ssl_ecdh_curve      X25519:secp384r1;
    ssl_prefer_server_ciphers off;
    ssl_session_tickets off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    # 0-RTT (early data) refusé : pas de rejeu possible.
    ssl_early_data      off;

    # HTTPS seul, pendant un an
    add_header Strict-Transport-Security "max-age=31536000" always;

$PROTECTIONS

    root $RACINE;
    index index.html;

$EMPLACEMENTS

    access_log /var/log/nginx/$DOMAINE.access.log;
    error_log  /var/log/nginx/$DOMAINE.error.log;
}
EOF
    info "HTTPS actif sur https://$DOMAINE"
else
    info "Site en HTTP seulement pour l'instant : http://$DOMAINE"
fi

info "État : sudo nginx -t && systemctl status nginx --no-pager"
