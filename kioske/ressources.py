"""Page Ressources : des documents Markdown, écrits en pages statiques au build (comme les articles).

Arborescence (dossier ressources/ à la racine du projet) :

    ressources/<categorie>/<document>.md
    ressources/<categorie>/<sous-categorie>/<document>.md

Le dossier de premier niveau est une catégorie, celui de second niveau une sous-catégorie. Un dossier
plus profond est ignoré (signalé au build). Le nom du fichier .md donne l'adresse du document.

En tête de fichier, un bloc facultatif (sans bibliothèque YAML : une clé par ligne) :

    ---
    titre: Titre affiché
    description: Une phrase sous le titre
    ordre: 10
    ---

Un dossier peut avoir un fichier _dossier.md, dont seul le bloc de tête compte : titre, description et
ordre de la catégorie ou de la sous-catégorie. Sans ordre, les éléments suivent l'ordre alphabétique,
après ceux qui en ont un. Les fichiers et dossiers dont le nom commence par un point ou un _ sont ignorés.

Un fichier .md à la racine de ressources/ devient une catégorie, comme un dossier : son titre et son ordre
viennent de son bloc de tête (ou de son nom), et son contenu est l'unique document de la catégorie, à
l'adresse /ressources/<nom>/. Exception : ressources/index.md (facultatif) est le texte d'introduction de la
page d'index, rendu en Markdown au-dessus du sommaire ; il n'est pas une catégorie.

Sorties (dans build/ressources/) : index.html (la liste, avec le sommaire) et une page par document,
ressources/<catégorie>/[<sous-catégorie>/]<document>/index.html, avec le même sommaire.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

import markdown

from .config import BUILD, NOM_SITE, RESSOURCES
from .rendu import page_statique
from .texte import cle_alphabetique, esc, slug_categorie

DOSSIER_WEB = "ressources"          # build/ressources/ et adresse /ressources/
FICHIER_INTRO = "index.md"          # texte d'introduction de la page d'index (racine de ressources/)
FICHIER_DOSSIER = "_dossier.md"     # titre, description et ordre d'une catégorie ou sous-catégorie
# tableaux, code délimité, listes propres, notes ; nl2br : un saut de ligne dans un paragraphe reste un saut
EXTENSIONS_MARKDOWN = ["extra", "sane_lists", "nl2br"]

_FRONT_MATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.S)


def separer_front_matter(texte: str) -> tuple[dict[str, str], str]:
    """(bloc de tête en dictionnaire, corps du document). Sans bloc : ({}, texte)."""
    correspondance = _FRONT_MATTER.match(texte)
    if not correspondance:
        return {}, texte
    meta: dict[str, str] = {}
    for ligne in correspondance.group(1).splitlines():
        cle, deux_points, valeur = ligne.partition(":")
        if deux_points and cle.strip():
            meta[cle.strip().lower()] = valeur.strip().strip("\"'")
    return meta, texte[correspondance.end():]


def _titre_du_nom(nom: str) -> str:
    """Titre affiché à partir d'un nom de fichier ou de dossier : « _ » et « - » comptent comme des espaces."""
    return re.sub(r"\s+", " ", re.sub(r"[_-]", " ", nom)).strip()


def _ordre(meta: dict[str, str]) -> int | None:
    try:
        return int(meta["ordre"])
    except (KeyError, ValueError):
        return None


def _trier(elements: list[dict]) -> list[dict]:
    """Ordre demandé d'abord (ordre croissant), puis alphabétique ; les éléments sans ordre suivent."""
    return sorted(elements, key=lambda e: (e["ordre"] is None, e["ordre"] or 0, cle_alphabetique(e["titre"])))


def _visible(chemin: Path) -> bool:
    return not chemin.name.startswith((".", "_"))


def _dossiers(dossier: Path) -> list[Path]:
    return sorted(c for c in dossier.iterdir() if c.is_dir() and _visible(c))


def _documents(dossier: Path) -> list[Path]:
    return sorted(f for f in dossier.glob("*.md") if f.is_file() and _visible(f))


def _slugs_uniques(noms: list[str]) -> list[str]:
    """Un slug par nom, sans doublon dans le même dossier (« -2 », « -3 » ajoutés au besoin)."""
    utilises: set[str] = set()
    slugs = []
    for nom in noms:
        base = slug_categorie(nom)
        slug, numero = base, 2
        while slug in utilises:
            slug, numero = f"{base}-{numero}", numero + 1
        utilises.add(slug)
        slugs.append(slug)
    return slugs


