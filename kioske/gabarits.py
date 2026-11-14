"""Squelettes des pages : un fichier HTML par type de page, dans kioske/gabarits/.

Un gabarit est du HTML ordinaire où ${nom} marque l'endroit d'une valeur (string.Template, bibliothèque
standard). Il ne contient ni boucle ni condition : les morceaux répétés ou conditionnels (cartes,
étiquettes, galeries, boutons) restent fabriqués en Python et arrivent déjà prêts.

Les valeurs sont insérées telles quelles : c'est le code Python qui échappe le texte (esc()) avant de
le passer. Pour écrire un vrai signe dollar dans un gabarit : $$.
"""
from __future__ import annotations

from string import Template

from .config import PAQUET

DOSSIER_GABARITS = PAQUET / "gabarits"
_GABARITS: dict[str, Template] = {}


def remplir(nom: str, **valeurs) -> str:
    """Le gabarit kioske/gabarits/<nom>, ses ${...} remplacés. Une valeur manquante arrête le build."""
    if nom not in _GABARITS:
        texte = (DOSSIER_GABARITS / nom).read_text(encoding="utf-8")
        _GABARITS[nom] = Template(texte.rstrip("\n") + "\n")
    try:
        return _GABARITS[nom].substitute({cle: str(valeur) for cle, valeur in valeurs.items()})
    except KeyError as manquante:
        raise KeyError(f"gabarit {nom} : aucune valeur pour ${{{manquante.args[0]}}}") from None
