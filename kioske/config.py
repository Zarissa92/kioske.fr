"""Chemins du projet et réglages lus dans kioske.cfg. Aucun autre module n'écrit de chemin en dur."""
from __future__ import annotations

import configparser
import os
from pathlib import Path

PAQUET = Path(__file__).resolve().parent  # kioske/
ROOT = PAQUET.parent                      # racine du projet

CONFIG = ROOT / "kioske.cfg"

# Sources de la veille (écrites à la main)
SOURCES = ROOT / "sources"
FLUX_RSS = SOURCES / "RSS_feeds.txt"
CHAINES_TWITCH = SOURCES / "Twitch_feeds.txt"
REGLAGES_FLUX = SOURCES / "flux_corrige_main.txt"
MENU = ROOT / "menu"  # documents Markdown de la page Menu (kioske/menu.py), adresse /menu/
STATIC = ROOT / "static"  # favicon, icône, image de partage, polices : recopiés tels quels dans build/

# Données (jamais publiées)
DATA = ROOT / "data"
HISTORIQUE_DB = DATA / "historique.db"
CACHE_DIR = DATA / "cache"
VERROU = DATA / "build.lock"

# Site généré : tout ce qui est publié, et rien d'autre
BUILD = ROOT / "build"
NOM_PAGE = "index.html"
DOSSIER_IMAGES = "img/veille"  # relatif à build/ et à la racine web
DOSSIER_RSS_CATEGORIES = "rss"  # un flux par catégorie : rss/<nom>.xml


def lire_config(chemin: Path = CONFIG) -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    if not cfg.read(chemin, encoding="utf-8"):
        raise SystemExit(f"fichier de réglages introuvable : {chemin}")
    return cfg


CFG = lire_config()


def valeur(section: str, cle: str) -> str:
    """Valeur obligatoire de kioske.cfg. S'arrête avec un message clair si elle manque."""
    texte = CFG.get(section, cle, fallback="").strip()
    if not texte:
        raise SystemExit(f"{CONFIG.name} : la clé « {cle} » manque dans la section [{section}]")
    return texte


def entier(section: str, cle: str) -> int:
    texte = valeur(section, cle)
    if not texte.isdigit():
        raise SystemExit(f"{CONFIG.name} : [{section}] {cle} = « {texte} » : nombre entier positif attendu")
    return int(texte)


def entier_opt(section: str, cle: str, defaut: int) -> int:
    """Valeur optionnelle (entier avec défaut si absent ou vide)."""
    texte = CFG.get(section, cle, fallback="").strip()
    if not texte:
        return defaut
    if not texte.isdigit():
        raise SystemExit(f"{CONFIG.name} : [{section}] {cle} = « {texte} » : nombre entier positif attendu")
    return int(texte)


DOMAINE = valeur("site", "domaine")
URL_SITE = f"https://{DOMAINE}"
NOM_SITE = valeur("site", "nom")
RACINE_WEB = Path(os.environ.get("RACINE_WEB") or "/srv/kioske.fr")  # défaut : racine servie par nginx

RSS_MAX = entier("veille", "articles_flux_rss")
TWITCH_SCAN = entier("veille", "videos_par_chaine")
ARTICLES_PAR_SOURCE = entier("veille", "articles_par_source")  # 0 = tous
DELAI_ECHEC = entier("veille", "delai_nouvel_essai_heures") * 3600  # secondes

GALERIE_PANNEAU = entier_opt("site", "galerie_panneau", 1)
# Galerie « Les plus lus » (kioske/plus_lus.py) : journal d'accès de nginx, période et nombre d'articles.
JOURNAL_ACCES = Path(CFG.get("site", "plus_lus_journal", fallback="").strip() or f"/var/log/nginx/{DOMAINE}.access.log")
PLUS_LUS_JOURS = entier_opt("site", "plus_lus_jours", 7)
PLUS_LUS_NOMBRE = entier_opt("site", "plus_lus_nombre", 10)
IP_JAMAIS_COMPTEES = CFG.get("serveur", "ip_jamais_bannies", fallback="")
# Galeries de l'accueil affichées par défaut (1) ou masquées (0), avant tout choix du visiteur dans Paramètres.
# Écrites dans la page (kioske/themes.py), appliquées par static/theme.js.
GALERIES_DEFAUT = {
    "plus_lus": entier_opt("site", "galerie_plus_lus", 1) == 1,
    "grande": entier_opt("site", "grande_galerie", 0) == 1,
    "blocs": entier_opt("site", "galeries_blocs", 0) == 1,
}



def ordre_panneaux() -> list[str]:
    """Noms de panneaux demandés dans [panneaux] ordre (sans doublon). Vide = ordre par défaut."""
    demande = [p.strip() for p in CFG.get("panneaux", "ordre", fallback="").split(",") if p.strip()]
    return list(dict.fromkeys(demande))


ORDRE_PANNEAUX = ordre_panneaux()