def _meta_dossier(dossier: Path) -> dict[str, str]:
    fichier = dossier / FICHIER_DOSSIER
    if not fichier.is_file():
        return {}
    meta, _ = separer_front_matter(fichier.read_text(encoding="utf-8"))
    return meta


def _entree(fichier: Path, parents: list[str], slug: str) -> dict:
    meta, corps = separer_front_matter(fichier.read_text(encoding="utf-8"))
    return {
        "titre": meta.get("titre") or _titre_du_nom(fichier.stem),
        "slug": slug,
        "chemin": "/".join([*parents, slug]),
        "description": meta.get("description", ""),
        "ordre": _ordre(meta),
        "html": markdown.markdown(corps, extensions=EXTENSIONS_MARKDOWN),
    }


def _entrees(dossier: Path, parents: list[str]) -> list[dict]:
    fichiers = _documents(dossier)
    slugs = _slugs_uniques([f.stem for f in fichiers])
    return _trier([_entree(f, parents, s) for f, s in zip(fichiers, slugs)])


def _groupe(dossier: Path, parents: list[str], slug: str) -> dict:
    meta = _meta_dossier(dossier)
    return {
        "titre": meta.get("titre") or _titre_du_nom(dossier.name),
        "slug": slug,
        "description": meta.get("description", ""),
        "ordre": _ordre(meta),
        "entrees": _entrees(dossier, [*parents, slug]),
    }


def charger_arbre(racine: Path = RESSOURCES) -> list[dict]:
    """Catégories triées, chacune avec ses entrées directes et ses sous-catégories."""
    if not racine.is_dir():
        return []
    dossiers = _dossiers(racine)
    fichiers = [f for f in _documents(racine) if f.name != FICHIER_INTRO]
    slugs = _slugs_uniques([d.name for d in dossiers] + [f.stem for f in fichiers])
    categories = []
    for fichier, slug in zip(fichiers, slugs[len(dossiers):]):
        entree = _entree(fichier, [], slug)
        categories.append({"titre": entree["titre"], "slug": slug, "description": entree["description"],
                           "ordre": entree["ordre"], "entrees": [entree], "sous": [], "fichier": True})
    for dossier, slug in zip(dossiers, slugs):
        categorie = _groupe(dossier, [], slug)
        sous = []
        sous_dossiers = _dossiers(dossier)
        for sous_dossier, slug_sous in zip(sous_dossiers, _slugs_uniques([d.name for d in sous_dossiers])):
            sous.append(_groupe(sous_dossier, [slug], slug_sous))
            for trop_profond in _dossiers(sous_dossier):
                print(f"   ! {trop_profond.relative_to(racine)} : dossier trop profond, ignoré")
        categorie["sous"] = _trier(sous)
        categories.append(categorie)
    return _trier(categories)


def _lien(chemin: str) -> str:
    return "/ressources/" + chemin + "/"


def _liste(entrees: list[dict], actif: str) -> str:
    items = []
    for e in entrees:
        attribut = ' aria-current="page"' if e["chemin"] == actif else ""
        items.append('<li><a href="' + esc(_lien(e["chemin"])) + '"' + attribut + ">" + esc(e["titre"]) + "</a></li>")
    return '<ul class="ressources-liste">' + "".join(items) + "</ul>"


def _bloc(titre: str, ouvert: bool, corps: str) -> str:
    return "<details" + (" open" if ouvert else "") + "><summary>" + esc(titre) + "</summary>" + corps + "</details>"


def sommaire_html(arbre: list[dict], actif: str = "") -> str:
    """Le sommaire en HTML (catégories et sous-catégories repliables). Le document actif est surligné et sa
    catégorie est dépliée. Une seule catégorie : dépliée aussi."""
    blocs = []
    meta_index, intro = _intro()
    if intro:  # la page d'index est un lien comme les autres pages
        attribut = ' aria-current="page"' if actif == "" else ""
        blocs.append('<ul class="ressources-liste"><li><a href="/ressources/"' + attribut + ">"
                     + esc(meta_index.get("titre") or "Ressources") + "</a></li></ul>")
    for cat in arbre:
        if cat.get("fichier"):  # un fichier à la racine : un simple lien, pas un bloc repliable
            blocs.append(_liste(cat["entrees"], actif))
            continue
        corps = _liste(cat["entrees"], actif) if cat["entrees"] else ""
        for sous in cat["sous"]:
            corps += _bloc(sous["titre"], actif.startswith(cat["slug"] + "/" + sous["slug"] + "/"),
                           _liste(sous["entrees"], actif))
        blocs.append(_bloc(cat["titre"], actif.startswith(cat["slug"] + "/") or len(arbre) == 1, corps))
    return "".join(blocs)


