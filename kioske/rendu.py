"""Rendu HTML de la page d'accueil (le KiosKe). HTML5 et CSS seulement, aucun JavaScript."""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from . import immuable
from .config import DOMAINE, DOSSIER_RSS_CATEGORIES, NOM_SITE, SLOGAN, URL_SITE, CFG
from .sources import AUTRES, ordre_des_categories
from .texte import cle_alphabetique, esc, slugs_categories, truncate_label
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
    date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
    date_html = f'<time datetime="{date.isoformat()}">{date_paris:%d/%m/%Y}</time> · ' if date_paris else ""
    cible = f"art-{ident}"

    carte = (
        f'<button type="button" class="carte" data-article-id="{cible}">'
        f'<span class="carte-image" aria-hidden="true">{media}</span>'
        f'<span class="carte-corps"><span class="meta">{date_html}{esc(host)}</span>'
        f'<span class="carte-titre">{esc(title)}</span><span class="carte-extrait">{esc(summary)}</span></span>'
        f'<span class="carte-plus" aria-hidden="true">+</span></button>'
    )
    nav_buttons = '<div class="article-nav">'
    if prev_ident:
        nav_buttons += f'<button type="button" class="nav-btn nav-prev" data-article-id="art-{prev_ident}" aria-label="Article precedent">Precedent</button>'
    nav_buttons += f'<button type="button" class="fav-heart" data-article-id="{cible}" aria-label="Marquer comme favori" onclick="event.stopPropagation(); toggleFavorite(event)">♡</button>'
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
    gal_indices = []  # Indice réels des articles avec image pour la navigation

    for item in items:
        if gal_idx >= 10:
            break
        title = previews.get(item["link"], {}).get("title") or item["title"]
        image = previews.get(item["link"], {}).get("image") or item["image"] or ""

        # Sauter les articles sans image
        if not image:
            continue

        gal_indices.append(gal_idx)
        gal_idx += 1

    # Créer les cartes et panneaux avec navigation
    for display_idx, real_idx in enumerate(gal_indices):
        item = items[real_idx]
        title = previews.get(item["link"], {}).get("title") or item["title"]
        image = previews.get(item["link"], {}).get("image") or item["image"] or ""
        cible = f"gal-{real_idx}"
        media = f'<img src="{esc(image)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer">'

        cartes_galerie.append(
            f'<button type="button" class="galerie-carte" data-article-id="{cible}" title="{esc(title)}">'
            f'{media}</button>'
        )

        # Boutons de navigation pour la galerie
        nav_buttons = ""
        if display_idx > 0:
            prev_idx = gal_indices[display_idx - 1]
            nav_buttons += f'<button type="button" class="nav-btn nav-prev" data-article-id="gal-{prev_idx}" aria-label="Article precedent">Precedent</button>'
        nav_buttons += f'<button type="button" class="fav-heart" data-article-id="gal-{real_idx}" aria-label="Marquer comme favori" onclick="event.stopPropagation(); toggleFavorite(event)">♡</button>'
        if display_idx < len(gal_indices) - 1:
            next_idx = gal_indices[display_idx + 1]
            nav_buttons += f'<button type="button" class="nav-btn nav-next" data-article-id="gal-{next_idx}" aria-label="Article suivant">Suivant</button>'

        nav_buttons = f'<div class="article-nav">{nav_buttons}</div>'

        # Panneau avec navigation
        contenu = item.get("content") or item["summary"] or previews.get(item["link"], {}).get("description", "")
        date = item["date"]
        host = urlparse(item["link"]).netloc.removeprefix("www.")
        date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
        date_html = f'<time datetime="{date.isoformat()}">{date_paris:%d/%m/%Y}</time> · ' if date_paris else ""

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
        panneaux_galerie.append(panneau)

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
                f'{esc(truncate_label(source))} <span class="nb">×{nb}</span></button>'
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

    generated = datetime.now(ZoneInfo("Europe/Paris")).strftime("%d/%m/%Y %H:%M %Z")
    bloc, bas = immuable.parties()
    galerie_html, panneaux_galerie = render_galerie(items, previews)
    # Référencement : le titre et la description décrivent le contenu réel (sources et catégories du jour).
    titre_page = f"{NOM_SITE} ({DOMAINE})"
    description = "Le KiosKe : une veille automatique des médias indépendants, des luttes et des voix LGBTQIA+. Une seule page statique (HTML5, CSS et JavaScript minimal), reconstruite toutes les 30 minutes sur le serveur à partir de flux RSS et de chaînes Twitch. Les images sont hébergées par le site : la page ne charge rien d'un autre site, sans publicité ni pistage."
    keywords = "kioske, veille, médias indépendants, LGBTQIA+, Mélenchon, RSS, Twitch, informatique libre"
    themes, defaut = charger_themes()
    css = css_des_themes(themes, defaut)
    pluie = rain() if any(t["pluie"] for t in themes) else ""
    choix = choix_theme_html(themes, defaut)
    taille_defaut = CFG.getint("site", "taille_defaut", fallback=90)
    largeur_carte_ouverte = CFG.get("site", "largeur_carte_ouverte", fallback="min(600px, 85vw)")
    hauteur_carte_ouverte = CFG.getint("site", "hauteur_carte_ouverte", fallback=115)
    return f"""<!DOCTYPE html>
<html lang="fr" style="--largeur-carte-ouverte: {largeur_carte_ouverte}; --hauteur-carte-ouverte: {hauteur_carte_ouverte / 100};">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(titre_page)}</title>
<meta name="description" content="{esc(description)}">
<meta name="keywords" content="{keywords}">
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
<link rel="manifest" href="manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KiosKe.fr">
<style>{css}</style>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => {{
    navigator.serviceWorker.register('sw.js').catch(() => {{}});
  }});
}}
</script>
</head>
<body>
{pluie}<main class="panel">
  <button type="button" class="btn-infos" data-article-id="bloc-infos" aria-label="Infos et liens">+</button>
  <p class="kicker">// {DOMAINE} automatique ✨</p>
  <h1><span class="titre-ligne"><span class="drapeau" aria-hidden="true">🏳️‍⚧️</span><span class="glow">{DOMAINE}</span><span class="drapeau" aria-hidden="true">🏳️‍⚧️</span></span></h1>
  <p class="sub">{len(items)} éléments · {len(groupes)} sources</p>
  <p class="sub-petit">Mis à jour le {generated}</p>
  {galerie_html}
  {nuage}
</main>
<div id="bloc-infos-container" class="infos-container" hidden>
  <div class="infos-backdrop" data-close-infos="bloc-infos"></div>
  <div id="bloc-infos" class="popover-infos">
    <button type="button" class="infos-fermer" data-close-infos="bloc-infos" aria-label="Fermer">×</button>
    <div class="popover-contenu">
    <div class="popover-section">
      <input type="text" id="recherche" class="recherche" placeholder="Chercher..." aria-label="Barre de recherche">
    </div>
    <div class="popover-section">
      {choix}
    </div>
    <div class="popover-section">
      <div class="taille-controle">
        <label for="taille-site">Taille du site</label>
        <input type="range" id="taille-site" class="taille-slider" min="75" max="125" value="{taille_defaut}" aria-label="Taille du site (75% à 125%)">
        <span class="taille-valeur">{taille_defaut}%</span>
      </div>
      <div class="taille-controle">
        <label for="hauteur-carte">Hauteur carte</label>
        <input type="range" id="hauteur-carte" class="taille-slider" min="75" max="125" value="{hauteur_carte_ouverte}" aria-label="Hauteur de la carte ouverte (75% à 125%)">
        <span class="taille-valeur">{hauteur_carte_ouverte}%</span>
      </div>
    </div>
    <div class="popover-section">
      <button type="button" class="btn-mes-favoris" onclick="openFavoritesPanel()">♡ Mes favoris</button>
    </div>
    <div class="popover-section">
      <button type="button" class="btn-install-pwa" id="btn-install-pwa">⬇ Installer l'app</button>
    </div>
    <div class="popover-section">
      {bloc}
      {bas}
    </div>
  </div>
  </div>
</div>
<div class="categorie-container" id="container-favoris" hidden>
  <div class="categorie-backdrop" data-close-source="favoris"></div>
  <div id="favoris" class="categorie-panneau">
    <button type="button" class="categorie-fermer" data-article-id="favoris" aria-label="Fermer">×</button>
    <h2>Mes favoris</h2>
    <div class="grille" id="fav-grille"></div>
    <div class="fav-controls" style="padding: 1rem 0; border-top: 1px solid var(--red-dim); text-align: center; gap: 0.5rem; display: flex; flex-direction: column;">
      <button type="button" class="fav-export" id="fav-export-btn">Télécharger mes favoris</button>
      <button type="button" class="fav-import" id="fav-import-btn" onclick="document.getElementById('fav-file-input').click()">Charger des favoris</button>
      <button type="button" class="fav-export" id="fav-clear-btn">Effacer tous les favoris</button>
    </div>
  </div>
</div>
<input type="file" id="fav-file-input" accept=".json" style="display: none;" aria-label="Charger un fichier de favoris">

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
  }} else if (id.startsWith('cat-') || id === 'search-results' || id === 'favoris') {{
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
  // Fermer l'article et revenir à l'index du site
  closePopover();
}}
// Taille du site (zoom global)
const tailleSlider = document.getElementById('taille-site');
const tailleValeur = document.querySelector('.taille-valeur');
if (tailleSlider) {{
  // Charger la taille sauvegardée ou utiliser la valeur du slider (valeur par défaut)
  const tailleSauvegardee = localStorage.getItem('kioske-taille') || tailleSlider.value;

  // Appliquer le zoom dès le chargement
  tailleSlider.value = tailleSauvegardee;
  document.documentElement.style.zoom = (tailleSauvegardee / 100);
  tailleValeur.textContent = tailleSauvegardee + '%';

  tailleSlider.addEventListener('input', (e) => {{
    const valeur = e.target.value;
    document.documentElement.style.zoom = (valeur / 100);
    tailleValeur.textContent = valeur + '%';
    localStorage.setItem('kioske-taille', valeur);
  }});
}}
// Hauteur de la carte ouverte
const hauteurSlider = document.getElementById('hauteur-carte');
const hauteurValeursSpans = document.querySelectorAll('.taille-valeur');
const hauteurValeur = hauteurValeursSpans[hauteurValeursSpans.length - 1];
if (hauteurSlider) {{
  // Charger la hauteur sauvegardée ou utiliser la valeur par défaut
  const hauteurSauvegardee = localStorage.getItem('kioske-hauteur-carte');
  if (hauteurSauvegardee) {{
    hauteurSlider.value = hauteurSauvegardee;
    document.documentElement.style.setProperty('--hauteur-carte-ouverte', (hauteurSauvegardee / 100));
    hauteurValeur.textContent = hauteurSauvegardee + '%';
  }}
  hauteurSlider.addEventListener('input', (e) => {{
    const valeur = e.target.value;
    document.documentElement.style.setProperty('--hauteur-carte-ouverte', (valeur / 100));
    hauteurValeur.textContent = valeur + '%';
    localStorage.setItem('kioske-hauteur-carte', valeur);
  }});
}}
// Gestion du bouton d'infos (+)
const btnInfos = document.querySelector('.btn-infos');
if (btnInfos) {{
  btnInfos.addEventListener('click', (e) => {{
    const container = document.getElementById('bloc-infos-container');
    if (container) {{
      container.hidden = false;
    }}
  }});
}}
// Fermeture du conteneur d'infos
document.querySelectorAll('[data-close-infos]').forEach(elem => {{
  elem.addEventListener('click', (e) => {{
    const container = document.getElementById('bloc-infos-container');
    if (container) {{
      container.hidden = true;
    }}
  }});
}});
document.querySelectorAll('[data-article-id]').forEach(btn => {{
  // Ne pas affecter le bouton + (qui gère le menu séparément)
  if (btn.classList.contains('btn-infos')) return;
  btn.addEventListener('click', (e) => {{
    const target = btn.getAttribute('data-article-id');
    // Fermer le menu + pour toute ouverture de panneau
    const infosContainer = document.getElementById('bloc-infos-container');
    if (infosContainer) infosContainer.hidden = true;
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
// Crée un panneau de résultats de recherche
function createSearchResultsPanel() {{
  if (document.getElementById('container-search-results')) return;
  const container = document.createElement('div');
  container.id = 'container-search-results';
  container.className = 'categorie-container';
  container.hidden = true;
  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.setAttribute('data-close-source', 'search-results');
  backdrop.addEventListener('click', (e) => {{ if (e.target === backdrop) closePopover(); }});
  const panneau = document.createElement('div');
  panneau.id = 'search-results-panneau';
  panneau.className = 'categorie-panneau';
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('data-article-id', 'search-results');
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  const titre = document.createElement('h2');
  titre.innerHTML = 'Résultats <span class="compte">(0)</span>';
  const grille = document.createElement('div');
  grille.className = 'grille';
  grille.id = 'search-results-grille';
  panneau.appendChild(fermer);
  panneau.appendChild(titre);
  panneau.appendChild(grille);
  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);
  // Attacher le listener au bouton fermer
  fermer.addEventListener('click', () => closePopover());
}}
// Barre de recherche
const rechercheInput = document.getElementById('recherche');
if (rechercheInput) {{
  rechercheInput.addEventListener('keydown', (e) => {{
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = rechercheInput.value.toLowerCase().trim();
    if (!query) return;
    createSearchResultsPanel();
    const cards = document.querySelectorAll('[data-article-id^="art-"]');
    const grille = document.getElementById('search-results-grille');
    grille.innerHTML = '';
    let count = 0;
    cards.forEach(card => {{
      const text = card.textContent.toLowerCase();
      if (text.includes(query)) {{
        const clone = card.cloneNode(true);
        grille.appendChild(clone);
        // Réattacher les listeners à la carte clonée
        clone.addEventListener('click', (e) => {{
          const target = clone.getAttribute('data-article-id');
          showPopover(target);
        }});
        count++;
      }}
    }});
    if (count > 0) {{
      document.querySelector('#search-results-panneau h2 .compte').textContent = `(${{count}})`;
      // Fermer le menu +
      const infosContainer = document.getElementById('bloc-infos-container');
      if (infosContainer) infosContainer.hidden = true;
      showPopover('search-results');
    }}
  }});
}}

// Gestion des favoris
function getFavorites() {{
  const fav = localStorage.getItem('kioske_favoris');
  return fav ? JSON.parse(fav) : {{}};
}}

function saveFavorites(fav) {{
  localStorage.setItem('kioske_favoris', JSON.stringify(fav));
  updateHearts();
}}

function toggleFavorite(event) {{
  const heart = event.target;
  const articleId = heart.getAttribute('data-article-id');
  const favorites = getFavorites();

  if (favorites[articleId]) {{
    delete favorites[articleId];
    heart.classList.remove('active');
  }} else {{
    const carte = document.querySelector(`[data-article-id="${{articleId}}"]`);
    const titre = carte.querySelector('.carte-titre')?.textContent || 'Sans titre';
    const lien = carte.querySelector('.article-lien')?.href || '#';
    favorites[articleId] = {{
      titre: titre,
      lien: lien,
      timestamp: new Date().toISOString()
    }};
    heart.classList.add('active');
  }}
  saveFavorites(favorites);
}}

function updateHearts() {{
  const favorites = getFavorites();
  document.querySelectorAll('.fav-heart').forEach(heart => {{
    const articleId = heart.getAttribute('data-article-id');
    if (favorites[articleId]) {{
      heart.classList.add('active');
    }} else {{
      heart.classList.remove('active');
    }}
  }});
}}

function openFavoritesPanel() {{
  closePopover();
  document.getElementById('bloc-infos-container').hidden = true;

  const favGrille = document.getElementById('fav-grille');
  const favorites = getFavorites();
  favGrille.innerHTML = '';

  if (Object.keys(favorites).length === 0) {{
    favGrille.innerHTML = '<p style="grid-column: 1/-1; color: #888; padding: 2rem; text-align: center;">Aucun favori pour le moment</p>';
  }} else {{
    Object.entries(favorites).forEach(([id, data]) => {{
      const carte = document.querySelector(`[data-article-id="${{id}}"]`);
      if (carte) {{
        const clone = carte.cloneNode(true);
        clone.addEventListener('click', (e) => {{
          showPopover(id);
        }});
        favGrille.appendChild(clone);
      }}
    }});
  }}

  showPopover('favoris');
}}

function exportFavorites() {{
  const favorites = getFavorites();
  if (Object.keys(favorites).length === 0) {{
    alert('Aucun favori à exporter');
    return;
  }}
  const data = JSON.stringify(favorites, null, 2);
  const blob = new Blob([data], {{type: 'application/json'}});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kioske-favoris.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}}

function importFavorites() {{
  const file = document.getElementById('fav-file-input').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {{
    try {{
      const data = JSON.parse(e.target.result);
      const favorites = getFavorites();
      Object.assign(favorites, data);
      saveFavorites(favorites);
      openFavoritesPanel();
      alert('Favoris importés avec succès !');
    }} catch (err) {{
      alert('Erreur lors de l\\'import : format JSON invalide');
    }}
  }};
  reader.readAsText(file);
}}

function clearFavorites() {{
  if (confirm('Êtes-vous sûr de vouloir effacer tous vos favoris ?')) {{
    localStorage.removeItem('kioske_favoris');
    updateHearts();
    openFavoritesPanel();
  }}
}}

// Boutons
document.getElementById('fav-export-btn')?.addEventListener('click', exportFavorites);
document.getElementById('fav-file-input')?.addEventListener('change', importFavorites);
document.getElementById('fav-clear-btn')?.addEventListener('click', clearFavorites);

// Initialiser les cœurs
updateHearts();

// Gestion de l'installation PWA
let installPromptEvent = null;
const btnInstallPWA = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {{
  e.preventDefault();
  installPromptEvent = e;
}});

if (btnInstallPWA) {{
  btnInstallPWA.addEventListener('click', async () => {{
    if (!installPromptEvent) {{
      alert('L\\'installation PWA n\\'est pas disponible sur ce navigateur ou ce contexte.');
      return;
    }}
    installPromptEvent.prompt();
    const choix = await installPromptEvent.userChoice;
    if (choix.outcome === 'accepted') {{
      console.log('PWA installée');
    }}
    installPromptEvent = null;
  }});
}}

window.addEventListener('appinstalled', () => {{
  console.log('PWA installée avec succès');
}});
</script>
</body>
</html>
"""


