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

# Sources françaises (sources/francaises.txt) : elles passent en premier dans les galeries de l'accueil.
SOURCES_FRANCAISES_FICHIER = ROOT / "sources" / "francaises.txt"


def charger_sources_francaises(chemin: Path = SOURCES_FRANCAISES_FICHIER) -> frozenset[str]:
    """Noms des sources françaises : un par ligne, lignes vides et commentaires (#) ignorés. Fichier absent : vide."""
    if not chemin.exists():
        return frozenset()
    noms = (ligne.strip() for ligne in chemin.read_text(encoding="utf-8").splitlines())
    return frozenset(n for n in noms if n and not n.startswith("#"))


SOURCES_FRANCAISES = charger_sources_francaises()
# Tailles des galeries de l'accueil (kioske.cfg, [site]) :
#   grande_galerie_nombre     : cartes affichées dans « Les derniers articles »
#   grande_galerie_candidats  : cartes préparées par le site (le navigateur en garde des sources cochées) ; >= nombre
#   galeries_blocs_nombre     : cartes par galerie de catégorie
#   plus_lus_nombre           : cartes de « Les + vus » (déjà plus haut, voir PLUS_LUS_NOMBRE)
GALERIE_VISIBLES = entier_opt("site", "grande_galerie_nombre", 20)
GALERIE_CANDIDATS = entier_opt("site", "grande_galerie_candidats", 80)
NB_GALERIE_BLOC = entier_opt("site", "galeries_blocs_nombre", 12)
# Avance accordée aux articles des sources françaises dans les galeries (en heures). 0 = pas de priorité.
PRIORITE_FRANCAIS_HEURES = entier_opt("site", "priorite_francais_heures", 72)
if GALERIE_CANDIDATS < GALERIE_VISIBLES:
    raise SystemExit(f"{CONFIG.name} : grande_galerie_candidats ({GALERIE_CANDIDATS}) doit être au moins "
                     f"grande_galerie_nombre ({GALERIE_VISIBLES})")
# Galerie « Les plus lus » (kioske/plus_lus.py) : journal d'accès de nginx, période et nombre d'articles.
JOURNAL_PAR_DEFAUT = Path(f"/var/log/nginx/{DOMAINE}.access.log")


def journal_acces(valeur_cfg: str) -> Path:
    """Chemin du journal lu par « Les + vus ». Vide : celui de nginx pour le domaine. Une valeur qui n'est pas un
    chemin complet (ex. « 1 », pris pour un interrupteur) est ignorée, avec un avertissement : la galerie se règle
    par galerie_plus_lus, pas par cette clé."""
    texte = valeur_cfg.strip()
    if not texte:
        return JOURNAL_PAR_DEFAUT
    if not texte.startswith("/"):
        print(f"   ! {CONFIG.name} : plus_lus_journal = « {texte} » n'est pas un chemin (il doit commencer par /) : "
              f"journal par défaut ({JOURNAL_PAR_DEFAUT}). Pour afficher ou masquer la galerie : galerie_plus_lus.",
              flush=True)
        return JOURNAL_PAR_DEFAUT
    return Path(texte)


JOURNAL_ACCES = journal_acces(CFG.get("site", "plus_lus_journal", fallback=""))
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
