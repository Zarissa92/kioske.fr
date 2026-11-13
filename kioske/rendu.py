"""Rendu HTML de la page d'accueil (le KiosKe). HTML5 et CSS seulement, aucun JavaScript."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from . import immuable
from .config import DOMAINE, DOSSIER_RSS_CATEGORIES, NOM_SITE, SLOGAN, URL_SITE, CFG
from .sources import AUTRES, ordre_des_categories
from .texte import cle_alphabetique, esc, slugs_categories, truncate_label, article_id, slug_article
from .themes import charger_themes, choix_theme_html, css_des_themes, rain

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


def render_card(item: dict, preview: dict, ident: str, prev_ident: str | None = None, next_ident: str | None = None) -> tuple[str, str]:
    """Une carte décoractive non cliquable (juste l'affichage).
    Renvoie (carte, "") : pas de lien, pas de panneau."""
    title = preview.get("title") or item["title"]
    summary = item["summary"] or preview.get("description", "")
    image = preview.get("image") or item["image"] or ""
    date = item["date"]
    host = urlparse(item["link"]).netloc.removeprefix("www.")

    if image:
        media = f'<img src="{esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">'
    else:
        media = f'<span class="lettre">{esc((item["source"][:1] or "•").upper())}</span>'
    date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
    date_html = f'<time datetime="{date.isoformat()}">{date_paris:%d/%m/%Y}</time> · ' if date_paris else ""

    carte = (
        f'<div class="carte" style="cursor: default;">'
        f'<span class="carte-image" aria-hidden="true">{media}</span>'
        f'<span class="carte-corps"><span class="meta">{date_html}{esc(host)}</span>'
        f'<span class="carte-titre">{esc(title)}</span><span class="carte-extrait">{esc(summary)}</span></span></div>'
    )

    return carte, ""


def render_galerie(items: list[dict], previews: dict[str, dict]) -> tuple[str, list[str]]:
    """Galerie horizontale des 12 derniers articles avec image. Renvoie (html_galerie, [])."""
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

    for display_idx, real_idx in enumerate(gal_indices):
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
    script_galerie = """
    <script>
    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".galerie-slider").forEach(slider => {
            const galerie = slider.querySelector(".galerie");
            const gauche = slider.querySelector(".galerie-arrow-left");
            const droite = slider.querySelector(".galerie-arrow-right");

            if (!galerie || !gauche || !droite) return;

            let direction = 0;
            let animationId = null;
            let lastTime = 0;
            const vitesse = 420; // pixels par seconde

            function animation(time) {
                if (direction === 0) return;

                if (lastTime) {
                    const delta = Math.min(time - lastTime, 50);
                    galerie.scrollLeft += direction * vitesse * delta / 1000;
                }

                lastTime = time;
                animationId = requestAnimationFrame(animation);
            }

            function arreter() {
                direction = 0;
                lastTime = 0;

                if (animationId !== null) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }

            function demarrer(sens) {
                arreter();

                if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    return;
                }

                direction = sens;
                animationId = requestAnimationFrame(animation);
            }

            gauche.addEventListener("mouseenter", () => demarrer(-1));
            droite.addEventListener("mouseenter", () => demarrer(1));

            gauche.addEventListener("mouseleave", arreter);
            droite.addEventListener("mouseleave", arreter);

            gauche.addEventListener("click", () => {
                arreter();
                galerie.scrollBy({ left: -250, behavior: "smooth" });
            });

            droite.addEventListener("click", () => {
                arreter();
                galerie.scrollBy({ left: 250, behavior: "smooth" });
            });

            window.addEventListener("blur", arreter);
        });
    });
    </script>
    """

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


    <script>
      history.pushState({{interception: true}}, "", location.href);
      window.addEventListener("popstate", () => {{
        window.location.replace("https://kioske.fr");
      }});
    </script>
    """
