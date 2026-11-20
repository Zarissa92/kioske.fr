"""Lecture des fichiers de sources/ : flux RSS, chaînes Twitch, réglages locaux, catégories.

Une ligne « [Nom] » seule ouvre une catégorie ; les flux ou chaînes qui suivent y vont.
Sans catégorie : bloc « Des Liens ».
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

LINE_RE = re.compile(r'^\s*"([^"]+)"\s*(?::\s*\d+)?\s*(?:#.*)?$')  # ": ID" accepté, ignoré
CONFIG_RE = re.compile(r'^\s*(!)?\s*"([^"]+)"\s*(?:\|\s*(.+?))?\s*$')
TWITCH_LINE_RE = re.compile(r'^\s*"([^"]+)"\s*(?::\s*\d+)?\s*(?:#.*)?$')  # ": ID" accepté, ignoré
BRACKET_RE = re.compile(r'^\s*\[([^\[\]]+)\]\s*$')  # « [Nom] » seul sur sa ligne
CATEGORY_RE = BRACKET_RE  # backward compat
AUTRES = "Des Liens"  # titre du bloc des sources qui ne sont dans aucune catégorie


def retirer_commentaire(line: str) -> str:
    """Coupe la ligne au premier « # » hors guillemets. « # » seul sur la ligne = ligne vide."""
    dans_guillemets = False
    for i, car in enumerate(line):
        if car == '"':
            dans_guillemets = not dans_guillemets
        elif car == "#" and not dans_guillemets:
            return line[:i].strip()
    return line.strip()


def detect_format(path: Path) -> str:
    """Détecte ancien format [Cat] ou nouveau [Panneau:...] / [Cat:...]."""
    if not path.exists():
        return "ancien"
    for line in path.read_text(encoding="utf-8").splitlines():
        line = retirer_commentaire(line)
        if BRACKET_RE.match(line) and ":" in line:
            return "nouveau"
    return "ancien"


