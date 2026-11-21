"""Le JavaScript du site : tout est dans kioske/js/, un fichier par rôle. Aucun script n'est écrit en Python.

Ce module lit les fichiers au démarrage ; les modules de rendu insèrent leur contenu dans les pages,
entre <script> et </script>. Les valeurs calculées par Python (articles, code de conduite) ne sont pas
du JavaScript : elles sont écrites en JSON dans la page (json_pour_page) et lues par donnees_accueil.js.

Les scripts servis comme fichiers à part (/theme.js, /sw.js) restent dans static/.
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
JS_IMAGES_REPLI = lire("images_repli.js")          # images qui ne chargent pas : repli (data-repli), sans onerror
JS_GALERIE = lire("galerie.js")                    # flèches des galeries : brancherGalerie()
# Accueil : découpé en fichiers par rôle. L'ORDRE COMPTE : les fichiers sont concaténés dans une seule balise
# <script>, comme autrefois accueil.js ; un fichier peut utiliser ce que les précédents ont déclaré.
FICHIERS_ACCUEIL = [
    "accueil_historique.js", "accueil_clavier.js", "accueil_cartes.js",
    "accueil_panneaux.js", "accueil_recherche.js", "accueil_adresse.js", "accueil_favoris.js",
]
JS_ACCUEIL = "".join(lire(nom) for nom in FICHIERS_ACCUEIL)
JS_ACCUEIL_PERSONNALISATION = lire("accueil_personnalisation.js")  # épingles et masquages de l'accueil (Paramètres)
JS_FLUX_PERSONNALISE = lire("flux_personnalise.js") # flux personnalisé : sélection des sources
JS_NOTIFICATIONS = lire("notifications.js")        # cloche et notifications des flux personnalisés (off par défaut)
JS_RAFRAICHISSEMENT = lire("rafraichissement.js")  # rechargement automatique quand une nouvelle version est publiée
# Accueil et pages de catégorie
JS_CARTE_OUVERTE = lire("carte_ouverte.js")        # carte d'article affichée par-dessus la page
# Accueil, pages d'article et de catégorie
JS_RETOUR_APP = lire("retour_app.js")              # bouton précédent du téléphone dans l'app installée
JS_FAVORIS = lire("favoris.js")                    # ♡ des articles, favoris enregistrés dans le navigateur
JS_ETIQUETTES = lire("etiquettes.js")              # étiquettes des favoris : stockage, saisie, « + » des cartes d'article
JS_PARTAGE = lire("partage.js")                    # bouton 📤 des articles
JS_INSTALLATION_PWA = lire("installation_pwa.js")  # invite d'installation, bouton « Installer l'app »
# Pages statiques
JS_PAGE_ARTICLE = lire("page_article.js")
JS_PAGE_CATEGORIE = lire("page_categorie.js")
JS_PAGE_RSS = lire("page_rss.js")

# Bundle unique : tout le JavaScript des pages, dans un ordre fixe. Son nom porte une empreinte du contenu
# (cache longue durée sans risque). Écrit dans build/js/ par construction.py.
import hashlib as _hashlib
ORDRE_BUNDLE = [JS_DONNEES_ACCUEIL, JS_SERVICE_WORKER, JS_IMAGES_REPLI, JS_GALERIE, JS_FAVORIS, JS_ETIQUETTES, JS_PARTAGE,
                JS_ACCUEIL, JS_ACCUEIL_PERSONNALISATION, JS_FLUX_PERSONNALISE, JS_NOTIFICATIONS, JS_RAFRAICHISSEMENT, JS_CARTE_OUVERTE,
                JS_RETOUR_APP, JS_INSTALLATION_PWA, JS_PAGE_ARTICLE, JS_PAGE_CATEGORIE, JS_PAGE_RSS]
JS_BUNDLE = "\n".join(ORDRE_BUNDLE)
EMPREINTE_BUNDLE = _hashlib.sha256(JS_BUNDLE.encode("utf-8")).hexdigest()[:12]
NOM_BUNDLE = f"kioske.{EMPREINTE_BUNDLE}.js"
BALISE_BUNDLE = f'<script src="/js/{NOM_BUNDLE}" defer></script>'

