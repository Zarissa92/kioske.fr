#!/usr/bin/env fish
# Annule la configuration Claude Code / Ollama (qwen3:14b) créée par setup-claude-ollama.fish

set -l model qwen3:14b
set -l cfg ~/.config/fish/config.fish
set -l marker_start "# >>> claude-ollama >>>"
set -l marker_end "# <<< claude-ollama <<<"
set -l remove_model 0

for arg in $argv
    if test "$arg" = "--remove-model"
        set remove_model 1
    end
end

# 1. Retire le bloc de config.fish
if test -f $cfg
    sed -i "/$marker_start/,/$marker_end/d" $cfg
    echo "Bloc retiré de $cfg"
else
    echo "Aucun fichier $cfg trouvé, rien à retirer"
end

# 2. Supprime les variables de la session fish en cours
for var in ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC CLAUDE_CODE_MAX_CONTEXT_TOKENS
    set -e $var 2>/dev/null
end

# 3. Supprime l'override systemd et restaure le service Ollama
if test -f /etc/systemd/system/ollama.service.d/context.conf
    sudo rm /etc/systemd/system/ollama.service.d/context.conf
    sudo rmdir /etc/systemd/system/ollama.service.d 2>/dev/null
    sudo systemctl daemon-reload
    sudo systemctl restart ollama
    echo "Override systemd supprimé, service Ollama redémarré avec sa configuration d'origine"
else
    echo "Pas d'override systemd trouvé, rien à faire côté Ollama"
end

# 4. Supprime le modèle si demandé
if test $remove_model -eq 1
    if command -q ollama
        ollama rm $model
        echo "Modèle $model supprimé"
    end
else
    echo "Modèle $model conservé (relancez avec --remove-model pour le supprimer)"
end

echo "Annulation terminée. Ouvrez un nouveau terminal pour appliquer les changements."
