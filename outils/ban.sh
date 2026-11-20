#!/usr/bin/env bash
# Bannit les IP qui ont plus de SEUIL réponses 404 dans le journal du site.
# Usage : bash bannir_404.sh --simulation   (liste seulement)
#         bash bannir_404.sh                (banit, via la jail fail2ban)
set -euo pipefail

JOURNAL=/var/log/nginx/kioske.fr.access.log
JAIL=kioske-scan
SEUIL=10404
SIMULATION=0
[[ "${1:-}" == "--simulation" ]] && SIMULATION=1

liste=$(mktemp)
trap 'rm -f "$liste"' EXIT

# Champ 9 = code HTTP dans le format combiné nginx
awk -v s="$SEUIL" '$9 == 404 { c[$1]++ } END { for (ip in c) if (c[ip] > s) print c[ip], ip }' "$JOURNAL" \
  | sort -rn > "$liste"

echo "IP à bannir : $(wc -l < "$liste")"
cat "$liste"

(( SIMULATION )) && { echo "Simulation : rien banni."; exit 0; }

while read -r nb ip; do
  sudo fail2ban-client set "$JAIL" banip "$ip"
  echo "banni : $ip ($nb x 404)"
done < "$liste"
