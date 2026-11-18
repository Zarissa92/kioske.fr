#!/usr/bin/env bash
# Vérifie le site en ligne, en lecture seule (aucune connexion au serveur, aucune modification) :
# HTTPS et redirection, redirection des anciens flux RSS, icône, version du service worker.
# Lancer depuis le PC après une mise en ligne :  bash deploy/verifier_production.sh
# Code de sortie : 0 si tout est bon, 1 sinon.
set -u

DOMAINE="kioske.fr"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # dossier du projet, déduit du script
BUILD="$RACINE/build"
STATIC="$RACINE/static"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echecs=0
bon()    { echo "  OK    $*"; }
mauvais() { echo "  ÉCHEC $*"; echecs=$((echecs + 1)); }
entetes() { curl -sI --max-time 20 "$1" | tr -d '\r'; }
statut()  { entetes "$1" | awk 'NR==1 {print $2}'; }

echo "== HTTPS"
s=$(statut "https://$DOMAINE/")
[[ "$s" == "200" ]] && bon "https://$DOMAINE/ répond 200" || mauvais "https://$DOMAINE/ répond « ${s:-rien} » (attendu 200)"
entetes "https://$DOMAINE/" | grep -qi '^strict-transport-security' \
    && bon "HSTS présent" || mauvais "en-tête Strict-Transport-Security absent"

s=$(statut "http://$DOMAINE/")
loc=$(entetes "http://$DOMAINE/" | awk -F': ' 'tolower($1)=="location" {print $2}')
[[ "$s" == "301" && "$loc" == https://* ]] && bon "http:// redirige en 301 vers HTTPS" \
    || mauvais "http://$DOMAINE/ : $s, location « ${loc:-aucune} »"

echo "== Flux RSS"
s=$(statut "https://$DOMAINE/rss.xml")
[[ "$s" == "200" ]] && bon "rss.xml répond 200" || mauvais "rss.xml répond « ${s:-rien} »"
s=$(statut "https://$DOMAINE/rss/general.xml")
loc=$(entetes "https://$DOMAINE/rss/general.xml" | awk -F': ' 'tolower($1)=="location" {print $2}' | tr -d '\r')
[[ "$s" == "301" && "$loc" == "https://$DOMAINE/rss.xml" ]] && bon "ancien flux /rss/general.xml : 301 vers rss.xml" \
    || mauvais "ancien flux /rss/general.xml : $s, location « ${loc:-aucune} »"

echo "== Icône"
if [[ -f "$STATIC/icon-512.png" ]]; then
    curl -s --max-time 20 "https://$DOMAINE/icon-512.png" -o "$TMP/icone.png"
    if cmp -s "$TMP/icone.png" "$STATIC/icon-512.png"; then
        bon "icon-512.png en ligne = celle du projet"
    else
        mauvais "icon-512.png en ligne diffère de static/icon-512.png (cache ou publication incomplète ?)"
    fi
else
    mauvais "static/icon-512.png introuvable dans le projet"
fi

echo "== Service worker"
if [[ -f "$BUILD/sw.js" ]]; then
    v_local=$(grep -o "CACHE_VERSION = '[^']*'" "$BUILD/sw.js" | head -1)
    curl -s --max-time 20 "https://$DOMAINE/sw.js" -o "$TMP/sw.js"
    v_prod=$(grep -o "CACHE_VERSION = '[^']*'" "$TMP/sw.js" | head -1)
    [[ -n "$v_local" && "$v_local" == "$v_prod" ]] && bon "version en ligne = build local ($v_prod)" \
        || mauvais "version en ligne « ${v_prod:-?} » ≠ build local « ${v_local:-?} » : site pas à jour"
else
    mauvais "build/sw.js absent : lancer bin/build_site.py avant la vérification"
fi

echo "== Fichiers"
for f in pluie.js manifest.json; do
    s=$(statut "https://$DOMAINE/$f")
    [[ "$s" == "200" ]] && bon "$f répond 200" || mauvais "$f répond « ${s:-rien} »"
done

echo
if (( echecs )); then
    echo "DES ÉCHECS ($echecs) : voir ci-dessus"
    exit 1
fi
echo "TOUT EST BON : le site en ligne correspond au projet"
