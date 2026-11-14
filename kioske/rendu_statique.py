"""Génération des pages statiques pour les articles et catégories.

Le squelette des pages est dans kioske/gabarits/ (article.html, categorie.html)."""
from __future__ import annotations

from urllib.parse import urlparse, quote
from zoneinfo import ZoneInfo

from .config import NOM_SITE, URL_SITE, CFG
from .gabarits import remplir
from .texte import esc, article_id, slug_article, slug_categorie
from .javascript import (JS_CARTE_OUVERTE, JS_FAVORIS, JS_INSTALLATION_PWA, JS_PAGE_ARTICLE, JS_PAGE_CATEGORIE,
                         JS_PARTAGE, JS_RETOUR_APP, JS_SERVICE_WORKER)
from .themes import ATTRIBUTS_HTML, CSS, SCRIPT_THEME, VARIABLES_HTML

# Le style de la carte ouverte est dans kioske/style.css (« Carte d'article ouverte »).

# Les scripts (carte ouverte, bouton précédent de l'app installée, pages d'article et de catégorie)
# sont dans kioske/js/ ; kioske/javascript.py les lit.

def render_article_page(item: dict, preview: dict, prev_article: dict | None = None, next_article: dict | None = None, previews: dict[str, dict] | None = None) -> str:
    """Page HTML d'un article avec navigation Précédent/Suivant.

    previews: dict optionnel qui mappe link → preview, pour calculer les slugs corrects.
    """
    title = preview.get("title") or item["title"]
    summary = item["summary"] or preview.get("description", "")
    contenu = item.get("content") or summary
    image = preview.get("image") or item["image"] or ""
    date = item["date"]
    host = urlparse(item["link"]).netloc.removeprefix("www.")
    source = item["source"]

    date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
    date_html = f'<time datetime="{date.isoformat()}">{date_paris:%d/%m/%Y}</time> · ' if date_paris else ""

    media = ""
    if image:
        # Corriger le chemin relatif pour les images (2 niveaux de profondeur : /articles/id/index.html)
        img_path = image.replace('img/veille/', '../../img/veille/')
        media = f'<div class="article-image"><img src="{esc(img_path)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer"></div>'
    else:
        media = f'<div class="article-image"><span class="lettre">{esc((source[:1] or "•").upper())}</span></div>'

    nav_buttons = '<div class="article-nav">'
    if prev_article:
        prev_id = article_id(prev_article["link"])
        # Utiliser le titre du preview si disponible, sinon le titre original (cohérent avec la génération de la page)
        prev_preview = (previews or {}).get(prev_article["link"], {})
        prev_title = prev_preview.get("title") or prev_article["title"]
        prev_slug = slug_article(prev_title, prev_article["link"])
        nav_buttons += f'<a href="{esc(f"/articles/{prev_id}-{prev_slug}/")}" class="nav-btn nav-prev" aria-label="Article precedent">Précédent</a>'
    nav_buttons += f'<button type="button" class="fav-heart" data-article-link="{esc(item["link"])}" aria-label="Marquer comme favori">♡</button>'
    nav_buttons += '<button type="button" class="share-btn" aria-label="Partager" title="Partager ce lien">📤</button>'
    if next_article:
        next_id = article_id(next_article["link"])
        # Utiliser le titre du preview si disponible, sinon le titre original (cohérent avec la génération de la page)
        next_preview = (previews or {}).get(next_article["link"], {})
        next_title = next_preview.get("title") or next_article["title"]
        next_slug = slug_article(next_title, next_article["link"])
        nav_buttons += f'<a href="{esc(f"/articles/{next_id}-{next_slug}/")}" class="nav-btn nav-next" aria-label="Article suivant">Suivant</a>'
    nav_buttons += '</div>'

    canonical = f"{URL_SITE}/articles/{article_id(item['link'])}-{slug_article(title, item['link'])}/"

    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")


    # Image de partage : seulement si l'article en a une
    meta_og_image = f'<meta property="og:image" content="{esc(image)}">' if image else ""
    meta_twitter_image = f'<meta name="twitter:image" content="{esc(image)}">' if image else ""

    return remplir(
        "article.html",
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        largeur_carte_ouverte=largeur_carte_ouverte,
        titre=esc(title),
        description=esc(summary[:160]),
        adresse_canonique=canonical,
        nom_site=esc(NOM_SITE),
        meta_og_image=meta_og_image,
        meta_twitter_image=meta_twitter_image,
        css=CSS,
        script_theme=SCRIPT_THEME,
        js_service_worker=JS_SERVICE_WORKER,
        media=media,
        date=date_html,
        site_origine=esc(host),
        source=esc(source),
        contenu=esc(contenu),
        lien_origine=esc(item["link"]),
        boutons_navigation=nav_buttons,
        js_retour_app=JS_RETOUR_APP,
        js_favoris=JS_FAVORIS,
        js_partage=JS_PARTAGE,
        js_installation_pwa=JS_INSTALLATION_PWA,
        js_page_article=JS_PAGE_ARTICLE,
    )


def render_category_page(category_name: str, articles: list[dict],
                        previews: dict[str, dict]) -> str:
    """Page HTML d'une catégorie avec ses articles triés par date."""
    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")


    # Param pour retour à la catégorie
    cat_slug = slug_categorie(category_name)
    from_param = f"?from=/categories/{cat_slug}/"

    # Rendu de tous les articles dans une seule grille
    articles_html = []
    for article in articles:
        title = previews.get(article["link"], {}).get("title") or article["title"]
        image = previews.get(article["link"], {}).get("image") or article["image"] or ""
        summary = article["summary"] or previews.get(article["link"], {}).get("description", "")
        source_name = article.get("source", "")
        art_id = article_id(article["link"])
        art_slug = slug_article(title, article["link"])

        if image:
            # Corriger le chemin relatif pour les images (2 niveaux de profondeur : /categories/slug/index.html)
            img_path = image.replace('img/veille/', '../../img/veille/')
            media = f'<img src="{esc(img_path)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer">'
        else:
            media = f'<span class="lettre">{esc((source_name[:1] or "•").upper())}</span>'

        articles_html.append(
            f'<a href="/articles/{art_id}-{art_slug}/?from={quote(from_param[6:])}" class="carte carte-lien">'
            f'<span class="carte-image" aria-hidden="true">{media}</span>'
            f'<span class="carte-corps"><span class="meta">{esc(article["link"])}</span>'
            f'<span class="carte-titre">{esc(title)}</span><span class="carte-extrait">{esc(summary)}</span></span>'
            f'<span class="carte-plus" aria-hidden="true">+</span></a>'
        )

    sources_html = [
        f'<div class="grille">{"".join(articles_html)}</div>'
    ]

    canonical = f"{URL_SITE}/categories/{slug_categorie(category_name)}/"

    return remplir(
        "categorie.html",
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        largeur_carte_ouverte=largeur_carte_ouverte,
        categorie=esc(category_name),
        nom_site_echappe=esc(NOM_SITE),
        nom_site=NOM_SITE,
        adresse_canonique=canonical,
        css=CSS,
        script_theme=SCRIPT_THEME,
        js_service_worker=JS_SERVICE_WORKER,
        grille="".join(sources_html),
        js_carte_ouverte=JS_CARTE_OUVERTE,
        js_retour_app=JS_RETOUR_APP,
        js_favoris=JS_FAVORIS,
        js_partage=JS_PARTAGE,
        js_installation_pwa=JS_INSTALLATION_PWA,
        js_page_categorie=JS_PAGE_CATEGORIE,
    )
