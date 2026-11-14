"""Rendu HTML de la page d'accueil (le KiosKe) et de la page des flux RSS.

Le squelette des pages est dans kioske/gabarits/ (accueil.html, rss.html), le CSS dans kioske/style.css
et le JavaScript dans kioske/js/. Ce module fabrique les morceaux qui dépendent des articles."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from . import immuable
from .config import DOMAINE, DOSSIER_RSS_CATEGORIES, NOM_SITE, URL_SITE, CFG
from .gabarits import remplir
from .javascript import (JS_ACCUEIL, JS_CARTE_OUVERTE, JS_DONNEES_ACCUEIL, JS_FAVORIS, JS_GALERIE,
                         JS_INSTALLATION_PWA, JS_PAGE_RSS, JS_PARTAGE, JS_RETOUR_APP, JS_SERVICE_WORKER,
                         json_pour_page)
from .sources import AUTRES, ordre_des_categories
from .texte import cle_alphabetique, esc, slugs_categories, truncate_label, article_id, slug_article
from .themes import ATTRIBUTS_HTML, CHOIX_THEME, CSS, SCRIPT_THEME, VARIABLES_HTML

# Chemin vers le code de conduite
CODE_DE_CONDUITE_PATH = Path(__file__).parent.parent / "accueil" / "code-de-conduite.html"

# Icône des flux RSS par catégorie, aux couleurs du drapeau trans.

ICONE_RSS = (
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">'
    '<rect y="0" width="20" height="4" fill="#5BCEFA"/>'
    '<rect y="4" width="20" height="4" fill="#F5A9B8"/>'
    '<rect y="8" width="20" height="4" fill="#FFFFFF"/>'
    '<rect y="12" width="20" height="4" fill="#F5A9B8"/>'
    '<rect y="16" width="20" height="4" fill="#5BCEFA"/>'
    '<g fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round">'
    '<circle cx="4.5" cy="15.5" r="1.8" fill="#000" stroke="none"/>'
    '<path d="M3 10.5a6.5 6.5 0 0 1 6.5 6.5"/>'
    '<path d="M3 4.5a12.5 12.5 0 0 1 12.5 12.5"/>'
    "</g></svg>"
)


# Nombre d'images dans la galerie de chaque bloc de catégorie de l'accueil
NB_GALERIE_BLOC = 12


def render_galerie_bloc(categorie: str, items: list[dict], previews: dict[str, dict]) -> str:
    """Petite galerie d'un bloc de catégorie de l'accueil : ses derniers articles ayant une image.

    « items » : les articles de la catégorie, du plus récent au plus ancien. Chaîne vide si aucun
    n'a d'image. Même balisage que la grande galerie (flèches < et >) : le script de celle-ci,
    brancherGalerie(), branche toutes les « .galerie-slider » de la page.
    """
    cartes = []
    for item in items:
        if len(cartes) >= NB_GALERIE_BLOC:
            break
        apercu = previews.get(item["link"], {})
        image = apercu.get("image") or item["image"] or ""
        if not image:
            continue
        title = apercu.get("title") or item["title"]
        article_url = f'/articles/{article_id(item["link"])}-{slug_article(title, item["link"])}/'
        cartes.append(
            f'<a href="{esc(article_url)}" class="galerie-carte" title="{esc(title)}">'
            f'<img src="{esc(image)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer"></a>'
        )
    if not cartes:
        return ""
    return (
        f'<section class="galerie-slider galerie-slider-bloc" '
        f'aria-label="Derniers articles en images : {esc(categorie)}">'
        '<button class="galerie-arrow-left" type="button" aria-label="Défiler vers la gauche">&lt;</button>'
        f'<div class="galerie galerie-bloc">{"".join(cartes)}</div>'
        '<button class="galerie-arrow-right" type="button" aria-label="Défiler vers la droite">&gt;</button>'
        '</section>'
    )


def render_galerie(items: list[dict], previews: dict[str, dict]) -> str:
    """Galerie horizontale des 12 derniers articles avec image."""
    cartes_galerie = []
    gal_count = 0
    gal_indices = []  # Indice réels des articles avec image

    for real_idx, item in enumerate(items):
        if gal_count >= 12:
            break
        title = previews.get(item["link"], {}).get("title") or item["title"]
        image = previews.get(item["link"], {}).get("image") or item["image"] or ""

        # Sauter les articles sans image
        if not image:
            continue

        gal_indices.append(real_idx)
        gal_count += 1

    for real_idx in gal_indices:
          item = items[real_idx]
          title = previews.get(item["link"], {}).get("title") or item["title"]
          image = previews.get(item["link"], {}).get("image") or item["image"] or ""

          media = (
              f'<img src="{esc(image)}" alt="{esc(title)}" '
              'loading="lazy" referrerpolicy="no-referrer">'
          )

          # Lien vers la page d'article
          art_id = article_id(item["link"])
          art_slug = slug_article(title, item["link"])
          article_url = f"/articles/{art_id}-{art_slug}/"

          cartes_galerie.append(
              f'<a href="{esc(article_url)}" class="galerie-carte" '
              f'title="{esc(title)}">{media}</a>'
          )

      # Ajouter une seule fois le script de retour, pas une fois par carte
    script_galerie = f"<script>\n{JS_GALERIE}</script>"

    html = f"""
    <section class="galerie-slider" aria-label="12 derniers articles">
      <button class="galerie-arrow-left" type="button" aria-label="Défiler vers la gauche">
        &lt;
      </button>

      <div class="galerie">
        {"".join(cartes_galerie)}
      </div>

      <button class="galerie-arrow-right" type="button" aria-label="Défiler vers la droite">
        &gt;
      </button>
    </section>

    {script_galerie}
    """
    return html




def render_page(items: list[dict], previews: dict[str, dict],
                categories: dict[str, str] | None = None) -> str:
    """La page d'accueil complète (le KiosKe) : bloc immuable, étiquettes par catégorie, fenêtres et articles."""
    categories = categories or {}
    # Regroupement par source (clé : URL du flux ou twitch:nom). Le nom affiché est celui de
    # l'article le plus récent, pour qu'un flux renommé n'apparaisse pas deux fois.
    # Sources dans l'ordre alphabétique, articles les plus récents d'abord.
    epoque = datetime.min.replace(tzinfo=timezone.utc)
    items.sort(key=lambda i: i["date"] or epoque, reverse=True)
    groupes: dict[str, list[dict]] = {}
    noms: dict[str, str] = {}
    for item in items:
        groupes.setdefault(item["key"], []).append(item)
        noms.setdefault(item["key"], item["source"])
    ordre = sorted(groupes, key=lambda cle: cle_alphabetique(noms[cle]))

    # Catégories : dans l'ordre du fichier de flux, « Des Liens » en dernier.
    par_categorie: dict[str, list[str]] = {}
    for cle in ordre:
        par_categorie.setdefault(categories.get(cle, AUTRES), []).append(cle)
    ordre_categories = ordre_des_categories(items, categories)
    slugs = slugs_categories(ordre_categories)

    tags_par_categorie: dict[str, list[str]] = {c: [] for c in ordre_categories}
    for categorie in ordre_categories:
        # Créer les étiquettes des sources
        for cle in par_categorie[categorie]:
            source = noms[cle]
            articles = groupes[cle]
            nb = len(articles)
            # Encoder la clé pour l'utiliser comme attribut HTML et JS
            cle_encodee = esc(cle).replace('"', '&quot;')
            tags_par_categorie[categorie].append(
                f'<button type="button" class="tag" data-source-key="{cle_encodee}" data-source-name="{esc(truncate_label(source))}">'
                f'{esc(truncate_label(source))} <span class="nb">×{nb}</span></button>'
            )

    # Articles de chaque catégorie, du plus récent au plus ancien (« items » est déjà trié)
    articles_par_categorie: dict[str, list[dict]] = {c: [] for c in ordre_categories}
    for item in items:
        articles_par_categorie[categories.get(item["key"], AUTRES)].append(item)

    blocs = "".join(
        f'<section class="groupe">'
        f'<h2>{esc(c)} <span class="compte">({len(par_categorie[c])})</span> <button type="button" class="tag-categorie" data-category-name="{esc(c)}">+</button></h2>'
        f'{render_galerie_bloc(c, articles_par_categorie[c], previews)}'
        f'<div class="nuage" aria-label="{esc(c)}">{"".join(tags_par_categorie[c])}</div></section>'
        for c in ordre_categories
    )
    liens_rss = "".join(
        f'<link rel="alternate" type="application/rss+xml" title="{DOMAINE} : {esc(c)} (flux RSS)" '
        f'href="{DOSSIER_RSS_CATEGORIES}/{slugs[c]}.xml">'
        for c in ordre_categories
    )
    nuage = f'<div class="groupes">{blocs}</div>'

    bloc, bas = immuable.parties()
    galerie_html = render_galerie(items, previews)
    # Référencement : le titre et la description décrivent le contenu réel (sources et catégories du jour).
    titre_page = f"{NOM_SITE} ({DOMAINE})"
    description = "Le KiosKe : une veille automatique des médias indépendants, des luttes et des voix LGBTQIA+. Une seule page statique (HTML5, CSS et JavaScript minimal), reconstruite toutes les 30 minutes sur le serveur à partir de flux RSS et de chaînes Twitch. Les images sont hébergées par le site : la page ne charge rien d'un autre site, sans publicité ni pistage."
    keywords = "kioske, veille, médias indépendants, LGBTQIA+, Mélenchon, RSS, Twitch, informatique libre"
    # Taille du site et hauteur des cartes : réglées dans kioske.cfg seulement (bornées à 75-125 %),
    # écrites dans l'attribut style de <html>. Les visiteurs ne peuvent plus les changer.
    taille_defaut = min(125, max(75, CFG.getint("site", "taille_defaut", fallback=90)))
    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")
    hauteur_carte_ouverte = min(125, max(75, CFG.getint("site", "hauteur_carte_ouverte", fallback=115)))
    bordure_panneau_epaisseur = CFG.getint("site", "bordure_panneau_epaisseur", fallback=8)
    espacement_panneau_vertical = CFG.get("site", "espacement_panneau_vertical", fallback="2.4rem")
    espacement_panneau_horizontal = CFG.get("site", "espacement_panneau_horizontal", fallback="0.5rem")

    # Réseaux sociaux
    lien_discord = CFG.get("reseaux", "discord", fallback="")
    lien_mastodon = CFG.get("reseaux", "mastodon", fallback="")
    lien_rss = CFG.get("reseaux", "rss", fallback="rss.html")

    # Préparer les données des groupes pour le JavaScript
    groupes_json = {}
    for cle in ordre:
        articles_data = []
        for item in groupes[cle]:
            title = previews.get(item["link"], {}).get("title") or item["title"]
            image = previews.get(item["link"], {}).get("image") or item["image"] or ""
            summary = item["summary"] or previews.get(item["link"], {}).get("description", "")
            date = item["date"]
            host = urlparse(item["link"]).netloc.removeprefix("www.")
            date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
            date_str = date_paris.strftime("%d/%m/%Y") if date_paris else ""

            art_id = article_id(item["link"])
            art_slug = slug_article(title, item["link"])
            article_url = f"/articles/{art_id}-{art_slug}/"

            articles_data.append({
                "id": art_id,
                "title": title,
                "image": image,
                "summary": summary,
                "date": date_str,
                "host": host,
                "url": article_url,
                "source": item["source"]
            })
        groupes_json[cle] = articles_data

    # Préparer les données des catégories pour le JavaScript
    categories_json = {}
    for categorie in ordre_categories:
        articles_data = []
        for cle in par_categorie[categorie]:
            for item in groupes[cle]:
                title = previews.get(item["link"], {}).get("title") or item["title"]
                image = previews.get(item["link"], {}).get("image") or item["image"] or ""
                summary = item["summary"] or previews.get(item["link"], {}).get("description", "")
                date = item["date"]
                host = urlparse(item["link"]).netloc.removeprefix("www.")
                date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
                date_str = date_paris.strftime("%d/%m/%Y") if date_paris else ""

                art_id = article_id(item["link"])
                art_slug = slug_article(title, item["link"])
                article_url = f"/articles/{art_id}-{art_slug}/"

                articles_data.append({
                    "id": art_id,
                    "title": title,
                    "image": image,
                    "summary": summary,
                    "date": date_str,
                    "host": host,
                    "url": article_url,
                    "source": item["source"],
                    "_tri": date or epoque
                })
        # Trier par date (plus récents d'abord) ; le texte « jj/mm/aaaa » ne se trie pas
        articles_data.sort(key=lambda a: a.pop("_tri"), reverse=True)
        categories_json[categorie] = articles_data

    # Charger le contenu du code de conduite
    conduite_html = ""
    if CODE_DE_CONDUITE_PATH.exists():
        conduite_html = CODE_DE_CONDUITE_PATH.read_text(encoding="utf-8")

    # Données lues par kioske/js/donnees_accueil.js
    donnees_json = json_pour_page(
        {"sources": groupes_json, "categories": categories_json, "conduite": conduite_html})

    # Générer les boutons de réseaux sociaux conditionnellement
    boutons_reseaux = ""
    if lien_rss:
        boutons_reseaux += f'<a class="menu-button" href="{esc(lien_rss)}">📡 Flux RSS</a>\n      '
    if lien_discord:
        boutons_reseaux += f'<a class="menu-button" href="{esc(lien_discord)}" target="_blank" rel="noopener noreferrer">💜 Discord</a>\n      '
    if lien_mastodon:
        boutons_reseaux += f'<a class="menu-button" href="{esc(lien_mastodon)}" target="_blank" rel="noopener noreferrer">🦣 Mastodon</a>\n      '

    return remplir(
        "accueil.html",
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        zoom=taille_defaut / 100,
        largeur_carte_ouverte=largeur_carte_ouverte,
        hauteur_carte_ouverte=hauteur_carte_ouverte / 100,
        bordure_panneau_epaisseur=bordure_panneau_epaisseur,
        espacement_panneau_vertical=espacement_panneau_vertical,
        espacement_panneau_horizontal=espacement_panneau_horizontal,
        titre=esc(titre_page),
        description=esc(description),
        mots_cles=keywords,
        url_site=URL_SITE,
        nom_site=esc(NOM_SITE),
        domaine=DOMAINE,
        liens_rss=liens_rss,
        css=CSS,
        script_theme=SCRIPT_THEME,
        donnees_json=donnees_json,
        js_donnees_accueil=JS_DONNEES_ACCUEIL,
        js_service_worker=JS_SERVICE_WORKER,
        nb_articles=len(items),
        nb_sources=len(groupes),
        choix_theme=CHOIX_THEME,
        boutons_reseaux=boutons_reseaux,
        galerie=galerie_html,
        nuage=nuage,
        bloc_immuable=bloc,
        bas_immuable=bas,
        js_favoris=JS_FAVORIS,
        js_partage=JS_PARTAGE,
        js_accueil=JS_ACCUEIL,
        js_carte_ouverte=JS_CARTE_OUVERTE,
        js_retour_app=JS_RETOUR_APP,
        js_installation_pwa=JS_INSTALLATION_PWA,
    )


