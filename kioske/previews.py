"""Génération des previews au format 'carte Pokémon' pour les réseaux sociaux."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .config import BUILD, CACHE_DIR, DELAI_ECHEC, DOSSIER_IMAGES
from .images import telecharger_en_memoire

ECHECS_PREVIEWS = CACHE_DIR / "previews_echecs.json"
DOSSIER_PREVIEWS = "img/previews"

# Format "carte Pokémon" : 1200x1600 (aspect ratio 3/4)
PREVIEW_WIDTH = 1200
PREVIEW_HEIGHT = 1600
PREVIEW_IMAGE_RATIO = 0.55  # Image occupe 55% de la hauteur

# Couleurs
COLOR_BG = (8, 0, 0)  # Noir
COLOR_RED = (255, 26, 26)  # Rouge du thème
COLOR_RED_DIM = (153, 26, 26)  # Rouge dim
COLOR_RED_LIGHT = (255, 153, 153)  # Rouge clair
COLOR_WHITE = (255, 255, 255)

# Polices (utiliser des polices du système si disponibles)
try:
    FONT_TITLE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
    FONT_META = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
except OSError:
    # Fallback sur les polices par défaut
    FONT_TITLE = ImageFont.load_default()
    FONT_META = ImageFont.load_default()


def chemin_preview(link: str) -> str:
    """Nom de base du preview d'une URL : un hash stable de l'adresse (sans l'extension)."""
    return hashlib.sha256(link.encode("utf-8")).hexdigest()[:20]


def generer_preview(image_path: str | None, titre: str, meta: str, link: str) -> bytes:
    """Génère une image PNG au format 'carte Pokémon'.

    Retourne les bytes de l'image.
    """
    # Créer l'image de fond
    img = Image.new("RGB", (PREVIEW_WIDTH, PREVIEW_HEIGHT), COLOR_BG)
    draw = ImageDraw.Draw(img)

    # Zone d'image (55% du haut)
    image_height = int(PREVIEW_HEIGHT * PREVIEW_IMAGE_RATIO)
    image_box = (0, 0, PREVIEW_WIDTH, image_height)

    # Zone de contenu (45% du bas)
    content_height = PREVIEW_HEIGHT - image_height
    content_box = (0, image_height, PREVIEW_WIDTH, PREVIEW_HEIGHT)

    # Dessiner la bordure entre image et contenu
    draw.line([(0, image_height), (PREVIEW_WIDTH, image_height)], fill=COLOR_RED_DIM, width=2)

    # Charger et redimensionner l'image de l'article
    image_loaded = False
    if image_path and (image_path.startswith("https://") or Path(image_path).exists()):
        try:
            source = BytesIO(telecharger_en_memoire(image_path)) if image_path.startswith("https://") else image_path
            article_img = Image.open(source).convert("RGB")
            # Redimensionner l'image pour remplir la zone complètement (crop si nécessaire)
            img_ratio = article_img.width / article_img.height
            zone_ratio = PREVIEW_WIDTH / image_height

            if img_ratio > zone_ratio:
                # Image trop large : crop les côtés
                new_height = article_img.height
                new_width = int(new_height * zone_ratio)
                left = (article_img.width - new_width) // 2
                article_img = article_img.crop((left, 0, left + new_width, new_height))
            else:
                # Image trop haute : crop le haut/bas
                new_width = article_img.width
                new_height = int(new_width / zone_ratio)
                top = (article_img.height - new_height) // 2
                article_img = article_img.crop((0, top, new_width, top + new_height))

            # Redimensionner au format final
            article_img = article_img.resize((PREVIEW_WIDTH, image_height), Image.Resampling.LANCZOS)
            img.paste(article_img, (0, 0))
            image_loaded = True
        except Exception as e:
            pass  # Fallback vers la lettre si erreur

    # Si l'image n'a pas pu être chargée, dessiner une lettre
    if not image_loaded:
        draw.rectangle(image_box, fill=COLOR_RED_DIM)
        lettre = link[0].upper() if link else "•"
        draw.text(
            (PREVIEW_WIDTH // 2, image_height // 2),
            lettre,
            fill=COLOR_WHITE,
            font=FONT_TITLE,
            anchor="mm"
        )

    # Ajouter le contenu (titre + meta)
    margin = 40
    y_offset = image_height + margin

    # Meta (date · source)
    draw.text(
        (margin, y_offset),
        meta[:60],
        fill=COLOR_RED_LIGHT,
        font=FONT_META
    )

    y_offset += 70

    # Titre (avec wrapping)
    lines = titre.split(" ")
    current_line = ""
    max_width = PREVIEW_WIDTH - 2 * margin

    for word in lines:
        test_line = current_line + (" " if current_line else "") + word
        bbox = draw.textbbox((0, 0), test_line, font=FONT_TITLE)
        if bbox[2] - bbox[0] > max_width and current_line:
            draw.text((margin, y_offset), current_line, fill=COLOR_WHITE, font=FONT_TITLE)
            y_offset += 80
            current_line = word
        else:
            current_line = test_line

    if current_line:
        draw.text((margin, y_offset), current_line, fill=COLOR_WHITE, font=FONT_TITLE)

    # Convertir en PNG
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def preview_local(link: str, image_path: str | None, titre: str, meta: str, telecharger: bool = True) -> str:
    """Chemin relatif à la racine du preview d'un lien. Génère le preview s'il n'existe pas.

    Retourne un chemin relatif (ex. img/previews/abc.png) ou une chaîne vide en cas d'erreur.
    """
    nom_base = chemin_preview(link)
    preview_path = BUILD / DOSSIER_PREVIEWS / f"{nom_base}.png"

    # Si le preview existe, retourner son chemin
    if preview_path.exists():
        return f"{DOSSIER_PREVIEWS}/{nom_base}.png"

    if not telecharger:
        return ""

    try:
        # Générer le preview
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        data = generer_preview(image_path, titre, meta, link)

        # Sauvegarder le preview
        tmp = preview_path.with_name(preview_path.name + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(preview_path)

        return f"{DOSSIER_PREVIEWS}/{nom_base}.png"
    except Exception as exc:
        print(f"[preview] erreur lors de la génération du preview pour {link} : {exc}", flush=True)
        # Marquer l'erreur dans le cache
        echecs = json.loads(ECHECS_PREVIEWS.read_text(encoding="utf-8")) if ECHECS_PREVIEWS.exists() else {}
        echecs[link] = datetime.now(timezone.utc).timestamp()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        ECHECS_PREVIEWS.write_text(json.dumps(echecs, indent=1), encoding="utf-8")
        return ""


def generer_previews(articles: list[dict], images: dict[str, str], telecharger: bool = True) -> dict[str, str]:
    """Génère les previews pour une liste d'articles.

    articles : liste des articles avec 'link', 'title', 'source', 'date'
    images : dict qui mappe link -> chemin_local_image
    telecharger : si True, génère les previews ; si False, retourne seulement les existants

    Retourne un dict qui mappe link -> chemin_relatif_preview
    """
    previews = {}
    echecs = json.loads(ECHECS_PREVIEWS.read_text(encoding="utf-8")) if ECHECS_PREVIEWS.exists() else {}
    maintenant = datetime.now(timezone.utc).timestamp()

    for article in articles:
        link = article["link"]

        # Vérifier le cache des erreurs
        if link in echecs and maintenant - echecs[link] < DELAI_ECHEC:
            continue

        # Générer le preview
        image_path = images.get(link)
        # Corriger le chemin de l'image (BUILD/ / dossier)
        if image_path and not image_path.startswith("https://"):
            image_path = str(BUILD / image_path)

        date_str = ""
        if article.get('date'):
            date_str = article['date'].strftime('%d/%m/%Y') if hasattr(article['date'], 'strftime') else str(article['date'])
        meta = f"{date_str} · {article.get('source', '')}"[:60]
        titre = article.get('title', '')

        preview = preview_local(link, image_path, titre, meta, telecharger)
        if preview:
            previews[link] = preview

    return previews