## Script ci dessus temporaire, le temps de regler lhistoire du retour. 
    return html, []




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

    blocs = "".join(
        f'<section class="groupe">'
        f'<h2>{esc(c)} <span class="compte">({len(par_categorie[c])})</span> <button type="button" class="tag-categorie" data-category-name="{esc(c)}" style="margin-left: auto; padding: 0.2rem 0.5rem; font-size: 0.8rem; background: #000; border: 1px solid var(--red); color: var(--red); cursor: pointer; font-weight: normal;">+</button></h2>'
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
    bordure_panneau_epaisseur = CFG.getint("site", "bordure_panneau_epaisseur", fallback=8)
    espacement_panneau_vertical = CFG.get("site", "espacement_panneau_vertical", fallback="2.4rem")

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
                    "source": item["source"]
                })
        # Trier par date (plus récents d'abord)
        articles_data.sort(key=lambda a: a["date"], reverse=True)
        categories_json[categorie] = articles_data

    import json
    groupes_json_str = json.dumps(groupes_json, ensure_ascii=False)
    categories_json_str = json.dumps(categories_json, ensure_ascii=False)

    # Charger le contenu du code de conduite
    conduite_html = ""
    if CODE_DE_CONDUITE_PATH.exists():
        conduite_html = CODE_DE_CONDUITE_PATH.read_text(encoding="utf-8")

    # Générer les boutons de réseaux sociaux conditionnellement
    boutons_reseaux = ""
    if lien_rss:
        boutons_reseaux += f'<button type="button" class="menu-button" onclick="window.location.href=\'{lien_rss}\'">📡 Flux RSS</button>\n      '
    if lien_discord:
        boutons_reseaux += f'<button type="button" class="menu-button" onclick="window.open(\'{lien_discord}\', \'_blank\')">💜 Discord</button>\n      '
    if lien_mastodon:
        boutons_reseaux += f'<button type="button" class="menu-button" onclick="window.open(\'{lien_mastodon}\', \'_blank\')">🦣 Mastodon</button>\n      '

    # Générer la navbar
    navbar_html = f"""<nav class="kioske-navbar">
  <a href="/" class="navbar-brand">
    <span class="flag">🏳️‍⚧️</span>
    <span>{DOMAINE}</span>
    <span class="navbar-stats">{len(items)} · {len(groupes)} sources</span>
  </a>

  <div class="navbar-search">
    <input type="text" id="recherche" placeholder="Chercher..." aria-label="Barre de recherche">
  </div>

  <div class="navbar-controls">
    <button type="button" class="btn-favs" title="Mes favoris" onclick="openFavoritesPanel()">♡</button>
    <button type="button" class="btn-menu" title="Menu" onclick="document.querySelector('.navbar-menu').classList.toggle('open'); document.querySelector('.navbar-menu').setAttribute('aria-expanded', document.querySelector('.navbar-menu').classList.contains('open'))">≡</button>
  </div>

  <div class="navbar-menu" aria-expanded="false">
    <div class="navbar-menu-group">
      <div class="navbar-menu-title">🎨 Thèmes</div>
      <div class="theme-options">
        {choix}
      </div>
    </div>

    <div class="navbar-menu-group">
      {boutons_reseaux}<button type="button" class="menu-button" id="btn-open-conduite">📖 Code de conduite</button>
    </div>
  </div>
</nav>"""

    return f"""<!DOCTYPE html>
<html lang="fr" style="--largeur-carte-ouverte: {largeur_carte_ouverte}; --hauteur-carte-ouverte: {hauteur_carte_ouverte / 100}; --bordure-panneau-epaisseur: {bordure_panneau_epaisseur}px; --espacement-panneau-vertical: {espacement_panneau_vertical};">
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
<style>
{css}
/* Styles pour le code de conduite */
.conduct-panneau h2 {{ font-size: clamp(1.1rem, 2.6vw, 1.3rem); color: #fff; margin: 0; padding: 0; }}
.conduct-panneau h3 {{ font-size: 1rem; color: #fff; margin: 1.2rem 0 0.4rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--red-dim); }}
.conduct-panneau p {{ margin: 0.5rem 0; line-height: 1.5; }}
.conduct-panneau ul {{ margin: 0.5rem 0 0.5rem 1.2rem; }}
.conduct-panneau li {{ margin-bottom: 0.3rem; }}
.conduct-panneau blockquote {{ margin: 0.5rem 0; padding: 0.6rem 0.9rem; border-left: 3px solid var(--red); background: rgba(255, 255, 255, .05); font-style: italic; }}
.conduct-panneau strong {{ color: #fff; }}
</style>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => {{
    navigator.serviceWorker.register('sw.js').catch(() => {{}});
  }});
}}
// Données des articles groupés par source (clé)
window.sourcesData = {groupes_json_str};
// Données des articles groupés par catégorie
window.categoriesData = {categories_json_str};
// Contenu du code de conduite
window.conductCode = {json.dumps(conduite_html, ensure_ascii=False)};
</script>
</head>
<body>
{pluie}{navbar_html}
<main class="panel">
  {galerie_html}
  {nuage}
</main>
<div id="bloc-infos-container" class="infos-container" hidden>
  <div class="infos-backdrop" data-close-infos="bloc-infos"></div>
  <div id="bloc-infos" class="popover-infos">
    <button type="button" class="infos-fermer" data-close-infos="bloc-infos" aria-label="Fermer">×</button>
    <div class="popover-contenu">
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

<section class="cartes" aria-label="Conteneur des panneaux">
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
  // Fermer le menu navbar quand on ouvre un panneau
  const navbarMenu = document.querySelector('.navbar-menu');
  if (navbarMenu) navbarMenu.classList.remove('open');

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
  }} else if (id.startsWith('cat-') || id.startsWith('source-') || id === 'search-results' || id === 'favoris' || id === 'conduct') {{
    const container = document.getElementById('container-' + id);
    if (container) {{
      container.hidden = false;
      openPopover = container;
      const panel = document.getElementById(id + '-panneau');
      if (!panel) return;
      if (scrollPositions[id] !== undefined) {{
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
// Fermer le menu navbar au clic dehors
document.addEventListener('click', (e) => {{
  const navbar = document.querySelector('.kioske-navbar');
  const menu = document.querySelector('.navbar-menu');
  const btnMenu = document.querySelector('.btn-menu');
  if (navbar && menu && btnMenu && !navbar.contains(e.target)) {{
    menu.classList.remove('open');
  }}
}});

// Taille du site (zoom global) - slider du popover
const tailleSlider = document.getElementById('taille-site');
const tailleValeur = document.querySelector('.taille-valeur');
if (tailleSlider) {{
  const tailleSauvegardee = localStorage.getItem('kioske-taille') || tailleSlider.value;
  tailleSlider.value = tailleSauvegardee;
  document.documentElement.style.zoom = (tailleSauvegardee / 100);
  if (tailleValeur) tailleValeur.textContent = tailleSauvegardee + '%';

  tailleSlider.addEventListener('input', (e) => {{
    const valeur = e.target.value;
    document.documentElement.style.zoom = (valeur / 100);
    if (tailleValeur) tailleValeur.textContent = valeur + '%';
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
// Crée un panneau pour afficher les articles d'une source
function createSourcePanel(sourceKey, sourceName) {{
  const normalized = sourceKey.replace(/[^a-z0-9-]/gi, '_');
  const sourceId = 'source-' + normalized;
  const containerId = 'container-' + sourceId;

  if (document.getElementById(containerId)) return;
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.setAttribute('data-close-source', sourceKey);
  backdrop.addEventListener('click', (e) => {{ if (e.target === backdrop) closePopover(); }});

  const panneau = document.createElement('div');
  panneau.id = sourceId + '-panneau';
  panneau.className = 'categorie-panneau';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.marginBottom = '1rem';

  const titre = document.createElement('h2');
  titre.textContent = sourceName;
  titre.style.textAlign = 'center';
  titre.style.margin = '0 0 0.8rem 0';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('data-article-id', sourceId);
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.style.position = 'static';
  fermer.style.width = 'auto';
  fermer.style.height = 'auto';
  fermer.style.padding = '0.4rem 0.8rem';
  fermer.addEventListener('click', () => closePopover());

  const grille = document.createElement('div');
  grille.className = 'grille';
  grille.id = sourceId + '-grille';

  // Conteneur scrollable pour la grille seulement
  const grilleContainer = document.createElement('div');
  grilleContainer.style.flex = '1';
  grilleContainer.style.overflow = 'auto';
  grilleContainer.style.minHeight = '0';
  grilleContainer.appendChild(grille);

  // Restructurer le panneau avec flexbox
  panneau.style.display = 'flex';
  panneau.style.flexDirection = 'column';

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);
  panneau.appendChild(grilleContainer);
  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);

  fermer.addEventListener('click', () => closePopover());

  // Remplir la grille avec les articles avec pagination
  const articles = window.sourcesData[sourceKey] || [];
  const articlesPerPage = 30;
  let currentPage = 1;
  const totalPages = Math.ceil(articles.length / articlesPerPage);

  // Créer le conteneur de pagination
  const paginationContainer = document.createElement('div');
  paginationContainer.style.display = 'flex';
  paginationContainer.style.justifyContent = 'center';
  paginationContainer.style.alignItems = 'center';
  paginationContainer.style.gap = '1rem';
  paginationContainer.style.marginTop = '1rem';
  paginationContainer.style.padding = '0.5rem';

  const btnPrecedentes = document.createElement('button');
  btnPrecedentes.type = 'button';
  btnPrecedentes.className = 'pagination-btn';
  btnPrecedentes.textContent = '← Pages précédentes';
  btnPrecedentes.style.padding = '0.4rem 0.8rem';
  btnPrecedentes.style.background = '#0a0000';
  btnPrecedentes.style.border = '1px solid var(--red-dim)';
  btnPrecedentes.style.color = 'var(--red)';
  btnPrecedentes.style.cursor = 'pointer';
  btnPrecedentes.style.font = 'inherit';

  const pageInfo = document.createElement('span');
  pageInfo.style.minWidth = '80px';
  pageInfo.style.textAlign = 'center';
  pageInfo.style.color = 'var(--red)';

  const btnSuivantes = document.createElement('button');
  btnSuivantes.type = 'button';
  btnSuivantes.className = 'pagination-btn';
  btnSuivantes.textContent = 'Pages suivantes →';
  btnSuivantes.style.padding = '0.4rem 0.8rem';
  btnSuivantes.style.background = '#0a0000';
  btnSuivantes.style.border = '1px solid var(--red-dim)';
  btnSuivantes.style.color = 'var(--red)';
  btnSuivantes.style.cursor = 'pointer';
  btnSuivantes.style.font = 'inherit';

  function afficherPage(page) {{
    currentPage = Math.max(1, Math.min(page, totalPages));
    grille.innerHTML = '';

    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesPage = articles.slice(start, end);

    articlesPage.forEach(article => {{
      const carte = document.createElement('a');
      carte.href = article.url;
      carte.className = 'carte';
      carte.style.textDecoration = 'none';
      carte.style.color = 'inherit';

      const media = article.image
        ? `<img src="${{article.image}}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="lettre">${{article.source.charAt(0).toUpperCase() || '•'}}</span>`;

      carte.innerHTML =
        `<span class="carte-image" aria-hidden="true">${{media}}</span>` +
        `<span class="carte-corps">` +
        `<span class="meta">${{article.date}} · ${{article.host}}</span>` +
        `<span class="carte-titre">${{article.title}}</span>` +
        `<span class="carte-extrait">${{article.summary}}</span>` +
        `</span>`;

      grille.appendChild(carte);
    }});

    pageInfo.textContent = `Page ${{currentPage}} / ${{totalPages}}`;
    btnPrecedentes.disabled = currentPage === 1;
    btnSuivantes.disabled = currentPage === totalPages;
    btnPrecedentes.style.opacity = currentPage === 1 ? '0.5' : '1';
    btnSuivantes.style.opacity = currentPage === totalPages ? '0.5' : '1';
  }}

  btnPrecedentes.addEventListener('click', () => afficherPage(currentPage - 1));
  btnSuivantes.addEventListener('click', () => afficherPage(currentPage + 1));

  paginationContainer.appendChild(btnPrecedentes);
  paginationContainer.appendChild(pageInfo);
  paginationContainer.appendChild(btnSuivantes);
  panneau.appendChild(paginationContainer);

  afficherPage(1);
}}

// Crée un panneau pour afficher les articles d'une catégorie
function createCategoryPanel(categoryName) {{
  const normalized = categoryName.replace(/[^a-z0-9-]/gi, '_');
  const categoryId = 'cat-' + normalized;
  const containerId = 'container-' + categoryId;

  if (document.getElementById(containerId)) return;
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.setAttribute('data-close-source', categoryName);
  backdrop.addEventListener('click', (e) => {{ if (e.target === backdrop) closePopover(); }});

  const panneau = document.createElement('div');
  panneau.id = categoryId + '-panneau';
  panneau.className = 'categorie-panneau';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.marginBottom = '1rem';

  const titre = document.createElement('h2');
  titre.textContent = categoryName;
  titre.style.textAlign = 'center';
  titre.style.margin = '0 0 0.8rem 0';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('data-article-id', categoryId);
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.style.position = 'static';
  fermer.style.width = 'auto';
  fermer.style.height = 'auto';
  fermer.style.padding = '0.4rem 0.8rem';
  fermer.addEventListener('click', () => closePopover());

  const grille = document.createElement('div');
  grille.className = 'grille';
  grille.id = categoryId + '-grille';

  // Conteneur scrollable pour la grille seulement
  const grilleContainer = document.createElement('div');
  grilleContainer.style.flex = '1';
  grilleContainer.style.overflow = 'auto';
  grilleContainer.style.minHeight = '0';
  grilleContainer.appendChild(grille);

  // Restructurer le panneau avec flexbox
  panneau.style.display = 'flex';
  panneau.style.flexDirection = 'column';

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);
  panneau.appendChild(grilleContainer);
  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);

  fermer.addEventListener('click', () => closePopover());

  // Remplir la grille avec les articles avec pagination
  const articles = window.categoriesData[categoryName] || [];
  const articlesPerPage = 30;
  let currentPage = 1;
  const totalPages = Math.ceil(articles.length / articlesPerPage);

  // Créer le conteneur de pagination
  const paginationContainer = document.createElement('div');
  paginationContainer.style.display = 'flex';
  paginationContainer.style.justifyContent = 'center';
  paginationContainer.style.alignItems = 'center';
  paginationContainer.style.gap = '1rem';
  paginationContainer.style.marginTop = '1rem';
  paginationContainer.style.padding = '0.5rem';

  const btnPrecedentes = document.createElement('button');
  btnPrecedentes.type = 'button';
  btnPrecedentes.className = 'pagination-btn';
  btnPrecedentes.textContent = '← Pages précédentes';
  btnPrecedentes.style.padding = '0.4rem 0.8rem';
  btnPrecedentes.style.background = '#0a0000';
  btnPrecedentes.style.border = '1px solid var(--red-dim)';
  btnPrecedentes.style.color = 'var(--red)';
  btnPrecedentes.style.cursor = 'pointer';
  btnPrecedentes.style.font = 'inherit';

  const pageInfo = document.createElement('span');
  pageInfo.style.minWidth = '80px';
  pageInfo.style.textAlign = 'center';
  pageInfo.style.color = 'var(--red)';

  const btnSuivantes = document.createElement('button');
  btnSuivantes.type = 'button';
  btnSuivantes.className = 'pagination-btn';
  btnSuivantes.textContent = 'Pages suivantes →';
  btnSuivantes.style.padding = '0.4rem 0.8rem';
  btnSuivantes.style.background = '#0a0000';
  btnSuivantes.style.border = '1px solid var(--red-dim)';
  btnSuivantes.style.color = 'var(--red)';
  btnSuivantes.style.cursor = 'pointer';
  btnSuivantes.style.font = 'inherit';

  function afficherPage(page) {{
    currentPage = Math.max(1, Math.min(page, totalPages));
    grille.innerHTML = '';

    const start = (currentPage - 1) * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesPage = articles.slice(start, end);

    articlesPage.forEach(article => {{
      const carte = document.createElement('a');
      carte.href = article.url;
      carte.className = 'carte';
      carte.style.textDecoration = 'none';
      carte.style.color = 'inherit';

      const media = article.image
        ? `<img src="${{article.image}}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="lettre">${{article.source.charAt(0).toUpperCase() || '•'}}</span>`;

      carte.innerHTML =
        `<span class="carte-image" aria-hidden="true">${{media}}</span>` +
        `<span class="carte-corps">` +
        `<span class="meta">${{article.date}} · ${{article.host}}</span>` +
        `<span class="carte-titre">${{article.title}}</span>` +
        `<span class="carte-extrait">${{article.summary}}</span>` +
        `</span>`;

      grille.appendChild(carte);
    }});

    pageInfo.textContent = `Page ${{currentPage}} / ${{totalPages}}`;
    btnPrecedentes.disabled = currentPage === 1;
    btnSuivantes.disabled = currentPage === totalPages;
    btnPrecedentes.style.opacity = currentPage === 1 ? '0.5' : '1';
    btnSuivantes.style.opacity = currentPage === totalPages ? '0.5' : '1';
  }}

  btnPrecedentes.addEventListener('click', () => afficherPage(currentPage - 1));
  btnSuivantes.addEventListener('click', () => afficherPage(currentPage + 1));

  paginationContainer.appendChild(btnPrecedentes);
  paginationContainer.appendChild(pageInfo);
  paginationContainer.appendChild(btnSuivantes);
  panneau.appendChild(paginationContainer);

  afficherPage(1);
}}

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

// Crée un panneau pour afficher le code de conduite
function createConductPanel() {{
  if (document.getElementById('container-conduct')) return;
  const container = document.createElement('div');
  container.id = 'container-conduct';
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.addEventListener('click', (e) => {{ if (e.target === backdrop) closePopover(); }});

  const panneau = document.createElement('div');
  panneau.id = 'conduct-panneau';
  panneau.className = 'categorie-panneau conduct-panneau';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'row';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '1rem';

  const titre = document.createElement('h2');
  titre.textContent = 'Code de conduite du Discord';
  titre.style.margin = '0';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.style.position = 'static';
  fermer.style.width = 'auto';
  fermer.style.height = 'auto';
  fermer.style.padding = '0.4rem 0.8rem';
  fermer.addEventListener('click', () => closePopover());

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);

  const contenuContainer = document.createElement('div');
  contenuContainer.style.flex = '1';
  contenuContainer.style.overflow = 'auto';
  contenuContainer.style.minHeight = '0';
  contenuContainer.innerHTML = window.conductCode || '<p>Contenu non disponible</p>';
  panneau.appendChild(contenuContainer);

  // Ajouter les boutons de partage
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.gap = '0.8rem';
  buttonsContainer.style.marginTop = '1rem';
  buttonsContainer.style.borderTop = '1px solid var(--red-dim)';
  buttonsContainer.style.paddingTop = '1rem';
  buttonsContainer.style.justifyContent = 'center';

  const btnShare = document.createElement('button');
  btnShare.type = 'button';
  btnShare.textContent = '📤 Partager';
  btnShare.style.padding = '0.6rem 1rem';
  btnShare.style.background = '#0a0000';
  btnShare.style.border = '1px solid var(--red-dim)';
  btnShare.style.color = 'var(--red)';
  btnShare.style.cursor = 'pointer';
  btnShare.style.font = 'inherit';
  btnShare.style.transition = 'all 0.2s ease';
  btnShare.addEventListener('mouseover', () => {{ btnShare.style.background = 'var(--red)'; btnShare.style.color = '#000'; }});
  btnShare.addEventListener('mouseout', () => {{ btnShare.style.background = '#0a0000'; btnShare.style.color = 'var(--red)'; }});
  btnShare.addEventListener('click', () => {{
    if (navigator.share) {{
      navigator.share({{
        title: 'Code de conduite du Discord',
        url: window.location.href
      }}).catch(err => console.log('Partage annulé'));
    }} else {{
      alert('Le partage n\\'est pas disponible sur ce navigateur');
    }}
  }});

  const btnCopy = document.createElement('button');
  btnCopy.type = 'button';
  btnCopy.textContent = '🔗 Copier le lien';
  btnCopy.style.padding = '0.6rem 1rem';
  btnCopy.style.background = '#0a0000';
  btnCopy.style.border = '1px solid var(--red-dim)';
  btnCopy.style.color = 'var(--red)';
  btnCopy.style.cursor = 'pointer';
  btnCopy.style.font = 'inherit';
  btnCopy.style.transition = 'all 0.2s ease';
  btnCopy.addEventListener('mouseover', () => {{ btnCopy.style.background = 'var(--red)'; btnCopy.style.color = '#000'; }});
  btnCopy.addEventListener('mouseout', () => {{ btnCopy.style.background = '#0a0000'; btnCopy.style.color = 'var(--red)'; }});
  btnCopy.addEventListener('click', () => {{
    navigator.clipboard.writeText(window.location.href).then(() => {{
      const originalText = btnCopy.textContent;
      btnCopy.textContent = '✓ Copié !';
      btnCopy.style.color = '#00ff00';
      setTimeout(() => {{
        btnCopy.textContent = originalText;
        btnCopy.style.color = 'var(--red)';
      }}, 2000);
    }}).catch(() => {{
      alert('Erreur lors de la copie du lien');
    }});
  }});

  buttonsContainer.appendChild(btnShare);
  buttonsContainer.appendChild(btnCopy);
  panneau.appendChild(buttonsContainer);

  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);
  fermer.addEventListener('click', () => closePopover());
}}
// Gestion des tags cliquables (sources)
document.querySelectorAll('.nuage .tag').forEach(tag => {{
  tag.addEventListener('click', (e) => {{
    const sourceKey = tag.getAttribute('data-source-key');
    const sourceName = tag.getAttribute('data-source-name');
    if (sourceKey && sourceName) {{
      createSourcePanel(sourceKey, sourceName);
      const sourceId = 'source-' + sourceKey.replace(/[^a-z0-9-]/gi, '_');
      showPopover(sourceId);
      // Fermer le menu +
      const infosContainer = document.getElementById('bloc-infos-container');
      if (infosContainer) infosContainer.hidden = true;
    }}
  }});
}});

// Gestion des boutons "+ " des catégories
document.querySelectorAll('.tag-categorie').forEach(btn => {{
  btn.addEventListener('click', (e) => {{
    e.preventDefault();
    const categoryName = btn.getAttribute('data-category-name');
    if (categoryName) {{
      createCategoryPanel(categoryName);
      const categoryId = 'cat-' + categoryName.replace(/[^a-z0-9-]/gi, '_');
      showPopover(categoryId);
      // Fermer le menu +
      const infosContainer = document.getElementById('bloc-infos-container');
      if (infosContainer) infosContainer.hidden = true;
    }}
  }});
}});

// Barre de recherche
const rechercheInput = document.getElementById('recherche');
if (rechercheInput) {{
  rechercheInput.addEventListener('keydown', (e) => {{
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = rechercheInput.value.toLowerCase().trim();
    if (!query) return;

    console.log('Recherche lancée pour: ' + query);

    // Créer le panneau s'il n'existe pas
    createSearchResultsPanel();

    // Charger l'index JSON et filtrer les articles
    fetch('/articles-index.json')
      .then(response => {{
        if (!response.ok) throw new Error(`HTTP ${{response.status}}`);
        return response.json();
      }})
      .then(articles => {{
        const resultGrid = document.getElementById('search-results-grille');
        if (!resultGrid) {{
          console.error('Grille de résultats non trouvée');
          return;
        }}
        resultGrid.innerHTML = '';

        // Filtrer les articles par query
        const results = articles.filter(article => {{
          const searchText = (article.title + ' ' + article.summary + ' ' + article.source).toLowerCase();
          return searchText.includes(query);
        }});

        console.log(`Trouvé ${{results.length}} résultats pour "${{query}}"`);

        // Créer les cartes au format Pokémon
        results.forEach(article => {{
          const carte = document.createElement('a');
          carte.href = article.url;
          carte.className = 'carte';
          carte.style.textDecoration = 'none';
          carte.style.color = 'inherit';

          const media = article.image
            ? `<img src="${{article.image}}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<span class="lettre">${{article.source.charAt(0).toUpperCase() || '•'}}</span>`;

          carte.innerHTML =
            `<span class="carte-image" aria-hidden="true">${{media}}</span>` +
            `<span class="carte-corps">` +
            `<span class="meta">${{article.date}} · ${{article.host}}</span>` +
            `<span class="carte-titre">${{article.title}}</span>` +
            `<span class="carte-extrait">${{article.summary}}</span>` +
            `</span>`;

          resultGrid.appendChild(carte);
        }});

        if (results.length > 0) {{
          const compte = document.querySelector('#search-results-panneau h2 .compte');
          if (compte) {{
            compte.textContent = `(${{results.length}})`;
          }}
          console.log('Panneau de résultats affichés');
          showPopover('search-results');
          // Fermer le menu +
          const infosContainer = document.getElementById('bloc-infos-container');
          if (infosContainer) infosContainer.hidden = true;
        }} else {{
          alert('Aucun résultat trouvé pour: ' + query);
        }}
      }})
      .catch(err => {{
        console.error('Erreur lors du chargement de l\\\'index:', err);
        alert('Erreur lors de la recherche. Vérifiez votre connexion.');
      }});
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
  const articleLink = heart.getAttribute('data-article-link');
  if (!articleLink) return;

  const favorites = getFavorites();
  const favKey = 'fav_' + articleLink.replace(/[^a-z0-9]/gi, '_');

  if (favorites[favKey]) {{
    delete favorites[favKey];
    heart.classList.remove('active');
  }} else {{
    // Chercher l'article dans les sources et catégories
    let articleData = null;
    for (const sourceKey in window.sourcesData) {{
      const articles = window.sourcesData[sourceKey];
      const found = articles.find(a => a.url === articleLink);
      if (found) {{
        articleData = found;
        break;
      }}
    }}

    if (!articleData) {{
      for (const categoryName in window.categoriesData) {{
        const articles = window.categoriesData[categoryName];
        const found = articles.find(a => a.url === articleLink);
        if (found) {{
          articleData = found;
          break;
        }}
      }}
    }}

    if (articleData) {{
      favorites[favKey] = {{
        id: articleData.id,
        title: articleData.title,
        image: articleData.image,
        summary: articleData.summary,
        date: articleData.date,
        host: articleData.host,
        url: articleData.url,
        source: articleData.source,
        timestamp: new Date().toISOString()
      }};
      heart.classList.add('active');
    }}
  }}
  saveFavorites(favorites);
}}

function updateHearts() {{
  const favorites = getFavorites();
  document.querySelectorAll('.fav-heart').forEach(heart => {{
    const articleLink = heart.getAttribute('data-article-link');
    const favKey = 'fav_' + articleLink.replace(/[^a-z0-9]/gi, '_');
    if (favorites[favKey]) {{
      heart.classList.add('active');
    }} else {{
      heart.classList.remove('active');
    }}
  }});
}}

function openFavoritesPanel() {{
  // Fermer le menu navbar quand on ouvre le panneau des favoris
  const navbarMenu = document.querySelector('.navbar-menu');
  if (navbarMenu) navbarMenu.classList.remove('open');

  closePopover();
  document.getElementById('bloc-infos-container').hidden = true;

  const favGrille = document.getElementById('fav-grille');
  const favorites = getFavorites();
  favGrille.innerHTML = '';

  if (Object.keys(favorites).length === 0) {{
    favGrille.innerHTML = '<p style="grid-column: 1/-1; color: #888; padding: 2rem; text-align: center;">Aucun favori pour le moment</p>';
  }} else {{
    Object.entries(favorites).forEach(([favKey, data]) => {{
      // Créer la carte depuis les données stockées (avec fallback pour données incomplètes)
      const carte = document.createElement('a');
      carte.href = data.url || data.lien || '#';
      carte.className = 'carte';
      carte.style.textDecoration = 'none';
      carte.style.color = 'inherit';

      const source = data.source || 'Article';
      const media = data.image
        ? `<img src="${{data.image}}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="lettre">${{source.charAt(0).toUpperCase() || '•'}}</span>`;

      const metaText = [data.date, data.host].filter(x => x).join(' · ') || 'Sans date';
      const title = data.title || data.titre || 'Sans titre';
      const summary = data.summary || '';

      carte.innerHTML =
        `<span class="carte-image" aria-hidden="true">${{media}}</span>` +
        `<span class="carte-corps">` +
        `<span class="meta">${{metaText}}</span>` +
        `<span class="carte-titre">${{title}}</span>` +
        `<span class="carte-extrait">${{summary}}</span>` +
        `</span>`;

      favGrille.appendChild(carte);
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

// Gestionnaire pour le bouton "Code de conduite"
const btnOpenConduct = document.getElementById('btn-open-conduite');
if (btnOpenConduct) {{
  btnOpenConduct.addEventListener('click', () => {{
    createConductPanel();
    showPopover('conduct');
    // Fermer le menu
    const menu = document.querySelector('.navbar-menu');
    if (menu) menu.classList.remove('open');
  }});
}}

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
