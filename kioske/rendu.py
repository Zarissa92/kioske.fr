"""Rendu HTML de la page d'accueil (le KiosKe) et de la page des flux RSS.

Le squelette des pages est dans kioske/gabarits/ (accueil.html, rss.html), le CSS dans kioske/style.css
et le JavaScript dans kioske/js/. Ce module fabrique les morceaux qui dépendent des articles."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from .config import DOMAINE, GALERIE_PANNEAU, NOM_SITE, ORDRE_PANNEAUX, URL_SITE, CFG
from .gabarits import remplir
from .javascript import json_pour_page
from .sources import AUTRES, ordre_des_categories
from .texte import cle_alphabetique, esc, truncate_label, article_id, slug_article
from .themes import ATTRIBUTS_HTML, CHOIX_THEME, CSS, CSS_FAVORIS, CSS_RESSOURCES, SCRIPT_THEME, VARIABLES_HTML

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


def ordre_des_panneaux(noms: list[str], demande: list[str]) -> list[str]:
    """Panneaux demandés d'abord, dans leur ordre ; les autres gardent leur ordre, à la suite.
    Un nom demandé mais absent des sources est signalé (et ignoré)."""
    for nom in demande:
        if nom not in noms:
            print(f"kioske : [panneaux] ordre : « {nom} » ne correspond à aucun panneau (ignoré)", file=sys.stderr)
    rang = {nom: i for i, nom in enumerate(demande)}
    return sorted(noms, key=lambda nom: rang.get(nom, len(rang)))  # tri stable


def render_galerie_bloc(categorie: str, items: list[dict], previews: dict[str, dict]) -> str:
    """Petite galerie d'un bloc de catégorie de l'accueil : ses derniers articles ayant une image.

    « items » : les articles de la catégorie, du plus récent au plus ancien. Chaîne vide si aucun
    n'a d'image. Même balisage que la grande galerie (flèches < et >) : le script de celle-ci,
    brancherGalerie(), branche toutes les « .galerie-slider » de la page.
    """
    cartes = []
    # Les articles arrivent source par source, pas par date : on trie d'abord, pour que la galerie montre
    # les plus récents de la catégorie (et non les premiers de la première source).
    epoque = datetime.min.replace(tzinfo=timezone.utc)
    for item in sorted(items, key=lambda i: i.get("date") or epoque, reverse=True):
        if len(cartes) >= NB_GALERIE_BLOC:
            break
        apercu = previews.get(item["link"], {})
        image = apercu.get("image") or item["image"] or ""
        title = apercu.get("title") or item["title"]
        article_url = f'/articles/{article_id(item["link"])}-{slug_article(title, item["link"])}/'
        source_name = item.get("source", "")
        # Sans image : la carte affiche le titre. Image qui ne charge pas : images_repli.js met le titre à sa place (data-repli="carte").
        if image:
            media = (f'<img src="{esc(image)}" alt="{esc(title)}" loading="lazy" referrerpolicy="no-referrer" '
                     f'data-repli="carte">')
            classe = "galerie-carte"
        else:
            media = f'<span class="galerie-carte-texte">{esc(title)}</span>'
            classe = "galerie-carte galerie-carte-sans-image"
        cartes.append(
            f'<a href="{esc(article_url)}" class="{classe}" title="{esc(title)}" data-source="{esc(source_name)}">{media}</a>'
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
          date = item["date"]
          date_paris = date.astimezone(ZoneInfo("Europe/Paris")) if date else None
          date_time_str = date_paris.strftime("%d/%m/%Y<br>%H:%M") if date_paris else ""

          media = (
              f'<img src="{esc(image)}" alt="{esc(title)}" '
              'loading="lazy" referrerpolicy="no-referrer" data-repli="retirer">'
          )

          # Lien vers la page d'article
          art_id = article_id(item["link"])
          art_slug = slug_article(title, item["link"])
          article_url = f"/articles/{art_id}-{art_slug}/"

          # Titre tronqué pour afficher en dessous de la carte
          titre_court = truncate_label(title)
          source_name = item.get("source", "")

          cartes_galerie.append(
              f'<div class="galerie-carte-wrapper" data-source="{esc(source_name)}">'
              f'<a href="{esc(article_url)}" class="galerie-carte" '
              f'title="{esc(title)}">{media}<div class="galerie-carte-titre">{esc(titre_court)}</div></a>'
              f'</div>'
          )

      # Ajouter une seule fois le script de retour, pas une fois par carte
    script_galerie = ""   # galerie et repli d'images : dans le bundle commun (javascript.py)

    html = f"""
    <section class="galerie-slider galerie-principale" aria-label="12 derniers articles">
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




