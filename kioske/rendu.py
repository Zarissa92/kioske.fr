"""Rendu HTML de la page d'accueil (le KiosKe). HTML5 et CSS seulement, aucun JavaScript."""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

from . import immuable
from .config import DOMAINE, DOSSIER_RSS_CATEGORIES, NOM_SITE, SLOGAN, URL_SITE
from .sources import AUTRES, ordre_des_categories
from .texte import cle_alphabetique, esc, slugs_categories
from .themes import charger_themes, choix_theme_html, css_des_themes, rain

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


def render_card(item: dict, preview: dict, ident: str, prev_ident: str | None = None, next_ident: str | None = None) -> tuple[str, str]:
    """Une carte (bouton) et le panneau de l'article qu'elle ouvre.
    Renvoie (carte, panneau) : le panneau reste hors de la grille, à côté de la fenêtre de catégorie.
    Le bouton ne contient que des <span> : un <button> n'accepte pas de <div>, <p> ou <h3>.
    prev_ident et next_ident permettent la navigation au sein de la source."""
    title = preview.get("title") or item["title"]
    summary = item["summary"] or preview.get("description", "")
    contenu = item.get("content") or summary
    image = preview.get("image") or item["image"] or ""
    date = item["date"]
    host = urlparse(item["link"]).netloc.removeprefix("www.")

    if image:
        media = f'<img src="{esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">'
    else:
        media = f'<span class="lettre">{esc((item["source"][:1] or "•").upper())}</span>'
    date_html = f'<time datetime="{date.isoformat()}">{date:%d/%m/%Y}</time> · ' if date else ""
    cible = f"art-{ident}"

    carte = (
        f'<button type="button" class="carte" data-article-id="{cible}">'
        f'<span class="carte-image" aria-hidden="true">{media}</span>'
        f'<span class="carte-corps"><span class="meta">{date_html}{esc(host)}</span>'
        f'<span class="carte-titre">{esc(title)}</span><span class="carte-extrait">{esc(summary)}</span></span>'
        f'<span class="carte-plus" aria-hidden="true">+</span></button>'
    )
    nav_buttons = ""
    if prev_ident or next_ident:
        nav_buttons = '<div class="article-nav">'
        if prev_ident:
            nav_buttons += f'<button type="button" class="nav-btn nav-prev" data-article-id="art-{prev_ident}" aria-label="Article precedent">Precedent</button>'
        if next_ident:
            nav_buttons += f'<button type="button" class="nav-btn nav-next" data-article-id="art-{next_ident}" aria-label="Article suivant">Suivant</button>'
        nav_buttons += '</div>'

    panneau = (
        f'<div class="article-container" id="container-{cible}" hidden>'
        f'<div class="article-backdrop" data-close-article="{cible}"></div>'
        f'<div id="{cible}" class="article-panneau" aria-labelledby="{cible}-titre">'
        f'<button type="button" class="categorie-fermer" data-article-id="{cible}" aria-label="Fermer">×</button>'
        f'<div class="article-image">{media}</div>'
        f'<p class="meta">{date_html}{esc(host)}</p>'
        f'<h2 id="{cible}-titre">{esc(title)}</h2>'
        f'<p class="article-texte">{esc(contenu)}</p>'
        f'<p><a class="article-lien" href="{esc(item["link"])}" target="_blank" rel="noopener noreferrer">'
        f'Lire l\'article sur {esc(host)} →</a></p>'
        f'{nav_buttons}</div></div>'
    )
    return carte, panneau


