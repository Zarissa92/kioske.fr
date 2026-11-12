"""Garde du bloc immuable de la page d'accueil.

Le bloc entre <!-- IMMUABLE:DEBUT --> et <!-- IMMUABLE:FIN --> (lien Discord, code de
conduite) est écrit une fois pour toutes dans accueil/bloc_immuable.html. Le build l'insère tel
quel dans la page : il ne le modifie jamais.

Deux contrôles :
- verifier_zone() : la source correspond à l'empreinte enregistrée (data/immuable.json) ;
- verifier_page() : la page générée contient le bloc à l'identique, caractère pour caractère.
"""
from __future__ import annotations

import hashlib
import json
import re

from .config import BLOC_IMMUABLE as SOURCE
from .config import EMPREINTE

DEBUT = "<!-- IMMUABLE:DEBUT"
FIN = "<!-- IMMUABLE:FIN -->"
# Éléments qui doivent être présents dans la zone
ATTENDUS = ["discord.gg", 'id="code-conduite"']


def zone(texte: str) -> str:
    if texte.count(DEBUT) != 1 or texte.count(FIN) != 1:
        raise SystemExit("Marqueurs IMMUABLE absents ou en double")
    i = texte.index(DEBUT)
    j = texte.index(FIN) + len(FIN)
    bloc = texte[i:j]
    manquants = [a for a in ATTENDUS if a not in bloc]
    if manquants:
        raise SystemExit(f"Éléments immuables manquants : {manquants}")
    return bloc


def empreinte(texte: str) -> str:
    return hashlib.sha256(zone(texte).encode("utf-8")).hexdigest()


def enregistrer() -> None:
    EMPREINTE.parent.mkdir(parents=True, exist_ok=True)
    EMPREINTE.write_text(json.dumps({"sha256": empreinte(SOURCE.read_text(encoding="utf-8"))}, indent=1), encoding="utf-8")
    print("empreinte enregistrée")


def verifier_zone(texte: str) -> None:
    """Lève SystemExit si le bloc immuable ne correspond pas à l'empreinte enregistrée."""
    if not EMPREINTE.exists():
        raise SystemExit("Pas d'empreinte : lance d'abord `bin/garde_immuable.py enregistrer`")
    attendu = json.loads(EMPREINTE.read_text(encoding="utf-8"))["sha256"]
    if empreinte(texte) != attendu:
        raise SystemExit("Le bloc immuable a été modifié : écriture refusée")


def parties() -> tuple[str, str]:
    """Le bloc immuable, vérifié, en deux morceaux insérés tels quels dans la page : (haut, bas).
    Le bas (lien Discord et code de conduite, entre BAS:DEBUT et BAS:FIN) s'affiche en bas du panneau."""
    texte = SOURCE.read_text(encoding="utf-8")
    verifier_zone(texte)
    bas = re.search(r"<!-- BAS:DEBUT -->(.*?)<!-- BAS:FIN -->", texte, re.S)
    if not bas:
        raise SystemExit(f"marqueurs BAS absents dans {SOURCE.name}")
    haut = texte[:bas.start()] + texte[bas.end():]
    return haut.strip(), bas.group(1).strip()


def verifier_page(page: str) -> None:
    """Contrôle la page générée : les deux morceaux du bloc immuable y sont, à l'identique."""
    haut, bas = parties()
    for nom, morceau in (("haut", haut), ("bas", bas)):
        if page.count(morceau) != 1:
            raise SystemExit(f"Bloc immuable ({nom}) absent ou altéré dans la page générée : écriture refusée")


def main(argv: list[str]) -> None:
    action = argv[0] if argv else "verifier"
    if action == "enregistrer":
        enregistrer()
    elif action == "verifier":
        verifier_zone(SOURCE.read_text(encoding="utf-8"))
        print("OK : bloc immuable inchangé")
    else:
        raise SystemExit("Usage : garde_immuable.py enregistrer|verifier")