def _page(titre: str, description: str, adresse: str, sommaire: str, corps: str, nb_articles: int, nb_sources: int) -> str:
    return page_statique("ressources.html", nb_articles, nb_sources, titre=titre, description=description,
                         adresse=adresse, sommaire=sommaire, corps=corps)


def _intro(racine: Path = RESSOURCES) -> tuple[dict[str, str], str]:
    """(bloc de tête, corps en HTML) de ressources/index.md. Sans fichier : ({}, "")."""
    fichier = racine / FICHIER_INTRO
    if not fichier.is_file():
        return {}, ""
    meta, corps = separer_front_matter(fichier.read_text(encoding="utf-8"))
    return meta, markdown.markdown(corps, extensions=EXTENSIONS_MARKDOWN)


def page_index(arbre: list[dict], nb_articles: int, nb_sources: int) -> str:
    meta, intro = _intro()
    if intro:  # la page d'index a la même mise en forme qu'un document : titre, description, texte
        corps = (f'<h1>{esc(meta.get("titre") or "Ressources")}</h1>'
                 + (f'<p class="ressources-description">{esc(meta["description"])}</p>' if meta.get("description") else "")
                 + f'<div class="ressources-texte">{intro}</div>')
    else:
        texte = ("Choisissez un document dans le sommaire." if arbre else "Aucune ressource pour le moment.")
        corps = f"<h1>Ressources</h1><p>{esc(texte)}</p>"
    return _page(f"Ressources — {NOM_SITE}", "Documents et ressources du " + NOM_SITE + ", classés par catégories.",
                 "/ressources/", sommaire_html(arbre), corps, nb_articles, nb_sources)


def page_document(arbre: list[dict], categorie: dict, sous: dict | None, entree: dict,
                  nb_articles: int, nb_sources: int) -> str:
    fil = "" if categorie.get("fichier") else categorie["titre"] + (" › " + sous["titre"] if sous else "")
    corps = ((f'<p class="ressources-fil">{esc(fil)}</p>' if fil else "") +
             f'<h1>{esc(entree["titre"])}</h1>'
             + (f'<p class="ressources-description">{esc(entree["description"])}</p>' if entree["description"] else "")
             + f'<div class="ressources-texte">{entree["html"]}</div>')
    return _page(f"{entree['titre']} — {NOM_SITE}", entree["description"] or entree["titre"], _lien(entree["chemin"]),
                 sommaire_html(arbre, entree["chemin"]), corps, nb_articles, nb_sources)


def ecrire_fichier(cible: Path, texte: str) -> None:
    """Écriture atomique (fichier temporaire puis renommage)."""
    cible.parent.mkdir(parents=True, exist_ok=True)
    tmp = cible.with_name(cible.name + ".tmp")
    tmp.write_text(texte, encoding="utf-8")
    tmp.replace(cible)


def ecrire_ressources(nb_articles: int, nb_sources: int) -> int:
    """Écrit build/ressources/ : l'index et une page par document (ressources/<cat>/[<sous>/]<doc>/index.html).
    Le dossier est reconstruit à chaque build, pour qu'un document supprimé ne reste pas en ligne.
    Renvoie le nombre de documents."""
    arbre = charger_arbre()
    dossier = BUILD / DOSSIER_WEB
    if dossier.exists():
        shutil.rmtree(dossier)
    ecrire_fichier(dossier / "index.html", page_index(arbre, nb_articles, nb_sources))
    nombre = 0
    for cat in arbre:
        for entree in cat["entrees"]:
            ecrire_fichier(BUILD / (DOSSIER_WEB + "/" + entree["chemin"]) / "index.html",
                           page_document(arbre, cat, None, entree, nb_articles, nb_sources))
            nombre += 1
        for sous in cat["sous"]:
            for entree in sous["entrees"]:
                ecrire_fichier(BUILD / (DOSSIER_WEB + "/" + entree["chemin"]) / "index.html",
                               page_document(arbre, cat, sous, entree, nb_articles, nb_sources))
                nombre += 1
    print(f"OK : {nombre} document(s) dans {len(arbre)} catégorie(s) → {dossier.relative_to(BUILD.parent)}/")
    return nombre
