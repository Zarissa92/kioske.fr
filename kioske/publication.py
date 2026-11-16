"""Publication : construit le site puis copie build/ dans la racine servie par nginx (sur le serveur).

build/ contient tout le site et rien d'autre : la page, les flux RSS, les images, les fichiers
statiques. Le code, les données et les fichiers de sources ne sont jamais publiés.

Usage (voir bin/publier_public.py) :
    publier_public.py                 # construit puis copie
    publier_public.py --sans-build    # copie seulement ce qui est déjà dans build/
    publier_public.py --simple        # construit sans réseau (build_site.py --simple), puis copie
    publier_public.py --public DOSSIER  # autre dossier de sortie (défaut : RACINE_WEB, sinon /srv/kioske.fr)
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from . import immuable
from .config import BUILD, DOSSIER_IMAGES, DOSSIER_RSS_CATEGORIES, NOM_PAGE, RACINE_WEB
from .construction import analyser_arguments, construire, copier_si_change
from .verrou import verrou

# Sans ces fichiers, rien n'est publié.
OBLIGATOIRES = [NOM_PAGE, "favicon.svg", "preview.png", "apple-touch-icon.png", "rss.xml", "fonts/russo-one.woff2"]
# Dossiers entièrement générés : un fichier qui n'est plus dans build/ est retiré de la racine web.
DOSSIERS_PURGES = [DOSSIER_IMAGES, DOSSIER_RSS_CATEGORIES]


def incrementer_service_worker() -> str | None:
    """Incrémente CACHE_VERSION dans build/sw.js (v1 → v2, etc.). Retourne la nouvelle version."""
    import re
    sw_path = BUILD / "sw.js"
    if not sw_path.exists():
        return None

    content = sw_path.read_text(encoding="utf-8")

    # Chercher 'kioske-v<number>' et incrémenter
    match = re.search(r"'kioske-v(\d+)'", content)
    if match:
        old_version = int(match.group(1))
        new_version = old_version + 1
        old_line = f"'kioske-v{old_version}'"
        new_line = f"'kioske-v{new_version}'"
        content = content.replace(old_line, new_line)
        sw_path.write_text(content, encoding="utf-8")
        return f"v{new_version}"
    return None


def publier(public: Path) -> None:
    page = BUILD / NOM_PAGE
    for nom in OBLIGATOIRES:
        if not (BUILD / nom).exists():
            raise SystemExit(f"Fichier absent, rien publié : build/{nom} (lance d'abord un build complet)")
    # La page n'est publiée que si son bloc immuable est intact (source et page générée).
    immuable.verifier_page(page.read_text(encoding="utf-8"))

    fichiers = [f for f in sorted(BUILD.rglob("*")) if f.is_file() and f.suffix != ".tmp"]
    copies = 0
    for source in fichiers:
        cible = public / source.relative_to(BUILD)
        if copier_si_change(source, cible):
            copies += 1
            print(f"[copie] build/{source.relative_to(BUILD)} -> {cible}", flush=True)

    retires = 0
    for dossier in DOSSIERS_PURGES:
        attendus = {f.name for f in (BUILD / dossier).glob("*")}
        for ancien in (public / dossier).glob("*"):
            if ancien.is_file() and ancien.name not in attendus:
                ancien.unlink()
                retires += 1
    print(f"OK : site publié dans {public} ({copies} fichier(s) copié(s), "
          f"{len(fichiers) - copies} déjà à jour, {retires} retiré(s))", flush=True)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sans-build", action="store_true", help="ne pas reconstruire : publier build/ tel quel")
    parser.add_argument("--simple", action="store_true", help="reconstruire sans réseau avant de publier")
    parser.add_argument("--public", type=Path, default=RACINE_WEB,
                        help=f"dossier de sortie (défaut : {RACINE_WEB})")
    args = parser.parse_args(argv)

    debut = datetime.now(timezone.utc)
    sw_version = None
    with verrou():  # le build et la copie forment un tout : pas de build concurrent entre les deux
        if not args.sans_build:
            construire(analyser_arguments(["--simple"] if args.simple else []))
            sw_version = incrementer_service_worker()
        publier(args.public)
    fin = datetime.now(timezone.utc)
    duree = fin - debut
    print("="*60)
    if sw_version:
        print(f"Service Worker : {sw_version}")
    print(f"Heure de fin : {fin.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"Durée totale : {duree.total_seconds():.1f}s")
    print("="*60 + "\n")
