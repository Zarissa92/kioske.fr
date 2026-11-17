"""Construction du site dans build/ : page d'accueil, flux RSS, images, fichiers statiques.

Usage (voir bin/build_site.py) :
    build_site.py                 # build complet : flux, Twitch, aperçus, images, page, flux RSS
    build_site.py --simple        # page seule, sans réseau : articles de la base, caches existants
    build_site.py --no-twitch     # sans les chaînes Twitch
    build_site.py --no-previews   # sans visiter les pages (rapide)
    build_site.py --no-cache      # ignore les caches (aperçus et Twitch)
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import filecmp
import hashlib
import re
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from . import apercus
from .config import (ARTICLES_PAR_SOURCE, BUILD, CHAINES_TWITCH, DOMAINE, DOSSIER_RSS_CATEGORIES, FLUX_RSS,
                     HISTORIQUE_DB, NOM_PAGE, PAQUET, REGLAGES_FLUX, ROOT, STATIC, TWITCH_SCAN, URL_SITE, RSS_MAX)
from .flux import load_feed
from .historique import Historique
from .images import appliquer_images, purger_images, telecharger_images
from .previews import generer_previews
from .ressources import ecrire_ressources
from .rendu import render_page, render_rss_page
from .rendu_statique import render_article_page, render_category_page
from .rss import render_rss
from .sources import AUTRES, ordre_des_categories, read_categories, read_feeds, read_local, read_twitch, read_panneaux
from .texte import slugs_categories, article_id, slug_article
from .twitch import load_twitch
from .verrou import verrou


def analyser_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-rss", dest="rss", type=Path, default=FLUX_RSS, metavar="FICHIER",
                        help="fichier des flux RSS (défaut : sources/RSS_feeds.txt)")
    parser.add_argument("-tw", dest="tw", type=Path, default=CHAINES_TWITCH, metavar="FICHIER",
                        help="fichier des chaînes Twitch (défaut : sources/Twitch_feeds.txt)")
    parser.add_argument("--local", type=Path, default=REGLAGES_FLUX,
                        help="réglages locaux (défaut : sources/flux_corrige_main.txt)")
    parser.add_argument("--no-twitch", action="store_true", help="ne pas inclure les chaînes Twitch")
    parser.add_argument("--no-previews", action="store_true", help="ne pas visiter les pages pour les aperçus")
    parser.add_argument("--no-cache", action="store_true", help="ignorer les caches (aperçus et Twitch)")
    parser.add_argument("--simple", action="store_true",
                        help="reconstruit seulement la page à partir de la base et des caches : "
                             "aucun appel réseau, flux RSS non réécrits")
    return parser.parse_args(argv)


def limiter_par_source(items: list[dict], maximum: int) -> list[dict]:
    """Garde les `maximum` articles les plus récents de chaque source (0 = tous)."""
    if maximum <= 0:
        return items
    epoque = datetime.min.replace(tzinfo=timezone.utc)
    gardes, compte = [], {}
    for item in sorted(items, key=lambda i: i["date"] or epoque, reverse=True):
        compte[item["key"]] = compte.get(item["key"], 0) + 1
        if compte[item["key"]] <= maximum:
            gardes.append(item)
    return gardes


def copier_si_change(source: Path, cible: Path) -> bool:
    """Copie atomique (fichier temporaire puis renommage). False si la cible est déjà identique."""
    if cible.exists() and filecmp.cmp(source, cible, shallow=False):
        return False
    cible.parent.mkdir(parents=True, exist_ok=True)
    tmp = cible.with_name(cible.name + ".tmp")
    shutil.copyfile(source, tmp)
    tmp.replace(cible)
    return True


def ecrire_si_change(cible: Path, texte: str) -> None:
    if not cible.exists() or cible.read_text(encoding="utf-8") != texte:
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_text(texte, encoding="utf-8")


def copier_css_themes() -> None:
    """Copie les CSS des thèmes de kioske/ directement dans build/ (pas de copie tenue dans static/)."""
    from .themes import charger_themes

    try:
        themes, _ = charger_themes()
        for theme in themes:
            css_file = theme.get("css", "")
            if css_file:
                css_file = css_file.lstrip("/")
                source = PAQUET / css_file
                if source.exists():
                    cible = BUILD / css_file
                    copier_si_change(source, cible)
    except SystemExit:
        pass  # kioske.cfg vide ou incohérent, thèmes non disponibles


def copier_statiques() -> None:
    """Recopie static/ dans build/ : build/ contient ainsi tout le site, et rien d'autre n'est publié."""
    for source in sorted(STATIC.rglob("*")):
        if source.is_file():
            copier_si_change(source, BUILD / source.relative_to(STATIC))
    ecrire_si_change(BUILD / "robots.txt", f"User-agent: *\nAllow: /\nSitemap: {URL_SITE}/sitemap.xml\n")
    ecrire_si_change(BUILD / "sitemap.xml",
                     '<?xml version="1.0" encoding="UTF-8"?>\n'
                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                     f"<url><loc>{URL_SITE}/</loc><changefreq>hourly</changefreq></url>\n"
                     "</urlset>\n")


# Version du cache du service worker : empreinte des fichiers qu'il met en cache (static/ et les feuilles
# de thème). Elle change seulement si l'un d'eux change, donc un build sans changement ne vide pas le cache.
MOTIF_VERSION_SW = re.compile(r"const CACHE_VERSION = '[^']*';")


def version_service_worker() -> str:
    """Calcule l'empreinte et l'écrit dans build/sw.js (CACHE_VERSION). Renvoie la version."""
    sources = sorted(f for f in STATIC.rglob("*") if f.is_file() and f.name != "sw.js")
    sources += sorted(PAQUET.glob("style_*.css"))
    sources.append(STATIC / "sw.js")  # le texte du service worker compte aussi (liste des fichiers en cache)
    h = hashlib.sha256()
    for f in sources:
        nom = f.relative_to(STATIC) if f.is_relative_to(STATIC) else f.name
        h.update(str(nom).encode("utf-8") + b"\0" + f.read_bytes() + b"\0")
    version = f"kioske-{h.hexdigest()[:12]}"
    cible = BUILD / "sw.js"
    texte = cible.read_text(encoding="utf-8")
    nouveau, n = MOTIF_VERSION_SW.subn(f"const CACHE_VERSION = '{version}';", texte)
    if n != 1:
        raise SystemExit("build/sw.js : ligne CACHE_VERSION introuvable")
    ecrire_si_change(cible, nouveau)
    return version


def ecrire_page(items: list[dict], previews: dict[str, dict], categories: dict[str, str], panneaux: dict[str, str] | None = None) -> None:
    """Écrit build/index.html."""
    panneaux = panneaux or {}
    page = render_page(items, previews, categories, panneaux)
    BUILD.mkdir(parents=True, exist_ok=True)
    sortie = BUILD / NOM_PAGE
    tmp = sortie.with_name(sortie.name + ".tmp")
    tmp.write_text(page, encoding="utf-8")
    tmp.replace(sortie)
    print(f"OK : {len(items)} article(s) écrits dans {sortie.relative_to(ROOT)}")


def ecrire_code_de_conduite(items: list[dict]) -> None:
    """Écrit build/code-de-conduite.html : page statique, comme la page RSS."""
    from .ressources import ecrire_fichier
    from .rendu import render_code_de_conduite
    ecrire_fichier(BUILD / "code-de-conduite.html", render_code_de_conduite(len(items), len({i["key"] for i in items})))


def ecrire_flux_rss(items: list[dict], categories: dict[str, str]) -> None:
    flux = BUILD / "rss.xml"
    flux.write_text(render_rss(items), encoding="utf-8")
    print(f"OK : flux RSS écrit dans {flux.relative_to(ROOT)} ({min(len(items), RSS_MAX)} article(s))")

    # Pas de flux par catégorie : leur adresse dépend du nom de la catégorie, et elle disparaîtrait avec
    # une réorganisation. Le dossier rss/ d'un ancien build est retiré ; la publication retire ses copies.

def ecrire_page_rss(categories: dict[str, str], items: list[dict]) -> None:
    """Écrit build/rss.html : page de découverte des flux RSS par catégorie."""
    BUILD.mkdir(parents=True, exist_ok=True)
    page = render_rss_page(categories, items)
    sortie = BUILD / "rss.html"
    tmp = sortie.with_name(sortie.name + ".tmp")
    tmp.write_text(page, encoding="utf-8")
    tmp.replace(sortie)
    print(f"OK : page RSS écrite dans {sortie.relative_to(ROOT)}")


def ecrire_pages_articles(items: list[dict], previews: dict[str, dict]) -> None:
    """Écrit les pages statiques pour chaque article dans build/articles/."""
    from .rendu import valeurs_barre
    barre = valeurs_barre(len(items), len({i["key"] for i in items}))
    articles_dossier = BUILD / "articles"
    written = 0

    # Générer les previews "carte Pokémon" pour les articles
    print("[previews] génération des previews 'carte Pokémon'...")
    images_map = {item["link"]: item.get("image", "") for item in items}
    article_previews = generer_previews(items, images_map, telecharger=True)

    # Trier par date décroissante (plus récents en premier) pour Précédent/Suivant
    epoque = datetime.min.replace(tzinfo=timezone.utc)
    items_sorted = sorted(items, key=lambda i: i["date"] or epoque, reverse=True)

    for item in items_sorted:
        art_id = article_id(item["link"])
        title = previews.get(item["link"], {}).get("title") or item["title"]
        art_slug = slug_article(title, item["link"])

        # Chercher prev/next en fonction de la position dans la liste triée
        prev_article = None
        next_article = None
        for i, other in enumerate(items_sorted):
            if other["link"] == item["link"]:
                if i > 0:
                    prev_article = items_sorted[i - 1]
                if i < len(items_sorted) - 1:
                    next_article = items_sorted[i + 1]
                break

        # Utiliser le preview généré s'il existe
        preview_image = article_previews.get(item["link"], "")
        page = render_article_page(item, previews.get(item["link"], {}), prev_article, next_article, previews, preview_image, barre=barre)
        sortie = articles_dossier / f"{art_id}-{art_slug}" / "index.html"
        ecrire_si_change(sortie, page)
        written += 1

    # Purger les anciens articles
    if articles_dossier.exists():
        attendus = {f"{article_id(i['link'])}-{slug_article(previews.get(i['link'], {}).get('title') or i['title'], i['link'])}" for i in items}
        for ancien in articles_dossier.iterdir():
            if ancien.is_dir() and ancien.name not in attendus:
                shutil.rmtree(ancien)
                print(f"supprimé (article disparu) : {ancien.relative_to(ROOT)}")

    print(f"OK : {written} page(s) d'article(s) écrite(s) dans {articles_dossier.relative_to(ROOT)}/")


def ecrire_pages_categories(items: list[dict], previews: dict[str, dict],
                            categories: dict[str, str]) -> None:
    """Écrit les pages statiques pour chaque catégorie dans build/categories/."""
    from .rendu import valeurs_barre
    barre = valeurs_barre(len(items), len({i["key"] for i in items}))
    # Grouper les articles par source
    groupes: dict[str, list[dict]] = {}
    noms: dict[str, str] = {}
    for item in items:
        groupes.setdefault(item["key"], []).append(item)
        noms.setdefault(item["key"], item["source"])

    # Regrouper par catégorie
    par_categorie: dict[str, list[str]] = {}
    for cle in groupes:
        par_categorie.setdefault(categories.get(cle, AUTRES), []).append(cle)

    categories_dossier = BUILD / "categories"
    cat_slugs = slugs_categories(list(par_categorie.keys()))
    written = 0

    for categorie, sources_keys in par_categorie.items():
        cat_slug = cat_slugs[categorie]
        # Assembler TOUS les articles de la catégorie et les trier par date
        all_articles = []
        for source_key in sources_keys:
            all_articles.extend(groupes[source_key])

        # Trier par date décroissante (plus récents d'abord)
        all_articles.sort(key=lambda i: i["date"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        page = render_category_page(categorie, all_articles, previews, barre=barre)
        sortie = categories_dossier / cat_slug / "index.html"
        ecrire_si_change(sortie, page)
        written += 1

    # Purger les anciennes catégories
    if categories_dossier.exists():
        attendus = set(cat_slugs.values())
        for ancien in categories_dossier.iterdir():
            if ancien.is_dir() and ancien.name not in attendus:
                shutil.rmtree(ancien)
                print(f"supprimé (catégorie disparue) : {ancien.relative_to(ROOT)}")

    print(f"OK : {written} page(s) de catégorie(s) écrite(s) dans {categories_dossier.relative_to(ROOT)}/")


def ecrire_index_articles(items: list[dict], previews: dict[str, dict], categories: dict[str, str]) -> None:
    """Génère un index JSON de tous les articles pour la recherche JavaScript."""
    index = []
    for item in items:
        # Utiliser le titre du preview si disponible (pour que les slugs correspondent)
        title = previews.get(item["link"], {}).get("title") or item.get("title", "")
        summary = item.get("summary", "")
        source = item.get("source", "")
        category = categories.get(item["key"], "")
        link = item.get("link", "")
        image = item.get("image", "")
        date = item.get("date")

        # Générer l'ID et le slug pour construire l'URL
        ident = article_id(link)
        slug = slug_article(title, link)
        url = f"/articles/{ident}-{slug}/"

        # Date au format français
        date_str = ""
        if date:
            date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if hasattr(date, 'astimezone') else date
            date_str = f"{date_paris:%d/%m/%Y}"

        # Host du lien
        host = urlparse(link).netloc.removeprefix("www.")

        # Chemins absolus pour les images (commencent par /)
        image_abs = f"/{image}" if image and not image.startswith("/") else image

        index.append({
            "title": title,
            "summary": summary,
            "source": source,
            "category": category,
            "link": link,
            "url": url,
            "image": image_abs,
            "date": date_str,
            "host": host,
            "searchText": f"{title} {summary} {source} {category}".lower()
        })

    output_file = BUILD / "articles-index.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"index : {len(index)} article(s) indexé(s) dans {output_file.relative_to(ROOT)}")


def migrer_ancienne_structure() -> None:
    """Transition (réorganisation du 2026-11-11) : les images étaient dans img/ à la racine du projet.
    Elles sont déplacées une fois dans build/img/, pour ne pas tout retélécharger."""
    ancien, nouveau = ROOT / "img", BUILD / "img"
    if ancien.is_dir() and not nouveau.exists():
        BUILD.mkdir(parents=True, exist_ok=True)
        ancien.rename(nouveau)
        print(f"migration : {ancien.name}/ déplacé dans {nouveau.relative_to(ROOT)}/")


def construire(args: argparse.Namespace) -> None:
    """Construit build/. Un seul build à la fois (verrou partagé avec la publication)."""
    with verrou():
        print("\n" + "="*60)
        print("CONSTRUCTION DU SITE")
        print("="*60 + "\n")

        migrer_ancienne_structure()

        # === Chargement des sources ===
        print("1. CHARGEMENT DES SOURCES")
        ignored, names = read_local(args.local)
        urls = [u for u in read_feeds(args.rss) if u not in ignored]
        chaines = read_twitch(args.tw)
        print(f"   • {len(urls)} flux RSS dans {args.rss.name} ({len(ignored)} ignoré(s))")
        print(f"   • {len(chaines)} chaîne(s) Twitch")
        sources_actives = set(urls) | {f"twitch:{n}" for n in chaines}
        print(f"   → {len(sources_actives)} source(s) active(s)\n")

        # === Chargement des articles ===
        print("2. CHARGEMENT DES ARTICLES")
        historique = Historique(HISTORIQUE_DB)
        if not args.simple:
            items = []
            print(f"   • Lecture des flux RSS...")
            with cf.ThreadPoolExecutor(max_workers=6) as pool:
                for feed_items in pool.map(lambda u: load_feed(u, names), urls):
                    items.extend(feed_items)
            print(f"      → {len(items)} article(s) trouvé(s)")

            if not args.no_twitch:
                print(f"   • Chargement Twitch...")
                twitch_items = load_twitch(chaines, TWITCH_SCAN, use_cache=not args.no_cache)
                items.extend(twitch_items)
                print(f"      → {len(twitch_items)} vidéo(s) Twitch")

            historique.enregistrer(items)
            print(f"   • Historique enregistré\n")
        else:
            print(f"   • Mode --simple (aucun appel réseau)\n")

        # On affiche les articles des sources encore listées (les autres restent en base).
        items = limiter_par_source(historique.charger(sources_actives), ARTICLES_PAR_SOURCE)
        historique.fermer()
        print(f"   → {len(items)} article(s) affiché(s) pour {len(sources_actives)} source(s)\n")

        # === Génération des aperçus ===
        print("3. GÉNÉRATION DES APERÇUS")
        links = [i["link"] for i in items if i.get("kind") != "twitch"]
        if args.simple:
            print(f"   • Mode --simple : utilisation du cache existant")
            previews = apercus.apercus_des_liens(apercus.lire_cache(), links)
            print(f"      → {len(previews)} aperçu(s) du cache\n")
        elif args.no_previews:
            print(f"   • Mode --no-previews (pas d'aperçus)")
            previews = {}
            print(f"      → 0 aperçu(s)\n")
        else:
            print(f"   • Visite des pages pour les aperçus...")
            previews = apercus.load_previews(links, use_cache=not args.no_cache)
            print(f"      → {len(previews)} aperçu(s) généré(s)\n")

        # === Images ===
        print("4. TRAITEMENT DES IMAGES")
        image_urls = [i.get("image") for i in items] + [p.get("image") for p in previews.values()]
        image_urls = [u for u in image_urls if u]
        correspondance = telecharger_images(image_urls, telecharger=not args.simple)
        print(f"   • {len(correspondance)} image(s) traitée(s)")
        appliquer_images(items, previews, correspondance)

        # Purge : seulement avec les fichiers de sources habituels et tous les aperçus, sinon on effacerait à tort.
        if args.rss == FLUX_RSS and args.tw == CHAINES_TWITCH and not args.no_previews:
            supprimees = purger_images(set(correspondance.values()))
            if supprimees:
                print(f"   • {supprimees} image(s) inutilisée(s) supprimée(s)")
        print()

        # === Catégories ===
        print("5. LECTURE DES CATÉGORIES")
        categories = read_categories(args.rss, args.tw)
        panneaux = read_panneaux(args.rss, args.tw)
        nb_categories = len(set(categories.values()))
        print(f"   → {nb_categories} catégorie(s) lue(s)\n")

        # === Génération des pages statiques ===
        print("6. GÉNÉRATION DES PAGES STATIQUES")
        ecrire_pages_articles(items, previews)
        ecrire_pages_categories(items, previews, categories)

        # === Index JSON ===
        print("7. GÉNÉRATION DE L'INDEX")
        ecrire_index_articles(items, previews, categories)
        print()

        # === Pages principales ===
        print("8. GÉNÉRATION DES PAGES PRINCIPALES")
        ecrire_page(items, previews, categories, panneaux)
        ecrire_page_rss(categories, items)
        ecrire_code_de_conduite(items)
        if not args.simple:
            ecrire_flux_rss(items, categories)
        # Flux par catégorie : supprimés (leur adresse dépend du nom de la catégorie)
        shutil.rmtree(BUILD / DOSSIER_RSS_CATEGORIES, ignore_errors=True)
        print("   • Page Ressources (documents de ressources/)")
        ecrire_ressources(len(items), len({i["key"] for i in items}))

        # === Fichiers statiques ===
        print("9. COPIE DES FICHIERS STATIQUES")
        copier_css_themes()
        copier_statiques()
        print(f"   → Service worker : {version_service_worker()}")
        print(f"   → Fichiers statiques copiés\n")

        print("="*60)
        print("✓ CONSTRUCTION TERMINÉE")
        print("="*60 + "\n")


def main(argv: list[str] | None = None) -> None:
    construire(analyser_arguments(argv))