def render_galerie(items: list[dict], previews: dict[str, dict]) -> tuple[str, list[str]]:
    """Galerie horizontale des 10 derniers articles avec image. Renvoie (html_galerie, panneaux)."""
    cartes_galerie = []
    panneaux_galerie = []
    gal_idx = 0

    for item in items:
        if gal_idx >= 10:
            break
        title = previews.get(item["link"], {}).get("title") or item["title"]
        image = previews.get(item["link"], {}).get("image") or item["image"] or ""

        # Sauter les articles sans image
        if not image:
            continue

        cible = f"gal-{gal_idx}"
        media = f'<img src="{esc(image)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer">'

        cartes_galerie.append(
            f'<button type="button" class="galerie-carte" data-article-id="{cible}" title="{esc(title)}">'
            f'{media}</button>'
        )

        # Panneau identique aux autres articles
        contenu = item.get("content") or item["summary"] or previews.get(item["link"], {}).get("description", "")
        date = item["date"]
        host = urlparse(item["link"]).netloc.removeprefix("www.")
        date_html = f'<time datetime="{date.isoformat()}">{date:%d/%m/%Y}</time> · ' if date else ""

        panneau = (
            f'<div class="article-container" id="container-{cible}" hidden>'
            f'<div class="article-backdrop" data-close-article="{cible}"></div>'
            f'<div id="{cible}" class="article-panneau" aria-labelledby="{cible}-titre">'
            f'<button type="button" class="categorie-fermer" data-article-id="{cible}" aria-label="Fermer">×</button>'
            f'<div class="article-image">{media}</div>'
            f'<p class="meta">{date_html}{esc(host)}</p>'
            f'<h2 id="{cible}-titre">{esc(title)}</h2>'
            f'<p class="article-texte">{esc(contenu)}</p>'
            f'<p><a class="article-lien" href="{esc(item["link"])}" target="_blank" rel="noopener noreferrer">'
            f'Lire l\'article sur {esc(host)} →</a></p>'
            f'</div></div>'
        )
        panneaux_galerie.append(panneau)
        gal_idx += 1

    html = f'<section class="galerie" aria-label="10 derniers articles">{"".join(cartes_galerie)}</section>'
    return html, panneaux_galerie


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
    fenetres = []
    n = 0  # numéro global de la source : sert à l'identifiant de sa fenêtre
    for categorie in ordre_categories:
        for cle in par_categorie[categorie]:
            source = noms[cle]
            articles = groupes[cle]
            rendus = []
            for k, i in enumerate(articles):
                prev_ident = f"{n}-{k-1}" if k > 0 else None
                next_ident = f"{n}-{k+1}" if k < len(articles) - 1 else None
                rendus.append(render_card(i, previews.get(i["link"], {}), f"{n}-{k}", prev_ident, next_ident))
            cartes = "".join(carte for carte, _ in rendus)
            panneaux_articles = "".join(panneau for _, panneau in rendus)
            nb = len(articles)
            tags_par_categorie[categorie].append(
                f'<button type="button" class="tag" data-article-id="cat-{n}">'
                f'{esc(source)} <span class="nb">×{nb}</span></button>'
            )
            fenetres.append(
                f'<div class="categorie-container" id="container-cat-{n}" hidden>'
                f'<div class="categorie-backdrop" data-close-source="cat-{n}"></div>'
                f'<div id="cat-{n}" class="categorie-panneau">'
                f'<button type="button" class="categorie-fermer" data-article-id="cat-{n}" aria-label="Fermer">×</button>'
                f'<h2>{esc(source)} <span class="compte">({nb})</span></h2>'
                f'<div class="grille">{cartes}</div></div></div>'
            )
            fenetres.append(panneaux_articles)
            n += 1

    blocs = "".join(
        f'<section class="groupe">'
        f'<a class="rss-categorie" href="{DOSSIER_RSS_CATEGORIES}/{slugs[c]}.xml" '
        f'title="Flux RSS : {esc(c)}" aria-label="Flux RSS de la catégorie {esc(c)}">{ICONE_RSS}</a>'
        f'<h2>{esc(c)} <span class="compte">({len(par_categorie[c])})</span></h2>'
        f'<div class="nuage" aria-label="{esc(c)}">{"".join(tags_par_categorie[c])}</div></section>'
        for c in ordre_categories
    )
    liens_rss = "".join(
        f'<link rel="alternate" type="application/rss+xml" title="{DOMAINE} : {esc(c)} (flux RSS)" '
        f'href="{DOSSIER_RSS_CATEGORIES}/{slugs[c]}.xml">'
        for c in ordre_categories
    )
    nuage = f'<div class="groupes">{blocs}</div>'

    generated = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    bloc, bas = immuable.parties()
    galerie_html, panneaux_galerie = render_galerie(items, previews)
    # Référencement : le titre et la description décrivent le contenu réel (sources et catégories du jour).
    titre_page = f"{NOM_SITE} ({DOMAINE}) : {SLOGAN}"
    description = (f"{NOM_SITE} : {SLOGAN}. Articles et vidéos de {len(groupes)} sources, par catégorie : "
                   f"{', '.join(ordre_categories)}. Sans publicité ni pistage.")
    themes, defaut = charger_themes()
    css = css_des_themes(themes, defaut)
    pluie = rain() if any(t["pluie"] for t in themes) else ""
    choix = choix_theme_html(themes, defaut)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(titre_page)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{URL_SITE}/">