def read_panneaux_and_categories(feeds: Path, twitch: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Retourne (panneaux, catégories) pour le format nouveau [Panneau:...][Cat:...].
    panneaux: dict[source_key] = panneau_name
    categories: dict[source_key] = categorie_name
    """
    panneaux: dict[str, str] = {}
    categories: dict[str, str] = {}

    for path, est_twitch in ((feeds, False), (twitch, True)):
        if not path.exists():
            continue

        regex = TWITCH_LINE_RE if est_twitch else LINE_RE
        panneau_actuel = None
        categorie_actuelle = None

        for line in path.read_text(encoding="utf-8").splitlines():
            line = retirer_commentaire(line)
            if not line or line.startswith("#"):
                continue

            match = BRACKET_RE.match(line)
            if match:
                contenu = match.group(1)
                if ":" in contenu:
                    typ, nom = contenu.split(":", 1)
                    typ = typ.strip().lower()
                    nom = nom.strip()

                    if typ == "panneau":
                        panneau_actuel = nom
                        categorie_actuelle = None
                    else:
                        categorie_actuelle = nom
                continue

            m = regex.match(line)
            if not m:
                continue

            cle = f"twitch:{m.group(1).lower().strip()}" if est_twitch else m.group(1)

            if panneau_actuel:
                panneaux[cle] = panneau_actuel

            # Catégorie : explicite si définie, sinon utiliser le panneau, sinon AUTRES
            if categorie_actuelle:
                categories[cle] = categorie_actuelle
            elif panneau_actuel:
                categories[cle] = panneau_actuel
            else:
                categories.setdefault(cle, AUTRES)

    return panneaux, categories


def read_feeds(path: Path) -> list[str]:
    """URLs des flux, sans doublons, dans l'ordre du fichier."""
    urls = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = retirer_commentaire(line)
        if not line or line.startswith("#"):
            continue
        if CATEGORY_RE.match(line):  # ligne de catégorie : lue par read_categories
            continue
        m = LINE_RE.match(line)
        if not m:
            print(f"[feeds] ligne ignorée (format invalide) : {line}", file=sys.stderr)
            continue
        if m.group(1) not in urls:
            urls.append(m.group(1))
    return urls


def read_local(path: Path) -> tuple[set[str], dict[str, str]]:
    """Réglages locaux : flux ignorés (!"URL") et noms d'affichage ("URL" | Nom)."""
    ignored, names = set(), {}
    if not path.exists():
        return ignored, names
    for line in path.read_text(encoding="utf-8").splitlines():
        line = retirer_commentaire(line)
        if not line or line.startswith("#"):
            continue
        m = CONFIG_RE.match(line)
        if not m:
            print(f"[flux_corrige_main] ligne ignorée (format invalide) : {line}", file=sys.stderr)
            continue
        bang, url, name = m.groups()
        if bang:
            ignored.add(url)
        elif name:
            names[url] = name
    return ignored, names


def read_twitch(path: Path) -> list[str]:
    """Noms des chaînes Twitch, en minuscules, sans doublons."""
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = retirer_commentaire(line)
        if not line or line.startswith("#"):
            continue
        if CATEGORY_RE.match(line):  # ligne de catégorie : lue par read_categories
            continue
        m = TWITCH_LINE_RE.match(line)
        if not m:
            print(f"[twitch] ligne ignorée (format invalide) : {line}", file=sys.stderr)
            continue
        name = m.group(1).lower().strip()
        if name not in names:
            names.append(name)
    return names


def read_categories(feeds: Path, twitch: Path) -> dict[str, str]:
    """Catégorie de chaque source. Supporte ancien format [Cat] et nouveau [Panneau:...][Cat:...]."""
    # Déterminer le format
    fmt = detect_format(feeds) if feeds.exists() else detect_format(twitch)

    if fmt == "nouveau":
        _, categories = read_panneaux_and_categories(feeds, twitch)
        return categories

    # Ancien format
    categories: dict[str, str] = {}
    for path, est_twitch in ((feeds, False), (twitch, True)):
        if not path.exists():
            continue
        regex = TWITCH_LINE_RE if est_twitch else LINE_RE
        courante = None
        for line in path.read_text(encoding="utf-8").splitlines():
            line = retirer_commentaire(line)
            if not line or line.startswith("#"):
                continue
            titre = BRACKET_RE.match(line)
            if titre:
                contenu = titre.group(1)
                if ":" not in contenu:  # ignorer les nouvelles lignes avec :
                    courante = contenu.strip()
                continue
            m = regex.match(line)
            if not m or courante is None:
                continue
            cle = f"twitch:{m.group(1).lower().strip()}" if est_twitch else m.group(1)
            categories.setdefault(cle, courante)
    return categories


def read_panneaux(feeds: Path, twitch: Path) -> dict[str, str]:
    """Panneau de chaque source (nouveau format seulement). Ancien format retourne vide."""
    fmt = detect_format(feeds) if feeds.exists() else detect_format(twitch)
    if fmt == "nouveau":
        panneaux, _ = read_panneaux_and_categories(feeds, twitch)
        return panneaux
    return {}


def ordre_des_categories(items: list[dict], categories: dict[str, str]) -> list[str]:
    """Catégories présentes dans les articles : ordre du fichier de flux, « Des Liens » en dernier."""
    presentes = {categories.get(i["key"], AUTRES) for i in items}
    ordre = [c for c in dict.fromkeys(categories.values()) if c in presentes]
    if AUTRES in presentes:
        ordre.append(AUTRES)
    return ordre


def ordres_du_fichier(feeds: Path, twitch: Path) -> tuple[list[str], list[str]]:
    """Ordre des panneaux et des catégories tel qu'il est écrit dans les fichiers de sources (les en-têtes).
    Lu dans les en-têtes et non dans les sources : une source listée dans deux catégories ne change pas l'ordre.
    - Ancien format [Cat] : chaque en-tête est une catégorie.
    - Nouveau format : une source placée sous [Panneau:X] sans [Cat:...] range la catégorie implicite X
      (même règle que read_panneaux_and_categories), à sa place dans le fichier."""
    panneaux: list[str] = []
    categories: list[str] = []

    def ajouter(liste: list[str], nom: str) -> None:
        if nom and nom not in liste:
            liste.append(nom)

    for path in (feeds, twitch):
        if not path.exists():
            continue
        ancien = detect_format(path) == "ancien"
        panneau_actuel = categorie_actuelle = None
        for line in path.read_text(encoding="utf-8").splitlines():
            line = retirer_commentaire(line)
            if not line:
                continue
            match = BRACKET_RE.match(line)
            if not match:
                # Ligne de source : catégorie implicite (le panneau) si aucune catégorie n'est ouverte
                if not ancien and panneau_actuel and not categorie_actuelle:
                    ajouter(categories, panneau_actuel)
                continue
            contenu = match.group(1)
            if ancien:
                ajouter(categories, contenu.strip())
            elif ":" in contenu:
                typ, nom = contenu.split(":", 1)
                nom = nom.strip()
                if typ.strip().lower() == "panneau":
                    panneau_actuel, categorie_actuelle = nom, None
                    ajouter(panneaux, nom)
                else:
                    categorie_actuelle = nom
                    ajouter(categories, nom)
    return panneaux, categories
