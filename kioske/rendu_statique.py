"""Génération des pages statiques pour les articles et catégories."""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse, quote
from zoneinfo import ZoneInfo
from pathlib import Path

from . import immuable
from .config import BUILD, DOMAINE, NOM_SITE, URL_SITE, CFG
from .texte import esc, article_id, slug_article, slug_categorie, cle_alphabetique
from .themes import charger_themes, css_des_themes, rain


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
    nav_buttons += f'<button type="button" class="fav-heart" data-article-link="{esc(item["link"])}" aria-label="Marquer comme favori" onclick="event.stopPropagation(); toggleFavorite(event)">♡</button>'
    if next_article:
        next_id = article_id(next_article["link"])
        # Utiliser le titre du preview si disponible, sinon le titre original (cohérent avec la génération de la page)
        next_preview = (previews or {}).get(next_article["link"], {})
        next_title = next_preview.get("title") or next_article["title"]
        next_slug = slug_article(next_title, next_article["link"])
        nav_buttons += f'<a href="{esc(f"/articles/{next_id}-{next_slug}/")}" class="nav-btn nav-next" aria-label="Article suivant">Suivant</a>'
    nav_buttons += '</div>'

    canonical = f"{URL_SITE}/articles/{article_id(item['link'])}-{slug_article(title, item['link'])}/"

    themes, defaut = charger_themes()
    css = css_des_themes(themes, defaut)
    pluie = rain() if any(t["pluie"] for t in themes) else ""
    taille_defaut = CFG.getint("site", "taille_defaut", fallback=90)
    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")

    bloc, _ = immuable.parties()

    return f"""<!DOCTYPE html>
<html lang="fr" style="--largeur-carte-ouverte: {largeur_carte_ouverte}; --hauteur-carte-ouverte: 1.15;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(summary[:160])}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{esc(NOM_SITE)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(summary[:160])}">
<meta property="og:url" content="{canonical}">
{f'<meta property="og:image" content="{esc(image)}">' if image else ''}
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(summary[:160])}">
{f'<meta name="twitter:image" content="{esc(image)}">' if image else ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KiosKe.fr">
<style>{css}
/* Bouton retour = style Précédent/Suivant */
.btn-retour {{
  position: absolute;
  top: 1rem;
  left: 1rem;
  padding: 0.6rem 1.2rem;
  background: #0a0000;
  border: 1px solid var(--red-dim);
  color: var(--red);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 9999;
}}
.btn-retour:hover, .btn-retour:focus-visible {{
  background: var(--red);
  color: #000;
  border-color: var(--red);
  box-shadow: 0 0 12px var(--red);
  outline: none;
}}
/* Format Pokemon pour la page d'article : responsive */
.panel-article {{
  /* Sur desktop : hauteur raisonnable */
  height: min(90vh, calc(100vw * 3.5 / 2.5 - 4rem));
  width: auto;
  max-width: none !important;
  aspect-ratio: 2.5 / 3.5;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--red) !important;
  border-radius: 0.8rem !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
  padding: 0 !important;
  margin: 1rem auto !important;
  overflow: hidden;
  position: relative;
}}

/* Tablette : adapter à la largeur */
@media (max-width: 1024px) {{
  body {{
    padding: 0 !important;
    margin: 0 !important;
  }}
  .panel-article {{
    height: min(85dvh, calc((100vw - 2rem) * 3.5 / 2.5));
    width: calc(100vw - 2rem);
    margin: 1rem auto !important;
    border-radius: 0.6rem !important;
  }}
}}

/* Mobile : hauteur maximale raisonnable, pas de marge */
@media (max-width: 640px) {{
  body {{
    padding: 0 !important;
    margin: 0 !important;
  }}
  main {{
    padding: 0 !important;
    margin: 0 !important;
  }}
  .panel-article {{
    height: 100dvh;
    width: 100vw;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    border: none !important;
  }}
}}
/* Image d'article : fixe en haut (35% de la hauteur) */
.article-image {{
  flex: 0 0 35%;
  overflow: hidden;
  background: #0a0000;
  border-bottom: 1px solid var(--red-dim);
  position: sticky;
  top: 0;
  z-index: 5;
}}
.article-image img {{
  width: 100%;
  height: 100%;
  object-fit: cover;
}}
/* Contenu de l'article : scrollable au milieu */
article {{
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  font-size: 1rem;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  -webkit-overflow-scrolling: touch;
}}
article h1 {{
  font-size: 1.1rem;
  margin: 0;
  font-weight: bold;
}}
article h2 {{
  font-size: 1.1rem;
  margin: 0;
  font-weight: bold;
}}
article p {{
  margin: 0;
  font-size: 0.95rem;
}}
.meta {{
  font-size: 0.85rem;
  color: var(--red-light);
}}
/* Boutons de navigation : fixes en bas */
.article-nav {{
  flex: 0 0 auto;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-top: 1px solid var(--red-dim);
  justify-content: space-around;
  position: sticky;
  bottom: 0;
  background: #0a0000;
  z-index: 5;
}}
</style>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => {{
    navigator.serviceWorker.register('/sw.js').catch(() => {{}});
  }});
}}
</script>
</head>
<body>
{pluie}<div class="recherche-globale">
  <form id="form-recherche" style="display:flex; gap: 0.5rem;">
    <input type="text" id="recherche-input" class="recherche" placeholder="Chercher..." aria-label="Barre de recherche globale" autocomplete="off">
    <button type="submit" style="padding: 0.6rem 1rem; background: var(--red-dim); border: 1px solid var(--red); color: var(--red); cursor: pointer; border-radius: 0.3rem;">🔍</button>
  </form>
</div>
<main class="panel panel-article">
  <button id="btn-retour" class="btn-retour" aria-label="Retour">← Retour</button>
  <article>
    {media}
    <p class="meta">{date_html}{esc(host)} · {esc(source)}</p>
    <h1>{esc(title)}</h1>
    <p class="article-texte">{esc(contenu)}</p>
    <p><a class="article-lien" href="{esc(item['link'])}" target="_blank" rel="noopener noreferrer">Lire sur {esc(host)} →</a></p>
    {nav_buttons}
  </article>
</main>
<script src="/app.js" defer></script>
<script>
// Bouton retour : revient TOUJOURS à la catégorie parente
// Navigation Précédent/Suivant : préserve le param 'from'
document.addEventListener('DOMContentLoaded', () => {{
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('from');

  // Bouton retour
  const btnRetour = document.getElementById('btn-retour');
  if (btnRetour) {{
    const returnUrl = fromParam || '/';
    btnRetour.addEventListener('click', () => {{
      window.location.href = returnUrl;
    }});
    if (fromParam && fromParam.includes('/categories/')) {{
      btnRetour.textContent = '← Retour à la catégorie';
    }}
  }}

  // Boutons Précédent/Suivant : ajouter le param 'from' aux liens
  if (fromParam) {{
    document.querySelectorAll('.nav-prev, .nav-next').forEach(btn => {{
      const href = btn.getAttribute('href');
      if (href && !href.includes('from=')) {{
        btn.setAttribute('href', href.split('?')[0] + '?from=' + encodeURIComponent(fromParam));
      }}
    }});
  }}
}});

// Barre de recherche globale : redirige vers l'accueil
document.getElementById('form-recherche').addEventListener('submit', (e) => {{
  e.preventDefault();
  const query = document.getElementById('recherche-input').value.trim();
  if (query) {{
    window.location.href = '/?q=' + encodeURIComponent(query);
  }}
}});
</script>
</body>
</html>"""


