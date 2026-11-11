"""Chemins du projet et réglages lus dans kioske.cfg. Aucun autre module n'écrit de chemin en dur."""
from __future__ import annotations

import configparser
from pathlib import Path

PAQUET = Path(__file__).resolve().parent  # kioske/
ROOT = PAQUET.parent                      # racine du projet

CONFIG = ROOT / "kioske.cfg"

# Sources de la veille (écrites à la main)
SOURCES = ROOT / "sources"
FLUX_RSS = SOURCES / "RSS_feeds.txt"
CHAINES_TWITCH = SOURCES / "Twitch_feeds.txt"
REGLAGES_FLUX = SOURCES / "flux_corrige_main.txt"
BLOC_IMMUABLE = ROOT / "accueil" / "bloc_immuable.html"  # cagnotte, Discord, code de conduite
STATIC = ROOT / "static"  # favicon, icône, image de partage, polices : recopiés tels quels dans build/

# Données (jamais publiées)
DATA = ROOT / "data"
HISTORIQUE_DB = DATA / "historique.db"
EMPREINTE = DATA / "immuable.json"
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


DOMAINE = valeur("site", "domaine")
URL_SITE = f"https://{DOMAINE}"
NOM_SITE = valeur("site", "nom")
SLOGAN = valeur("site", "slogan")
RACINE_WEB = Path(valeur("serveur", "racine_web"))

RSS_MAX = entier("veille", "articles_flux_rss")
TWITCH_SCAN = entier("veille", "videos_par_chaine")
ARTICLES_PAR_SOURCE = entier("veille", "articles_par_source")  # 0 = tous
DELAI_ECHEC = entier("veille", "delai_nouvel_essai_heures") * 3600  # secondes
