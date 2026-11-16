# lib_config.sh — lecture de kioske.cfg pour les scripts de deploy/. À charger avec « source », pas à lancer.
# Le fichier appelant doit avoir défini DOSSIER (racine du projet).
#
#   cfg <section> <clé>   affiche la valeur ; s'arrête si elle manque.
# Exemple : DOMAINE="$(cfg site domaine)"

CONFIG_KIOSKE="$DOSSIER/kioske.cfg"

cfg() {
    local section="$1" cle="$2" valeur
    [[ -f "$CONFIG_KIOSKE" ]] || { echo "[erreur] $CONFIG_KIOSKE introuvable" >&2; exit 1; }
    valeur="$(awk -v section="[$section]" -v cle="$cle" '
        /^[[:space:]]*\[/ { dans = ($0 == section); next }
        dans && /^[[:space:]]*[^#;[:space:]][^=]*=/ {
            nom = $0; sub(/[[:space:]]*=.*/, "", nom); sub(/^[[:space:]]+/, "", nom)
            if (nom == cle) { sub(/^[^=]*=[[:space:]]*/, ""); sub(/[[:space:]]+$/, ""); print; exit }
        }' "$CONFIG_KIOSKE")"
    [[ -n "$valeur" ]] || { echo "[erreur] kioske.cfg : clé « $cle » absente de la section [$section]" >&2; exit 1; }
    printf '%s\n' "$valeur"
}

# Demande un répertoire au terminal (Entrée = défaut). La variable d'environnement NOM, si elle est posée,
# est utilisée sans question (le timer systemd la reçoit de son unité). Sans terminal ni variable : erreur,
# le script ne devine pas un chemin.
# Usage : VAR="$(demander_repertoire NOM "question" "défaut")" || exit 1
demander_repertoire() {
    local nom="$1" question="$2" defaut="$3" valeur="${!1:-}" saisie=""
    if [[ -n "$valeur" ]]; then printf '%s' "$valeur"; return 0; fi
    if [[ ! -t 0 ]]; then
        echo "[erreur] $nom absent, et pas de terminal pour le demander (passe $nom=…)" >&2
        return 1
    fi
    read -rp "$question [$defaut] : " saisie
    printf '%s' "${saisie:-$defaut}"
}

# Demande une adresse IPv4 au terminal, redemandée tant qu'elle n'est pas valide. Même règle sans terminal.
# Usage : IP="$(demander_ipv4 NOM "question")" || exit 1
demander_ipv4() {
    local nom="$1" question="$2" valeur="${!1:-}" saisie=""
    if [[ -n "$valeur" ]]; then printf '%s' "$valeur"; return 0; fi
    if [[ ! -t 0 ]]; then
        echo "[erreur] $nom absent, et pas de terminal pour le demander (passe $nom=…)" >&2
        return 1
    fi
    while true; do
        read -rp "$question : " saisie
        if [[ "$saisie" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] && \
           (( BASH_REMATCH[1] <= 255 && BASH_REMATCH[2] <= 255 && BASH_REMATCH[3] <= 255 && BASH_REMATCH[4] <= 255 )); then
            printf '%s' "$saisie"
            return 0
        fi
        echo "  Adresse IPv4 invalide (exemple : 203.0.113.7)." >&2
    done
}
