#!/usr/bin/env bash
# Bannit les IP qui ont plus de SEUIL réponses 404 dans le journal du site.
# Usage : bash outils/ban.sh --simulation   (liste seulement)
#         bash outils/ban.sh                (bannit, via la jail fail2ban)
#         SEUIL=50 bash outils/ban.sh --simulation   (autre seuil)
set -euo pipefail

JOURNAL="${JOURNAL:-/var/log/nginx/kioske.fr.access.log}"
JAIL="${JAIL:-kioske-scan}"
SEUIL="${SEUIL:-100}"   # nombre de 404 au-delà duquel une IP est bannie
SIMULATION=0
[[ "${1:-}" == "--simulation" ]] && SIMULATION=1

[[ "$SEUIL" =~ ^[0-9]+$ ]] || { echo "SEUIL doit être un nombre entier : $SEUIL" >&2; exit 1; }

liste=$(mktemp)
trap 'rm -f "$liste"' EXIT

# Champ 9 = code HTTP dans le format combiné nginx
awk -v s="$SEUIL" '$9 == 404 { c[$1]++ } END { for (ip in c) if (c[ip] > s) print c[ip], ip }' "$JOURNAL" \
  | sort -rn > "$liste"

echo "IP à bannir (plus de $SEUIL réponses 404) : $(wc -l < "$liste")"
cat "$liste"

(( SIMULATION )) && { echo "Simulation : rien banni."; exit 0; }

while read -r nb ip; do
  sudo fail2ban-client set "$JAIL" banip "$ip"
  echo "banni : $ip ($nb x 404)"
done < "$liste"
