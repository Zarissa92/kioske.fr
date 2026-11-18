"""Lecture, validation et modification de kioske.cfg, sans tkinter (testable seul).

Le fichier est édité ligne par ligne : seule la valeur de chaque « clé = valeur » change. Les commentaires,
les lignes vides et l'ordre des sections restent tels quels (configparser les effacerait à l'écriture).

Les règles de validation reprennent celles de kioske/config.py (nombres entiers) et de kioske/themes.py
(fond, pluie, opacité). Ce module n'importe pas kioske : importer kioske lit kioske.cfg et peut s'arrêter.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CHEMIN_CFG = RACINE / "kioske.cfg"

RE_SECTION = re.compile(r"^\s*\[([^\[\]]+)\]\s*$")
RE_CLE = re.compile(r"^(\s*)([^#;\s=][^=]*?)(\s*=\s*)(.*?)(\r?\n)?$")
RE_COULEUR = re.compile(r"^#[0-9a-fA-F]{6}$")

FONDS = ("noir",)

# Réglages des sections fixes : (type, bornes ou choix). Types : texte, entier, choix, couleur.
SCHEMA = {
    ("site", "domaine"): ("texte",),
    ("site", "nom"): ("texte",),
    ("site", "theme"): ("theme",),                      # une des sections [theme.<nom>]
    ("site", "galerie_principale"): ("choix", ("0", "1")),
    ("site", "galerie_panneau"): ("choix", ("0", "1")),
    ("veille", "articles_flux_rss"): ("entier", 1, 1000),
    ("veille", "videos_par_chaine"): ("entier", 0, 200),
    ("veille", "articles_par_source"): ("entier", 0, 100000),   # 0 = tous
    ("veille", "delai_nouvel_essai_heures"): ("entier", 1, 720),
    ("serveur", "ip_jamais_bannies"): ("texte",),
    ("serveur", "intervalle_timer"): ("texte",),        # format systemd : 30min, 1h…
    ("reseaux", "discord"): ("texte",),                 # vide = lien désactivé
    ("reseaux", "mastodon"): ("texte",),
    ("reseaux", "rss"): ("texte",),
}

# Réglages de chaque section [theme.<nom>]
SCHEMA_THEME = {
    "nom": ("texte",),
    "fond": ("choix", FONDS),
    "pluie": ("choix", ("oui", "non")),
    "opacite_panneau": ("entier", 0, 100),
    "css": ("texte",),
    "pluie_tete": ("couleur",),
    "pluie_haut": ("couleur",),
    "pluie_moyen": ("couleur",),
    "pluie_bas": ("couleur",),
}


@dataclass
class Document:
    """Le texte de kioske.cfg, ligne par ligne, avec l'emplacement de chaque valeur."""
    lignes: list[str]
    # (section, clé) -> index de la ligne dans « lignes »
    emplacements: dict[tuple[str, str], int] = field(default_factory=dict)
    # (section, clé) -> commentaire placé juste au-dessus de la clé (texte d'aide)
    aides: dict[tuple[str, str], str] = field(default_factory=dict)

    def sections(self) -> list[str]:
        """Noms des sections, dans l'ordre du fichier."""
        vues: list[str] = []
        for section, _ in self.emplacements:
            if section not in vues:
                vues.append(section)
        return vues

    def cles(self, section: str) -> list[str]:
        return [cle for s, cle in self.emplacements if s == section]

    def valeur(self, section: str, cle: str) -> str:
        index = self.emplacements[(section, cle)]
        return RE_CLE.match(self.lignes[index]).group(4).strip()

    def valeurs(self) -> dict[tuple[str, str], str]:
        return {(s, c): self.valeur(s, c) for (s, c) in self.emplacements}

    def modifier(self, section: str, cle: str, nouvelle: str) -> None:
        """Remplace la valeur d'une clé existante. Le reste de la ligne (espaces, fin de ligne) est gardé."""
        index = self.emplacements.get((section, cle))
        if index is None:
            raise KeyError(f"[{section}] {cle} : clé absente du fichier")
        if "\n" in nouvelle or "\r" in nouvelle:
            raise ValueError("une valeur ne peut pas contenir de saut de ligne")
        ligne = self.lignes[index]
        m = RE_CLE.match(ligne)
        fin = m.group(5) or ""
        self.lignes[index] = f"{m.group(1)}{m.group(2)}{m.group(3)}{nouvelle}{fin}"

    def texte(self) -> str:
        return "".join(self.lignes)