def render_rss_page(categories: dict[str, str] | None = None) -> str:
    """Page de découverte des flux RSS par catégorie."""
    categories = categories or {}
    ordre_categories = [c for c in dict.fromkeys(categories.values())]
    if AUTRES not in ordre_categories:
        ordre_categories.append(AUTRES)
    slugs = slugs_categories(ordre_categories)

    themes, defaut = charger_themes()
    css = css_des_themes(themes, defaut)
    pluie = rain() if any(t["pluie"] for t in themes) else ""
    choix = choix_theme_html(themes, defaut)

    # Lien vers le flux RSS principal
    flux_principal = f'<a href="rss.xml" class="rss-lien rss-principal"><svg viewBox="0 0 20 20" aria-hidden="true"><rect y="0" width="20" height="4" fill="#5BCEFA"/><rect y="4" width="20" height="4" fill="#F5A9B8"/><rect y="8" width="20" height="4" fill="#FFFFFF"/><rect y="12" width="20" height="4" fill="#F5A9B8"/><rect y="16" width="20" height="4" fill="#5BCEFA"/><g fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><circle cx="4.5" cy="15.5" r="1.8" fill="#000" stroke="none"/><path d="M3 10.5a6.5 6.5 0 0 1 6.5 6.5"/><path d="M3 4.5a12.5 12.5 0 0 1 12.5 12.5"/></g></svg> {esc(DOMAINE)}</a>'

    # Flux par catégorie
    flux_categories = ""
    for categorie in ordre_categories:
        slug = slugs[categorie]
        flux_categories += f'<h3>{esc(categorie)}</h3><a href="rss/{slug}.xml" class="rss-lien">{ICONE_RSS} {esc(categorie)}</a>'

    bloc, bas = immuable.parties()

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flux RSS — {esc(NOM_SITE)}</title>
<meta name="description" content="Tous les flux RSS du {esc(DOMAINE)}, organisés par catégories.">
<link rel="canonical" href="{URL_SITE}/rss.html">
<meta name="theme-color" content="#000000">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KiosKe.fr">
<style>
{css}
.rss-page {{ max-width: 560px; margin: 2rem auto; padding: 2rem; }}
.rss-page h2 {{ font-size: 1.8rem; margin-bottom: 1.5rem; }}
.rss-page h3 {{ font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }}
.rss-lien {{ display: block; padding: 0.8rem 1rem; margin-bottom: 0.5rem; border: 1px solid var(--red-dim); color: var(--red-light); text-decoration: none; transition: all 0.2s; }}
.rss-lien:hover {{ background: var(--red); color: #000; }}
.rss-lien svg {{ display: inline-block; width: 1.2rem; height: 1.2rem; margin-right: 0.5rem; vertical-align: middle; }}
.rss-principal {{ border: 2px solid var(--red); font-weight: bold; }}
</style>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => {{
    navigator.serviceWorker.register('sw.js').catch(() => {{}});
  }});
}}
</script>
</head>
<body>
{pluie}<main class="panel">
  {choix}
  <p class="kicker">// {DOMAINE} flux RSS</p>
  <h1>{esc(NOM_SITE)}</h1>
  <p class="sub">Découvrez tous les flux RSS du {esc(DOMAINE)}</p>

  <div class="rss-page">
    <h2>📡 Flux RSS</h2>

    <h3>Principal</h3>
    {flux_principal}

    <h3>Par catégorie</h3>
    {flux_categories}
  </div>

  {bloc}
  {bas}
</main>
<p class="mentions">Chaque flux renvoie vers sa source d'origine. Textes, images et vidéos : leurs auteur.ice.s et sites respectifs.</p>
<script>
let openPopover = null;
document.querySelectorAll('[data-article-id]').forEach(btn => {{
  btn.addEventListener('click', (e) => {{ closePopover(); }});
}});
function closePopover() {{
  if (openPopover) {{
    openPopover.hidden = true;
    openPopover = null;
  }}
}}

// Gestion de l'installation PWA (rss.html n'a pas de popover, on laisse juste le message du navigateur)
window.addEventListener('beforeinstallprompt', (e) => {{
  e.preventDefault();
  console.log('L\'app est installable');
}});
</script>
</body>
</html>
"""
