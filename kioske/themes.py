"""Thèmes du site, décrits dans kioske.cfg (sections [theme.<nom>]).

Le build pose le thème par défaut sur <html> (attributs data-…) et donne la liste des thèmes à
static/theme.js, qui applique le choix du visiteur et fabrique la pluie. Tout le CSS, thèmes compris,
est dans kioske/style.css : ce module n'en écrit pas.
"""
from __future__ import annotations

import configparser
import json

from .config import CFG, CONFIG, PAQUET
from .texte import esc

CSS = (PAQUET / "style.css").read_text(encoding="utf-8")

# Fonds possibles (clé `fond` d'un thème). Leur dessin est dans style.css : :root[data-fond="…"].
FONDS = ("etoiles", "noir")


def charger_themes(cfg: configparser.ConfigParser = CFG) -> tuple[list[dict], str]:
    """Tous les thèmes de kioske.cfg, et le thème par défaut (clé `theme` de [site]).
    S'arrête avec un message clair si une valeur manque ou est invalide."""
    chemin = CONFIG
    defaut = cfg.get("site", "theme", fallback="")
    themes = []
    for section in cfg.sections():
        if not section.startswith("theme."):
            continue
        ident = section.removeprefix("theme.")
        try:
            theme = {k: cfg.get(section, k) for k in ("nom", "fond", "pluie", "opacite_panneau")}
        except configparser.Error as exc:
            raise SystemExit(f"thème « {ident} » incomplet dans {chemin.name} : {exc}")
        if theme["fond"] not in FONDS:
            raise SystemExit(f"fond « {theme['fond']} » inconnu dans {ident} (valeurs : {', '.join(FONDS)})")
        try:
            opacite = int(theme["opacite_panneau"])
        except ValueError:
            raise SystemExit(f"opacite_panneau « {theme['opacite_panneau']} » dans {ident} : nombre entier attendu (0 à 100)")
        if not 0 <= opacite <= 100:
            raise SystemExit(f"opacite_panneau {opacite} dans {ident} : valeur entre 0 et 100 attendue")
        theme["opacite_panneau"] = opacite
        if theme["pluie"] not in ("oui", "non"):
            raise SystemExit(f"pluie « {theme['pluie']} » dans {ident} : valeur attendue oui ou non")
        theme["pluie"] = theme["pluie"] == "oui"
        theme["id"] = ident
        themes.append(theme)
    ids = [t["id"] for t in themes]
    if not themes:
        raise SystemExit(f"aucun thème dans {chemin.name} (sections [theme.<nom>])")
    if defaut not in ids:
        raise SystemExit(f"thème par défaut « {defaut} » absent de {chemin.name} (disponibles : {', '.join(ids)})")
    return themes, defaut


def _morceaux_de_page() -> tuple[str, str, str, str]:
    """Les quatre morceaux que chaque page reprend tels quels (voir les constantes ci-dessous)."""
    themes, defaut = charger_themes()
    d = next(t for t in themes if t["id"] == defaut)
    attributs = f'data-theme="{esc(d["id"])}" data-fond="{d["fond"]}" data-pluie="{"oui" if d["pluie"] else "non"}"'
    variables = f"--panneau-opacite: {d['opacite_panneau'] / 100:g};"
    donnees = json.dumps(
        {"defaut": defaut,
         "themes": [{"id": t["id"], "fond": t["fond"], "pluie": t["pluie"], "opacite": t["opacite_panneau"]}
                    for t in themes]},
        ensure_ascii=False).replace("</", "<\\/")
    script = (f'<script type="application/json" id="kioske-themes">{donnees}</script>\n'
              '<script src="/theme.js"></script>')
    boutons = "".join(
        f'<button type="button" class="theme-bouton" data-theme-id="{esc(t["id"])}"'
        f' aria-pressed="{"true" if t["id"] == defaut else "false"}">{esc(t["nom"])}</button>'
        for t in themes
    )
    choix = f'<div class="choix-theme" role="group" aria-label="Thème du site">{boutons}</div>'
    return attributs, variables, script, choix


# ATTRIBUTS_HTML : attributs du thème par défaut, à poser sur <html>.
# VARIABLES_HTML : sa variable CSS, à mettre dans l'attribut style de <html>.
# SCRIPT_THEME   : à mettre dans <head> — liste des thèmes, puis static/theme.js.
# CHOIX_THEME    : boutons de choix du thème (sans JavaScript, seul le thème par défaut s'affiche).
ATTRIBUTS_HTML, VARIABLES_HTML, SCRIPT_THEME, CHOIX_THEME = _morceaux_de_page()