def _code_de_conduite() -> str:
    """Contenu du code de conduite (accueil/code-de-conduite.html), lu au build."""
    return CODE_DE_CONDUITE_PATH.read_text(encoding="utf-8") if CODE_DE_CONDUITE_PATH.exists() else ""


def page_statique(gabarit: str, nb_articles: int, nb_sources: int, *, titre: str, description: str, adresse: str,
                  **corps: str) -> str:
    """Page HTML statique avec la barre du haut partagée. Le gabarit « tete » est commun à toutes ces pages ;
    `corps` remplit les emplacements propres au gabarit (sommaire, corps…)."""
    barre = valeurs_barre(nb_articles, nb_sources)
    tete = remplir("partiels/tete_page.html", **barre, attributs_html=ATTRIBUTS_HTML, variables_html=VARIABLES_HTML,
                   titre=esc(titre), description=esc(description), adresse=esc(adresse), nom_site=esc(NOM_SITE),
                   url_site=URL_SITE, css=CSS + "\n" + barre["css_barre"], script_theme=SCRIPT_THEME,
                   )
    return remplir(gabarit, **barre, tete=tete,
                   **corps)


def render_code_de_conduite(nb_articles: int, nb_sources: int) -> str:
    """Page statique du code de conduite (accueil/code-de-conduite.html), comme la page RSS."""
    return page_statique("texte.html", nb_articles, nb_sources, titre=f"Code de conduite — {NOM_SITE}",
                         description="Code de conduite du Discord du " + NOM_SITE, adresse="/code-de-conduite.html",
                         corps=f'<h1>Code de conduite</h1><div class="ressources-texte">{_code_de_conduite()}</div>')


def valeurs_barre(nb_articles: int = 0, nb_sources: int = 0) -> dict[str, str]:
    """Tout ce que les gabarits reçoivent pour la barre du haut partagée (accueil, Ressources, article,
    catégorie, RSS) : le HTML de la barre et des panneaux, les données vides attendues par les scripts
    (le code de conduite y est), les scripts de la barre et leur feuille de style."""
    barre, panneaux = barre_et_panneaux(nb_articles, nb_sources)
    return {
        "barre_haut": barre,
        "panneaux_communs": panneaux,
        "donnees_json": json_pour_page({"sources": {}, "categories": {}, "sources_metadata": {}, "galerie_panneau": 0}),
        "css_barre": CSS_FAVORIS + "\n" + CSS_RESSOURCES,
    }


def barre_et_panneaux(nb_articles: int, nb_sources: int) -> tuple[str, str]:
    """Barre du haut (marque, compteurs, recherche, ♡, notifications, bouton Menu) et panneaux communs.
    Les mêmes sur toutes les pages."""
    barre = remplir("partiels/barre_haut.html", domaine=DOMAINE, nb_articles=nb_articles, nb_sources=nb_sources,
                    choix_theme=CHOIX_THEME)
    panneaux = remplir("partiels/panneaux_communs.html")
    return barre, panneaux



