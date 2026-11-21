"""Génération des previews au format 'carte Pokémon' pour les réseaux sociaux."""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .config import BUILD, CACHE_DIR, DELAI_ECHEC, DOSSIER_IMAGES, STATIC
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

# Police : Inter, celle du site (static/fonts/inter.woff2), fournie par le dépôt. Les cartes ne dépendent plus
# des polices installées sur la machine : sur le serveur, DejaVu manquait et Pillow écrivait en police minuscule.
# Inter est variable (graisse 100 à 900) : un seul fichier pour le titre en gras et la ligne de date.
# Couverture : français et Europe de l'Ouest ; les lettres d'Europe centrale (ł, č, ő…) sortent en carré vide.
POLICE_SITE = STATIC / "fonts" / "inter.woff2"


def _police(taille: int, graisse: int = 400) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Inter à la taille et à la graisse demandées. Fichier illisible : la police de Pillow à la même taille,
    avec un avertissement dans le journal de build (plus de repli silencieux)."""
    try:
        police = ImageFont.truetype(str(POLICE_SITE), taille)
    except OSError as e:
        print(f"[preview] police {POLICE_SITE} illisible ({e}) : police de Pillow à la place", flush=True)
        return ImageFont.load_default(taille)
    try:
        axes = police.get_variation_axes()
        police.set_variation_by_axes([graisse if a["name"] in (b"Weight", "Weight") else a["default"] for a in axes])
    except (OSError, AttributeError):
        pass  # police non variable : graisse par défaut
    return police


FONT_TITLE = _police(60, 700)
FONT_META = _police(40)
FONT_LETTRE = _police(360, 800)   # lettre de repli, au centre de la zone d'image

# Version des cartes : elle entre dans le nom du fichier (<empreinte>-v3.png). L'augmenter fait refaire toutes
# les cartes, par lots (REFAITES_PAR_BUILD par build, les plus récentes d'abord) ; une carte pas encore refaite
# garde son ancien fichier. v2 (2026-11-19) : police du site, lettre de repli tirée de la source.
# Refaire une carte télécharge l'image de l'article (jusqu'à 15 s si le site est lent) : nombre ET durée bornés,
# pour rester loin de la limite du timer (TimeoutStartSec=900). Rien n'est refait en build --simple (sans réseau).
# v3 (2026-11-19) : image de l'aperçu de la page quand le flux n'en donne pas.
# v4 (2026-11-20) : JPEG au lieu de PNG. Le PNG gardait la photo presque sans compression (1 à 2 Mo par carte,
# téléchargés par chaque robot qui lit og:image) ; en JPEG, 200 à 300 Ko pour la même carte.
VERSION_PREVIEW = 4
EXTENSION_PREVIEW = ".jpg"
QUALITE_JPEG = 82
EXTENSIONS_ANCIENNES = (".png", ".jpg")   # cartes des versions précédentes, retirées une fois refaites
REFAITES_PAR_BUILD = 150
REFAITES_DUREE_MAX = 180   # secondes par build


def chemin_preview(link: str) -> str:
    """Nom de base du preview d'une URL : un hash stable de l'adresse (sans l'extension ni la version)."""
    return hashlib.sha256(link.encode("utf-8")).hexdigest()[:20]


def nom_preview(link: str) -> str:
    """Nom du fichier de la carte, version comprise (img/previews/<nom>)."""
    return f"{chemin_preview(link)}-v{VERSION_PREVIEW}{EXTENSION_PREVIEW}"


def lettre_repli(meta: str, titre: str) -> str:
    """Lettre affichée sans image : la première lettre ou chiffre du nom de la source (après « · »), sinon du titre."""
    for texte in (meta.split("·", 1)[-1] if "·" in meta else "", titre):
        for c in texte:
            if c.isalnum():
                return c.upper()
    return "•"


def generer_preview(image_path: str | None, titre: str, meta: str, link: str) -> bytes:
    """Génère une image JPEG au format 'carte Pokémon'.

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
            # Fallback vers la lettre ; la raison part dans le journal de build (image absente du preview sinon)
            print(f"[preview] image non utilisée pour {link} ({image_path}) : {e}", flush=True)
    elif image_path:
        print(f"[preview] image non utilisée pour {link} ({image_path}) : fichier introuvable", flush=True)

    # Si l'image n'a pas pu être chargée, dessiner une lettre
    if not image_loaded:
        draw.rectangle(image_box, fill=COLOR_RED_DIM)
        draw.text(
            (PREVIEW_WIDTH // 2, image_height // 2),
            lettre_repli(meta, titre),
            fill=COLOR_WHITE,
            font=FONT_LETTRE,
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

    # JPEG progressif : six à sept fois plus léger que le PNG pour une carte avec photo
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=QUALITE_JPEG, optimize=True, progressive=True)
    return buffer.getvalue()


def _anciennes_cartes(link: str) -> list[Path]:
    """Cartes d'une version précédente pour ce lien (<empreinte>.png, <empreinte>-v1.png, -v3.png…), la plus
    récente d'abord : c'est elle qui est servie tant que la carte n'est pas refaite."""
    dossier = BUILD / DOSSIER_PREVIEWS
    base = chemin_preview(link)
    candidates = []
    for ext in EXTENSIONS_ANCIENNES:
        candidates += [dossier / f"{base}{ext}", *dossier.glob(f"{base}-v*{ext}")]
    anciennes = {f for f in candidates if f.exists() and f.name != nom_preview(link)}
    return sorted(anciennes, key=lambda f: f.stat().st_mtime, reverse=True)


def preview_local(link: str, image_path: str | None, titre: str, meta: str, telecharger: bool = True) -> str:
    """Chemin relatif à la racine de la carte d'un lien (ex. img/previews/<empreinte>-v2.png). La génère si elle
    n'existe pas dans la version actuelle ; une fois générée, les cartes des versions précédentes sont retirées
    de build/. Chaîne vide en cas d'erreur, ou si telecharger est faux et qu'aucune carte n'existe."""
    nom = nom_preview(link)
    preview_path = BUILD / DOSSIER_PREVIEWS / nom
    if preview_path.exists():
        return f"{DOSSIER_PREVIEWS}/{nom}"

    if not telecharger:
        anciennes = _anciennes_cartes(link)
        return f"{DOSSIER_PREVIEWS}/{anciennes[0].name}" if anciennes else ""

    try:
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        data = generer_preview(image_path, titre, meta, link)
        tmp = preview_path.with_name(preview_path.name + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(preview_path)
        for ancienne in _anciennes_cartes(link):
            ancienne.unlink(missing_ok=True)
        return f"{DOSSIER_PREVIEWS}/{nom}"
    except Exception as exc:
        print(f"[preview] erreur lors de la génération du preview pour {link} : {exc}", flush=True)
        # Marquer l'erreur dans le cache
        echecs = json.loads(ECHECS_PREVIEWS.read_text(encoding="utf-8")) if ECHECS_PREVIEWS.exists() else {}
        echecs[link] = datetime.now(timezone.utc).timestamp()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        ECHECS_PREVIEWS.write_text(json.dumps(echecs, indent=1), encoding="utf-8")
        anciennes = _anciennes_cartes(link)
        return f"{DOSSIER_PREVIEWS}/{anciennes[0].name}" if anciennes else ""


def generer_previews(articles: list[dict], images: dict[str, str], telecharger: bool = True,
                     refaites_max: int = REFAITES_PAR_BUILD, duree_max: float = REFAITES_DUREE_MAX) -> dict[str, str]:
    """Génère les cartes d'une liste d'articles (les plus récents d'abord).

    articles : liste des articles avec 'link', 'title', 'source', 'date'
    images : dict qui mappe link -> chemin_local_image
    telecharger : si True, génère les cartes manquantes ; si False, retourne seulement les existantes
    refaites_max : au plus ce nombre de cartes d'une version précédente refaites dans ce build (les autres
                   gardent leur ancien fichier jusqu'aux builds suivants). Les cartes neuves ne sont pas limitées.
                   0 en build --simple.
    duree_max : au-delà de ce nombre de secondes passées à refaire des cartes, on s'arrête pour ce build.

    Retourne un dict qui mappe link -> chemin_relatif_preview
    """
    previews = {}
    echecs = json.loads(ECHECS_PREVIEWS.read_text(encoding="utf-8")) if ECHECS_PREVIEWS.exists() else {}
    maintenant = datetime.now(timezone.utc).timestamp()
    refaites = 0
    debut = time.monotonic()
    plus_ancienne = datetime.min.replace(tzinfo=timezone.utc)

    def date_tri(article):
        d = article.get("date")
        return d if isinstance(d, datetime) and d.tzinfo else plus_ancienne

    for article in sorted(articles, key=date_tri, reverse=True):
        link = article["link"]

        # Vérifier le cache des erreurs
        if link in echecs and maintenant - echecs[link] < DELAI_ECHEC:
            anciennes = _anciennes_cartes(link)
            if anciennes:
                previews[link] = f"{DOSSIER_PREVIEWS}/{anciennes[0].name}"
            continue

        # Carte d'une version précédente : refaite seulement dans la limite du build
        a_refaire = telecharger and not (BUILD / DOSSIER_PREVIEWS / nom_preview(link)).exists() and bool(_anciennes_cartes(link))
        generer = telecharger and (not a_refaire or (refaites < refaites_max and time.monotonic() - debut < duree_max))
        if a_refaire and generer:
            refaites += 1

        image_path = images.get(link)
        # Corriger le chemin de l'image (BUILD/ / dossier)
        if image_path and not image_path.startswith("https://"):
            image_path = str(BUILD / image_path)

        date_str = ""
        if article.get('date'):
            date_str = article['date'].strftime('%d/%m/%Y') if hasattr(article['date'], 'strftime') else str(article['date'])
        meta = f"{date_str} · {article.get('source', '')}"[:60]
        titre = article.get('title', '')

        preview = preview_local(link, image_path, titre, meta, generer)
        if preview:
            previews[link] = preview

    if refaites:
        print(f"[previews] {refaites} carte(s) refaite(s) en version {VERSION_PREVIEW}", flush=True)
    return previews