def render_category_page(category_name: str, articles: list[dict],
                        previews: dict[str, dict]) -> str:
    """Page HTML d'une catégorie avec ses articles triés par date."""
    themes, defaut = charger_themes()
    css = css_des_themes(themes, defaut)
    pluie = rain() if any(t["pluie"] for t in themes) else ""
    taille_defaut = CFG.getint("site", "taille_defaut", fallback=90)
    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")

    bloc, _ = immuable.parties()

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

    return f"""<!DOCTYPE html>
<html lang="fr" style="--largeur-carte-ouverte: {largeur_carte_ouverte}; --hauteur-carte-ouverte: 1.15;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(category_name)} - {NOM_SITE}</title>
<meta name="description" content="Catégorie {esc(category_name)} du {NOM_SITE}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(NOM_SITE)}">
<meta property="og:title" content="{esc(category_name)} - {NOM_SITE}">
<meta property="og:url" content="{canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KiosKe.fr">
<style>{css}
/* Bouton retour = style Précédent/Suivant */
.btn-retour {{
  position: absolute;
  top: 1rem;
  left: 1rem;
  padding: 0.6rem 1.2rem;
  background: #0a0000;
  border: 1px solid var(--red-dim);
  color: var(--red);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 9999;
}}
.btn-retour:hover, .btn-retour:focus-visible {{
  background: var(--red);
  color: #000;
  border-color: var(--red);
  box-shadow: 0 0 12px var(--red);
  outline: none;
}}
/* Cartes Pokemon : restaurer l'aspect */
.carte-lien {{
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  aspect-ratio: 2.5 / 3.5;
  border: 2px solid var(--red);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s, box-shadow 0.2s;
}}
.carte-lien:hover {{
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.7);
}}
.carte-image {{
  flex: 0 0 35%;
  overflow: hidden;
  background: #0a0000;
}}
.carte-image img {{
  width: 100%;
  height: 100%;
  object-fit: cover;
}}
.carte-corps {{
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.5rem;
  font-size: 0.75rem;
}}
/* Titre de la catégorie */
.panel-category h1 {{
  font-size: 1.1rem;
  margin: 0 0 1rem 0;
  font-weight: bold;
}}
</style>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => {{
    navigator.serviceWorker.register('/sw.js').catch(() => {{}});
  }});
}}
</script>
</head>
<body>
{pluie}<div class="recherche-globale">
  <form id="form-recherche" style="display:flex; gap: 0.5rem;">
    <input type="text" id="recherche-input" class="recherche" placeholder="Chercher..." aria-label="Barre de recherche globale" autocomplete="off">
    <button type="submit" style="padding: 0.6rem 1rem; background: var(--red-dim); border: 1px solid var(--red); color: var(--red); cursor: pointer; border-radius: 0.3rem;">🔍</button>
  </form>
</div>
<main class="panel panel-category">
  <button id="btn-retour" class="btn-retour" aria-label="Retour à l'accueil">← Accueil</button>
  <h1>{esc(category_name)}</h1>
  {"".join(sources_html)}
</main>
<script src="/app.js" defer></script>
<script>
// Bouton retour de catégorie : revient à l'accueil
document.addEventListener('DOMContentLoaded', () => {{
  const btnRetour = document.getElementById('btn-retour');

  if (btnRetour) {{
    btnRetour.addEventListener('click', () => {{
      // Aller à l'accueil
      window.location.href = '/';
    }});
  }}
}});

// Barre de recherche globale : redirige vers l'accueil
document.getElementById('form-recherche').addEventListener('submit', (e) => {{
  e.preventDefault();
  const query = document.getElementById('recherche-input').value.trim();
  if (query) {{
    window.location.href = '/?q=' + encodeURIComponent(query);
  }}
}});
</script>
</body>
</html>"""