<meta name="theme-color" content="#000000">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(NOM_SITE)}">
<meta property="og:title" content="{esc(titre_page)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{URL_SITE}/">
<meta property="og:image" content="{URL_SITE}/preview.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(titre_page)}">
<meta name="twitter:description" content="{esc(description)}">
<meta name="twitter:image" content="{URL_SITE}/preview.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="{DOMAINE} (flux RSS)" href="rss.xml">
{liens_rss}
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>{css}</style>
</head>
<body>
{pluie}<main class="panel">
  {choix}
  <input type="text" id="recherche" class="recherche" placeholder="Chercher..." aria-label="Barre de recherche">
  <p class="kicker">// {DOMAINE} automatique ✨</p>
  <h1><span class="titre-ligne"><span class="drapeau" aria-hidden="true">🏳️‍⚧️</span><span class="glow">{DOMAINE}</span><span class="drapeau" aria-hidden="true">🏳️‍⚧️</span><span class="cursor" aria-hidden="true">▌</span></span></h1>
  <p class="sub">{len(items)} éléments · {len(groupes)} sources</p>
  <p class="sub-petit">Mis à jour le {generated}</p>
  {bloc}
  {galerie_html}
  {nuage}
  {bas}
</main>
<section class="cartes" aria-label="Fenêtres des sources">
{"".join(panneaux_galerie)}
{"".join(fenetres)}
</section>
<p class="mentions">Chaque article renvoie vers sa source d'origine. Textes, images et vidéos : leurs auteur.ice.s et sites respectifs.</p>
<p class="mentions"><a href="https://github.com/Zarissa92/kioske.fr" target="_blank" rel="noopener noreferrer">GitHub du projet (GPL v3)</a></p>
<script>
let openPopover = null;
let scrollPositions = {{}};
function closePopover() {{
  if (openPopover) {{
    openPopover.hidden = true;
    openPopover = null;
  }}
}}
function showPopover(id) {{
  if (openPopover && !openPopover.classList.contains('article-container') && !openPopover.classList.contains('categorie-container')) {{
    scrollPositions[openPopover.id] = openPopover.scrollTop;
  }}
  closePopover();
  if (id.startsWith('art-') || id.startsWith('gal-')) {{
    const container = document.getElementById('container-' + id);
    if (container) {{
      container.hidden = false;
      openPopover = container;
    }}
  }} else if (id.startsWith('cat-')) {{
    const container = document.getElementById('container-' + id);
    if (container) {{
      container.hidden = false;
      openPopover = container;
      const panel = document.getElementById(id);
      if (panel && scrollPositions[id] !== undefined) {{
        setTimeout(() => {{ panel.scrollTop = scrollPositions[id]; }}, 0);
      }}
    }}
  }}
}}
function closeArticleAndShowSource(articleId) {{
  if (!articleId) return;
  // Articles de la galerie : pas de source associée, juste fermer
  if (articleId.startsWith('gal-')) {{
    closePopover();
    return;
  }}
  const match = articleId.match(/^art-(\\d+)-/);
  if (match) {{
    const sourceId = 'cat-' + match[1];
    closePopover();
    showPopover(sourceId);
  }}
}}
document.querySelectorAll('[data-article-id]').forEach(btn => {{
  btn.addEventListener('click', (e) => {{
    const target = btn.getAttribute('data-article-id');
    if (btn.classList.contains('nav-btn')) {{
      showPopover(target);
    }} else if (btn.classList.contains('categorie-fermer')) {{
      if (btn.closest('.article-panneau')) {{
        closeArticleAndShowSource(target);
      }} else {{
        closePopover();
      }}
    }} else {{
      showPopover(target);
    }}
  }});
}});
document.querySelectorAll('.article-backdrop').forEach(backdrop => {{
  backdrop.addEventListener('click', (e) => {{
    if (e.target === backdrop) {{
      const articleId = backdrop.getAttribute('data-close-article');
      closeArticleAndShowSource(articleId);
    }}
  }});
}});
document.querySelectorAll('.categorie-backdrop').forEach(backdrop => {{
  backdrop.addEventListener('click', (e) => {{
    if (e.target === backdrop) {{
      closePopover();
    }}
  }});
}});
document.addEventListener('keydown', e => {{
  if (e.key === 'Escape') {{
    if (openPopover && openPopover.classList.contains('article-container')) {{
      const articleId = openPopover.querySelector('.article-panneau').id;
      closeArticleAndShowSource(articleId);
    }} else {{
      closePopover();
    }}
  }}
}});
// Barre de recherche
const rechercheInput = document.getElementById('recherche');
rechercheInput.addEventListener('keydown', (e) => {{
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const query = rechercheInput.value.toLowerCase().trim();
  if (!query) return;
  const cards = document.querySelectorAll('[data-article-id^="art-"]');
  let found = false;
  cards.forEach(card => {{
    const text = card.textContent.toLowerCase();
    if (text.includes(query)) {{
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
      found = true;
    }} else {{
      card.style.opacity = '0.3';
      card.style.pointerEvents = 'none';
    }}
  }});
  if (found) {{
    document.querySelector('.cartes').scrollIntoView({{behavior: 'smooth'}});
  }}
}});
</script>
</body>
</html>
"""