def render_page(items: list[dict], previews: dict[str, dict],
                categories: dict[str, str] | None = None,
                panneaux: dict[str, str] | None = None) -> str:
    """La page d'accueil complète (le KiosKe) : étiquettes par panneau/catégorie, fenêtres et articles."""
    categories = categories or {}
    panneaux = panneaux or {}

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

    # Grouper par panneau, puis par catégorie
    par_panneau: dict[str, dict[str, list[str]]] = {}
    par_categorie: dict[str, list[str]] = {}  # structure globale pour le code JavaScript plus bas
    for cle in ordre:
        panneau = panneaux.get(cle, "")
        categorie = categories.get(cle, AUTRES)

        # Ajouter à la structure globale
        par_categorie.setdefault(categorie, []).append(cle)

        if panneau:
            # Nouveau format avec panneaux
            if panneau not in par_panneau:
                par_panneau[panneau] = {}
            par_panneau[panneau].setdefault(categorie, []).append(cle)
        else:
            # Ancien format sans panneaux
            if "" not in par_panneau:
                par_panneau[""] = {}
            par_panneau[""].setdefault(categorie, []).append(cle)

    ordre_categories = ordre_des_categories(items, categories)

    # Créer les blocs : pour chaque panneau, afficher ses catégories (ordre : [panneaux] ordre de kioske.cfg)
    par_panneau = {nom: par_panneau[nom] for nom in ordre_des_panneaux(list(par_panneau), ORDRE_PANNEAUX)}
    blocs = ""
    for panneau_nom in par_panneau:
        categories_panneau = par_panneau[panneau_nom]

        if panneau_nom:
            # Panneau avec sous-catégories
            blocs += f'<section class="groupe panneau"><h3 class="titre-panneau" data-category-name="{esc(panneau_nom)}">{esc(panneau_nom)}</h3>'
            categories_du_panneau = sorted([c for c in categories_panneau.keys() if c != AUTRES])

            for categorie in categories_du_panneau:
                sources_keys = categories_panneau[categorie]
                tags = []
                articles_cat = []

                for cle in sources_keys:
                    source = noms[cle]
                    articles = groupes[cle]
                    nb = len(articles)
                    cle_encodee = esc(cle).replace('"', '&quot;')
                    tags.append(
                        f'<button type="button" class="tag" data-source-key="{cle_encodee}" data-source-name="{esc(truncate_label(source))}">'
                        f'{esc(truncate_label(source))} <span class="nb">×{nb}</span></button>'
                    )
                    articles_cat.extend(articles)

                # Si la catégorie porte le même nom que le panneau : masquer le h2 visuellement
                galerie_bloc = render_galerie_bloc(categorie, articles_cat, previews) if GALERIE_PANNEAU else ""
                if categorie == panneau_nom:
                    blocs += (
                        f'<h2 class="titre-panneau" style="display: none;" data-category-name="{esc(categorie)}"><span class="compte">({len(sources_keys)})</span></h2>'
                        f'{galerie_bloc}'
                        f'<div class="nuage" aria-label="{esc(categorie)}">{"".join(tags)}</div>'
                    )
                else:
                    blocs += (
                        f'<div class="sous-categorie">'
                        f'<h2 class="titre-panneau" data-category-name="{esc(categorie)}">{esc(categorie)} <span class="compte">({len(sources_keys)})</span></h2>'
                        f'{galerie_bloc}'
                        f'<div class="nuage" aria-label="{esc(categorie)}">{"".join(tags)}</div></div>'
                    )
            blocs += '</section>'
        else:
            # Catégories sans panneau (filtrer AUTRES)
            categories_du_panneau = sorted([c for c in categories_panneau.keys() if c != AUTRES])
            for categorie in categories_du_panneau:
                sources_keys = categories_panneau[categorie]
                tags = []
                articles_cat = []

                for cle in sources_keys:
                    source = noms[cle]
                    articles = groupes[cle]
                    nb = len(articles)
                    cle_encodee = esc(cle).replace('"', '&quot;')
                    tags.append(
                        f'<button type="button" class="tag" data-source-key="{cle_encodee}" data-source-name="{esc(truncate_label(source))}">'
                        f'{esc(truncate_label(source))} <span class="nb">×{nb}</span></button>'
                    )
                    articles_cat.extend(articles)

                galerie_bloc = render_galerie_bloc(categorie, articles_cat, previews) if GALERIE_PANNEAU else ""
                blocs += (
                    f'<section class="groupe">'
                    f'<h2 class="titre-panneau" data-category-name="{esc(categorie)}">{esc(categorie)} <span class="compte">({len(sources_keys)})</span></h2>'
                    f'{galerie_bloc}'
                    f'<div class="nuage" aria-label="{esc(categorie)}">{"".join(tags)}</div></section>'
                )
    nuage = f'<div class="groupes">{blocs}</div>'

    galerie_html = render_galerie(items, previews)
    # Référencement : le titre et la description décrivent le contenu réel (sources et catégories du jour).
    titre_page = NOM_SITE
    description = "Le KiosKe : une veille automatique des médias indépendants, des luttes et des voix LGBTQIA+. Une seule page statique (HTML5, CSS et JavaScript minimal), reconstruite toutes les 30 minutes sur le serveur à partir de flux RSS et de chaînes Twitch. Les images sont hébergées par le site : la page ne charge rien d'un autre site, sans publicité ni pistage."
    keywords = ("kioske, veille, médias indépendants, LGBTQIA+, Mélenchon, RSS, Twitch, informatique libre, "
                "gauchiasses, gauche, 2027, votez, La France insoumise, Rima Hassan, élections, "
                "Melenchon2027, gauchiasse, fuck le rn")

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

    # Ajouter les panneaux à categories_json : regrouper tous les articles des sous-catégories
    for panneau_nom, categories_panneau in par_panneau.items():
        if panneau_nom:  # Ignorer les sources sans panneau
            panneau_articles = []
            for categorie in sorted([c for c in categories_panneau.keys() if c != AUTRES]):
                if categorie in categories_json:
                    panneau_articles.extend(categories_json[categorie])
            # Les articles sont déjà triés par catégorie, juste les ajouter au panneau
            categories_json[panneau_nom] = panneau_articles

    # Métadonnées des sources (pour la configuration du flux personnalisé)
    sources_metadata = {}
    for cle in ordre:
        category = categories.get(cle, AUTRES)
        sources_metadata[cle] = {
            "name": noms[cle],
            "category": category
        }

    # Données lues par kioske/js/donnees_accueil.js
    donnees_json = json_pour_page(
        {"sources": groupes_json, "categories": categories_json,
         "sources_metadata": sources_metadata, "galerie_panneau": 0})

    # Barre du haut et panneaux communs : les mêmes que sur la page Ressources
    barre_haut, panneaux_communs = barre_et_panneaux(len(items), len(groupes))

    return remplir(
        "accueil.html",
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        titre=esc(titre_page),
        description=esc(description),
        mots_cles=keywords,
        url_site=URL_SITE,
        nom_site=esc(NOM_SITE),
        domaine=DOMAINE,
        date_maj=datetime.now(ZoneInfo("Europe/Paris")).strftime("%d/%m/%Y"),
        css=CSS + "\n" + CSS_FAVORIS + "\n" + CSS_RESSOURCES,
        script_theme=SCRIPT_THEME,
        donnees_json=donnees_json,
        barre_haut=barre_haut,
        panneaux_communs=panneaux_communs,
        galerie=galerie_html,
        nuage=nuage,
    )


