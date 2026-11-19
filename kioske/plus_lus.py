"""Les plus lus : les articles les plus consultés ces derniers jours, d'après le journal d'accès de nginx.

Aucun pistage n'est ajouté au site : le serveur tient déjà ce journal (sécurité, robots). Le build le relit
à chaque passage (toutes les 30 min avec le timer) et en tire un classement :

- requêtes « GET /articles/<id>-<titre>/ » servies (code 200), sur les `jours` derniers jours ;
- une adresse IP compte une fois par article (un visiteur qui revient ne fait pas monter l'article) ;
- robots qui se déclarent (GPTBot, Googlebot…) et adresses de `ip_jamais_bannies` (kioske.cfg : le serveur,
  le réseau local) retirés ;
- seuls les articles encore affichés par le site sont gardés (l'identifiant de l'adresse est comparé à
  ceux des articles du build).

Sans journal lisible (poste de développement, droits manquants), la liste est vide et la galerie n'est pas
écrite. Sur le serveur, le compte du timer lit le journal grâce au groupe « adm » (deploy/systemd/).
Le journal du jour et ses archives tournées (.1, .2.gz…) sont lus ; seules les lignes de la période comptent.
"""
from __future__ import annotations

import gzip
import ipaddress
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Une ligne du format « combined » de nginx :
# 1.2.3.4 - - [19/Nov/2026:10:00:00 +0100] "GET /articles/abc-titre/ HTTP/2.0" 200 1234 "referer" "agent"
LIGNE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "GET (\S+) [^"]*" (\d{3}) \S+ "[^"]*" "([^"]*)"')
ADRESSE_ARTICLE = re.compile(r"^/articles/([0-9a-f]{12})-[a-z0-9-]*/(?:index\.html)?(?:\?.*)?$")
ROBOTS = re.compile(r"bot|crawl|spider|slurp|preview|fetch|python|curl|wget|httpx|scrapy", re.I)
# Date de nginx (« 19/Nov/2026:10:00:00 +0100 »), mois toujours en anglais. Lue sans strptime : « %b » dépend
# de la langue du système, et un serveur en français ne reconnaîtrait aucun mois.
DATE = re.compile(r"^(\d{2})/([A-Z][a-z]{2})/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$")
MOIS = {m: i for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}


def lire_date(texte: str) -> datetime | None:
    """Date d'une ligne de nginx, ou None si elle est illisible."""
    m = DATE.match(texte)
    if not m or m.group(2) not in MOIS:
        return None
    decalage = timedelta(hours=int(m.group(8)), minutes=int(m.group(9))) * (1 if m.group(7) == "+" else -1)
    try:
        return datetime(int(m.group(3)), MOIS[m.group(2)], int(m.group(1)), int(m.group(4)), int(m.group(5)),
                        int(m.group(6)), tzinfo=timezone(decalage))
    except ValueError:
        return None


def _ouvrir(fichier: Path):
    return gzip.open(fichier, "rt", encoding="utf-8", errors="replace") if fichier.suffix == ".gz" \
        else fichier.open(encoding="utf-8", errors="replace")


def _reseaux(adresses: str) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    reseaux = []
    for morceau in adresses.split():
        try:
            reseaux.append(ipaddress.ip_network(morceau, strict=False))
        except ValueError:
            continue
    return reseaux


def _exclue(ip: str, reseaux) -> bool:
    try:
        adresse = ipaddress.ip_address(ip)
    except ValueError:
        return True   # pas une adresse : ligne ignorée
    return any(adresse in r for r in reseaux)


def compter(journal: Path, jours: int, ips_exclues: str = "", maintenant: datetime | None = None) -> dict[str, int]:
    """{identifiant d'article (12 caractères) : nombre d'adresses IP distinctes} sur les `jours` derniers jours.
    Journal absent ou illisible : {} (un message dans le journal de build)."""
    fichiers = sorted(journal.parent.glob(journal.name + "*")) if journal.parent.is_dir() else []
    if not fichiers:
        return {}
    limite = (maintenant or datetime.now(timezone.utc)) - timedelta(days=jours)
    reseaux = _reseaux(ips_exclues)
    visiteurs: dict[str, set[str]] = defaultdict(set)
    for fichier in fichiers:
        try:
            with _ouvrir(fichier) as lignes:
                for ligne in lignes:
                    if "/articles/" not in ligne:
                        continue
                    m = LIGNE.match(ligne)
                    if not m or m.group(4) != "200" or ROBOTS.search(m.group(5)):
                        continue
                    article = ADRESSE_ARTICLE.match(m.group(3))
                    if not article:
                        continue
                    quand = lire_date(m.group(2))
                    if quand is None:
                        continue
                    if quand < limite or _exclue(m.group(1), reseaux):
                        continue
                    visiteurs[article.group(1)].add(m.group(1))
        except (OSError, EOFError) as e:
            print(f"   ! plus lus : {fichier} illisible ({e})", flush=True)
    return {ident: len(ips) for ident, ips in visiteurs.items()}


def plus_lus(items: list[dict], compte: dict[str, int], nombre: int, identifiant) -> list[tuple[dict, int]]:
    """Les `nombre` articles du site les plus lus : [(article, adresses distinctes)], du plus lu au moins lu.
    À égalité, le plus récent d'abord. `identifiant` : la fonction qui donne l'identifiant d'un lien (article_id)."""
    par_id = {identifiant(i["link"]): i for i in items}
    epoque = datetime.min.replace(tzinfo=timezone.utc)
    classes = sorted(((par_id[i], n) for i, n in compte.items() if i in par_id),
                     key=lambda c: (-c[1], -(c[0].get("date") or epoque).timestamp()))
    return classes[:nombre]
