"""Le JavaScript du site : tout est dans kioske/js/, un fichier par rôle. Aucun script n'est écrit en Python.

Ce module lit les fichiers au démarrage ; les modules de rendu insèrent leur contenu dans les pages,
entre <script> et </script>. Les valeurs calculées par Python (articles, code de conduite) ne sont pas
du JavaScript : elles sont écrites en JSON dans la page (json_pour_page) et lues par donnees_accueil.js.

Les scripts servis comme fichiers à part (/app.js, /theme.js, /sw.js) restent dans static/.
"""
from __future__ import annotations

import json

from .config import PAQUET

DOSSIER_JS = PAQUET / "js"


def lire(nom: str) -> str:
    """Contenu d'un fichier de kioske/js/, terminé par un saut de ligne."""
    texte = (DOSSIER_JS / nom).read_text(encoding="utf-8")
    if "</script" in texte.lower():
        raise ValueError(f"{nom} : « </script » fermerait la balise de la page")
    return texte if texte.endswith("\n") else texte + "\n"


def json_pour_page(donnees) -> str:
    """JSON à placer dans <script type="application/json"> : rien dedans ne peut fermer la balise."""
    return json.dumps(donnees, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\u0021--")


# Toutes les pages
JS_SERVICE_WORKER = lire("service_worker.js")      # enregistrement de /sw.js
# Accueil
JS_DONNEES_ACCUEIL = lire("donnees_accueil.js")    # lit le JSON « kioske-donnees » de la page
JS_GALERIE = lire("galerie.js")                    # flèches des galeries : brancherGalerie()
JS_ACCUEIL = lire("accueil.js")                    # panneaux, recherche, favoris, menu
JS_INSTALLATION_PWA = lire("installation_pwa.js")  # bouton « Installer l'app »
# Accueil et pages de catégorie
JS_CARTE_OUVERTE = lire("carte_ouverte.js")        # carte d'article affichée par-dessus la page
# Accueil, pages d'article et de catégorie
JS_RETOUR_APP = lire("retour_app.js")              # bouton précédent du téléphone dans l'app installée
# Pages statiques
JS_PAGE_ARTICLE = lire("page_article.js")
JS_PAGE_CATEGORIE = lire("page_categorie.js")
JS_PAGE_RSS = lire("page_rss.js")