def render_rss_page(categories: dict[str, str] | None = None, items: list[dict] | None = None) -> str:
    """Page de découverte des flux RSS par catégorie.
    Mêmes catégories et mêmes noms de fichier que les flux écrits par le build (ecrire_flux_rss) :
    une catégorie sans article n'a pas de flux, donc pas de lien."""
    categories = categories or {}
    ordre_categories = ordre_des_categories(items or [], categories)
    slugs = slugs_categories(ordre_categories)


    # Lien vers le flux RSS principal
    flux_principal = f'<a href="rss.xml" class="rss-lien rss-principal"><svg viewBox="0 0 20 20" aria-hidden="true"><rect y="0" width="20" height="4" fill="#5BCEFA"/><rect y="4" width="20" height="4" fill="#F5A9B8"/><rect y="8" width="20" height="4" fill="#FFFFFF"/><rect y="12" width="20" height="4" fill="#F5A9B8"/><rect y="16" width="20" height="4" fill="#5BCEFA"/><g fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><circle cx="4.5" cy="15.5" r="1.8" fill="#000" stroke="none"/><path d="M3 10.5a6.5 6.5 0 0 1 6.5 6.5"/><path d="M3 4.5a12.5 12.5 0 0 1 12.5 12.5"/></g></svg> {esc(DOMAINE)}</a>'

    # Flux par catégorie
    flux_categories = ""
    for categorie in ordre_categories:
        slug = slugs[categorie]
        flux_categories += f'<h3>{esc(categorie)}</h3><a href="rss/{slug}.xml" class="rss-lien">{ICONE_RSS} {esc(categorie)}</a>'

    bloc, bas = immuable.parties()

    return remplir(
        "rss.html",
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        nom_site=esc(NOM_SITE),
        domaine_echappe=esc(DOMAINE),
        url_site=URL_SITE,
        css=CSS,
        script_theme=SCRIPT_THEME,
        js_service_worker=JS_SERVICE_WORKER,
        choix_theme=CHOIX_THEME,
        domaine=DOMAINE,
        flux_principal=flux_principal,
        flux_categories=flux_categories,
        bloc_immuable=bloc,
        bas_immuable=bas,
        js_page_rss=JS_PAGE_RSS,
    )
