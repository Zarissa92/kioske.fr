"""Images des articles : chargées depuis le site d'origine (plus de copie locale).

Le téléchargement en mémoire (telecharger_en_memoire) ne sert qu'à composer les cartes de partage, qui sont
stockées dans build/img/previews. Les types et la taille restent contrôlés."""
from __future__ import annotations

import concurrent.futures as cf
import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .config import BUILD, CACHE_DIR, DELAI_ECHEC, DOSSIER_IMAGES
from .reseau import UA

ECHECS_IMAGES = CACHE_DIR / "images_echecs.json"  # URL en échec -> date ; réessayée après DELAI_ECHEC

IMAGE_MAX = 5 * 1024 * 1024  # au-delà, l'image est ignorée
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
               "image/gif": ".gif", "image/avif": ".avif"}  # SVG exclu : il peut contenir du script


def chemin_image(url: str) -> str:
    """Nom de base de l'image d'une URL : un hash stable de l'adresse (sans l'extension)."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:20]


def image_locale(url: str | None, telecharger: bool = True) -> str:
    """Chemin relatif à la racine (ex. img/veille/abc.jpg) de l'image d'une URL, déjà présente
    ou téléchargée maintenant. Chaîne vide si elle n'est pas disponible."""
    if not url:
        return ""
    for ext in IMAGE_TYPES.values():
        if (BUILD / DOSSIER_IMAGES / (chemin_image(url) + ext)).exists():
            return f"{DOSSIER_IMAGES}/{chemin_image(url)}{ext}"
    return telecharger_image(url) if telecharger else ""


def telecharger_image(url: str) -> str:
    """Télécharge une image (type et taille vérifiés). Chaîne vide en cas d'échec."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as resp:
        ext = IMAGE_TYPES.get(resp.headers.get_content_type())
        if not ext:
            raise ValueError("type d'image non accepté")
        data = resp.read(IMAGE_MAX + 1)
    if len(data) > IMAGE_MAX:
        raise ValueError("image trop grosse")
    dest = BUILD / DOSSIER_IMAGES / (chemin_image(url) + ext)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, dest)
    return f"{DOSSIER_IMAGES}/{dest.name}"


def telecharger_en_memoire(url: str) -> bytes:
    """Contenu d'une image, en mémoire (jamais écrit dans build/). Lève une erreur si le type ou la taille est refusé."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.headers.get_content_type() not in IMAGE_TYPES:
            raise ValueError("type d'image non accepté")
        data = resp.read(IMAGE_MAX + 1)
    if len(data) > IMAGE_MAX:
        raise ValueError("image trop grosse")
    return data


def telecharger_images(urls: list[str | None], telecharger: bool = True) -> dict[str, str]:
    """Adresse affichée de chaque image : l'adresse d'origine, telle quelle. Plus de copie dans build/.

    Seules les adresses https sont gardées (une image http est bloquée par le navigateur sur un site https).
    Le paramètre « telecharger » n'a plus d'effet : aucun téléchargement pour l'affichage."""
    return {u: u for u in dict.fromkeys(urls) if u and u.startswith("https://")}


def appliquer_images(items: list[dict], previews: dict[str, dict], correspondance: dict[str, str]) -> None:
    """Remplace les URL distantes par les chemins locaux (les caches gardent les URL d'origine)."""
    for item in items:
        item["image"] = correspondance.get(item.get("image") or "", "")
    for preview in previews.values():
        preview["image"] = correspondance.get(preview.get("image") or "", "")


def purger_images(utilisees: set[str]) -> int:
    """Supprime de build/img/veille les images qu'aucun article affiché n'utilise plus.
    `utilisees` : chemins relatifs (img/veille/abc.jpg). Renvoie le nombre de fichiers supprimés."""
    gardees = {Path(c).name for c in utilisees if c}
    supprimees = 0
    for fichier in (BUILD / DOSSIER_IMAGES).glob("*"):
        if fichier.is_file() and fichier.name not in gardees:
            fichier.unlink()
            supprimees += 1
    return supprimees