def lire(texte: str) -> Document:
    """Analyse le texte d'un kioske.cfg. Chaque « clé = valeur » est repérée dans sa section."""
    lignes = texte.splitlines(keepends=True)
    doc = Document(lignes=lignes)
    section = None
    commentaires: list[str] = []   # commentaires accumulés juste au-dessus de la prochaine clé
    for index, ligne in enumerate(lignes):
        stripped = ligne.strip()
        if stripped.startswith(("#", ";")):
            commentaires.append(stripped.lstrip("#; ").rstrip())
            continue
        if not stripped:
            commentaires = []
            continue
        m_section = RE_SECTION.match(ligne)
        if m_section:
            section = m_section.group(1).strip()
            commentaires = []
            continue
        m = RE_CLE.match(ligne)
        if m and section is not None:
            cle = (section, m.group(2).strip())
            doc.emplacements[cle] = index
            if commentaires:
                doc.aides[cle] = " ".join(c for c in commentaires if c)
            commentaires = []
    return doc


def lire_fichier(chemin: Path = CHEMIN_CFG) -> Document:
    return lire(chemin.read_text(encoding="utf-8"))


def regle(section: str, cle: str):
    """Règle de validation d'un réglage, ou None s'il n'est pas connu (il reste modifiable en texte libre)."""
    if section.startswith("theme."):
        return SCHEMA_THEME.get(cle, ("texte",))
    return SCHEMA.get((section, cle))


def noms_themes(doc: Document) -> list[str]:
    """Noms des thèmes (sections [theme.<nom>] sans le préfixe) : valeurs possibles de [site] theme."""
    return [s.split(".", 1)[1] for s in doc.sections() if s.startswith("theme.")]


def valider(section: str, cle: str, texte: str, themes: list[str] | None = None) -> str | None:
    """Message d'erreur si la valeur est refusée, None si elle est correcte. « themes » : noms de thèmes connus."""
    r = regle(section, cle)
    if r is None:
        return None
    type_ = r[0]
    if type_ == "texte":
        if cle in ("domaine", "nom") and not texte.strip():
            return "ne peut pas être vide"
        return None
    if type_ == "entier":
        if not texte.isdigit():
            return "nombre entier positif attendu"
        n = int(texte)
        if not r[1] <= n <= r[2]:
            return f"entre {r[1]} et {r[2]}"
        return None
    if type_ == "choix":
        if texte not in r[1]:
            return "valeurs possibles : " + ", ".join(r[1])
        return None
    if type_ == "theme":
        if themes is not None and texte not in themes:
            return "doit être le nom d'une section [theme.<nom>] : " + ", ".join(themes)
        return None
    if type_ == "couleur":
        if not RE_COULEUR.match(texte):
            return "couleur attendue au format #rrggbb"
        return None
    return None


def valider_tout(doc: Document, modifs: dict[tuple[str, str], str]) -> dict[tuple[str, str], str]:
    """Erreurs par réglage (dict vide si tout est correct). « modifs » : les valeurs saisies."""
    themes = noms_themes(doc)
    erreurs = {}
    for (section, cle), texte in modifs.items():
        message = valider(section, cle, texte, themes=themes)
        if message:
            erreurs[(section, cle)] = message
    return erreurs


def appliquer(doc: Document, modifs: dict[tuple[str, str], str]) -> None:
    for (section, cle), texte in modifs.items():
        doc.modifier(section, cle, texte)


def nom_sauvegarde(chemin: Path) -> Path:
    """kioske.cfg -> kioske.cfg.bak (ignoré par git : *.bak)."""
    return chemin.with_name(chemin.name + ".bak")


def enregistrer(doc: Document, chemin: Path = CHEMIN_CFG) -> Path:
    """Sauvegarde l'ancien fichier (.bak), vérifie que le nouveau reste un INI lisible, puis l'écrit.
    Renvoie le chemin de la sauvegarde. Lève ValueError si le texte ne se relit pas."""
    import configparser
    nouveau = doc.texte()
    verif = configparser.ConfigParser()
    try:
        verif.read_string(nouveau)
    except configparser.Error as erreur:
        raise ValueError(f"fichier invalide, rien écrit : {erreur}") from erreur
    sauvegarde = nom_sauvegarde(chemin)
    sauvegarde.write_bytes(chemin.read_bytes())
    tmp = chemin.with_name(chemin.name + ".tmp")
    tmp.write_text(nouveau, encoding="utf-8")
    tmp.replace(chemin)
    return sauvegarde