def render_rss_page(categories: dict[str, str] | None = None, items: list[dict] | None = None) -> str:
    """Page RSS : le flux général (rss.xml). Pas de flux par catégorie (voir ecrire_flux_rss)."""
    # Lien vers le flux RSS général
    flux_principal = f'<a href="rss.xml" class="rss-lien rss-principal"><svg viewBox="0 0 20 20" aria-hidden="true"><rect y="0" width="20" height="4" fill="#5BCEFA"/><rect y="4" width="20" height="4" fill="#F5A9B8"/><rect y="8" width="20" height="4" fill="#FFFFFF"/><rect y="12" width="20" height="4" fill="#F5A9B8"/><rect y="16" width="20" height="4" fill="#5BCEFA"/><g fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><circle cx="4.5" cy="15.5" r="1.8" fill="#000" stroke="none"/><path d="M3 10.5a6.5 6.5 0 0 1 6.5 6.5"/><path d="M3 4.5a12.5 12.5 0 0 1 12.5 12.5"/></g></svg> {esc(DOMAINE)}</a>'

    return remplir(
        "rss.html",
        **valeurs_barre(len(items or []), len({i["key"] for i in (items or [])})),
        attributs_html=ATTRIBUTS_HTML,
        variables_html=VARIABLES_HTML,
        nom_site=esc(NOM_SITE),
        domaine_echappe=esc(DOMAINE),
        url_site=URL_SITE,
        css=CSS + "\n" + valeurs_barre()["css_barre"],
        script_theme=SCRIPT_THEME,
        choix_theme=CHOIX_THEME,
        domaine=DOMAINE,
        flux_principal=flux_principal,
    )
