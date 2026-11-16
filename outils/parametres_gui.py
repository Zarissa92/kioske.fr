"""Éditeur graphique de kioske.cfg (tkinter, bibliothèque standard seulement).

Lancement, avec le Python du projet :
    venv_blog/bin/python outils/parametres_gui.py

Le fichier n'est modifié qu'au clic sur « Enregistrer ». Avant, la copie kioske.cfg.bak est faite ; le texte
d'aide de chaque réglage est le commentaire placé au-dessus de sa clé dans kioske.cfg.
Après un changement : reconstruire le site (bin/build_site.py), puis publier (voir le README).
"""
from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from outils import cfg_editeur as ce  # noqa: E402

SECTIONS_FIXES = [("site", "Site"), ("veille", "Veille"), ("serveur", "Serveur"), ("reseaux", "Réseaux")]

LIBELLES = {
    "domaine": "Domaine", "nom": "Nom du site", "theme": "Thème par défaut",
    "galerie_principale": "Galerie principale", "galerie_panneau": "Galeries dans les panneaux",
    "articles_flux_rss": "Articles par flux RSS", "videos_par_chaine": "Vidéos par chaîne Twitch",
    "articles_par_source": "Articles par source", "delai_nouvel_essai_heures": "Délai de nouvel essai (heures)",
    "ip_jamais_bannies": "Adresses jamais bannies", "ip_publique": "IP publique", "intervalle_timer": "Intervalle de publication",
    "discord": "Discord", "mastodon": "Mastodon", "rss": "Page RSS",
    "nom_theme": "Nom affiché", "fond": "Fond", "pluie": "Pluie matricielle", "opacite_panneau": "Opacité du panneau (%)",
    "css": "Feuille de style", "pluie_tete": "Pluie : tête", "pluie_haut": "Pluie : haut",
    "pluie_moyen": "Pluie : milieu", "pluie_bas": "Pluie : bas",
}


def indication(section: str, cle: str, doc: ce.Document) -> str:
    """Texte d'aide : le commentaire du fichier, sinon les valeurs possibles."""
    if (section, cle) in doc.aides:
        return doc.aides[(section, cle)]
    r = ce.regle(section, cle)
    if r is None:
        return ""
    if r[0] == "choix":
        return "Valeurs possibles : " + " | ".join(r[1])
    if r[0] == "entier":
        return f"Nombre entier entre {r[1]} et {r[2]}."
    if r[0] == "couleur":
        return "Couleur au format #rrggbb."
    if r[0] == "theme":
        return "Nom d'une section [theme.<nom>] du fichier."
    return ""


class Parametres(tk.Tk):
    def __init__(self, chemin: Path = ce.CHEMIN_CFG):
        super().__init__()
        self.chemin = chemin
        self.title(f"KiosKe : réglages ({chemin.name})")
        self.minsize(640, 480)
        self.doc = ce.lire_fichier(chemin)
        self.originaux: dict[tuple[str, str], str] = {}
        self.variables: dict[tuple[str, str], tk.StringVar] = {}
        self.erreurs_labels: dict[tuple[str, str], ttk.Label] = {}
        self.statut = tk.StringVar()

        self._construire()
        self._charger()

    # ---------- construction ----------
    def _construire(self) -> None:
        cadre = ttk.Frame(self, padding=8)
        cadre.pack(fill="both", expand=True)
        self.onglets = ttk.Notebook(cadre)
        self.onglets.pack(fill="both", expand=True)

        for section, titre in SECTIONS_FIXES:
            if section in self.doc.sections():
                self.onglets.add(self._page(section, self.doc.cles(section)), text=titre)

        self.onglet_themes = self._page_themes()
        self.onglets.add(self.onglet_themes, text="Thèmes")

        barre = ttk.Frame(cadre)
        barre.pack(fill="x", pady=(8, 0))
        ttk.Label(barre, textvariable=self.statut).pack(side="left")
        ttk.Button(barre, text="Quitter", command=self._quitter).pack(side="right")
        ttk.Button(barre, text="Annuler les modifications", command=self._annuler).pack(side="right", padx=6)
        ttk.Button(barre, text="Enregistrer", command=self._enregistrer).pack(side="right")
        self.protocol("WM_DELETE_WINDOW", self._quitter)

    def _page(self, section: str, cles: list[str], parent=None) -> ttk.Frame:
        page = ttk.Frame(parent or self.onglets, padding=12)
        page.columnconfigure(0, weight=1)
        for ligne, cle in enumerate(cles):
            self._champ(page, section, cle, ligne)
        return page

    def _champ(self, parent, section: str, cle: str, ligne: int) -> None:
        bloc = ttk.Frame(parent)
        bloc.grid(row=ligne, column=0, sticky="ew", pady=4)
        bloc.columnconfigure(1, weight=1)
        cle_libelle = "nom_theme" if section.startswith("theme.") and cle == "nom" else cle
        ttk.Label(bloc, text=LIBELLES.get(cle_libelle, cle), font=("TkDefaultFont", 10, "bold")).grid(row=0, column=0, sticky="w")
        var = tk.StringVar()
        self.variables[(section, cle)] = var
        r = ce.regle(section, cle)
        if r is not None and r[0] == "choix":
            saisie = ttk.Combobox(bloc, textvariable=var, values=list(r[1]), state="readonly", width=24)
        elif r is not None and r[0] == "theme":
            saisie = ttk.Combobox(bloc, textvariable=var, values=ce.noms_themes(self.doc), state="readonly", width=24)
        else:
            saisie = ttk.Entry(bloc, textvariable=var, width=60)
        saisie.grid(row=0, column=1, sticky="ew", padx=(12, 0))
        aide = indication(section, cle, self.doc)
        if aide:
            ttk.Label(bloc, text=aide, foreground="#555555", wraplength=520).grid(row=1, column=1, sticky="w", padx=(12, 0))
        erreur = ttk.Label(bloc, foreground="#b00020")
        erreur.grid(row=2, column=1, sticky="w", padx=(12, 0))
        self.erreurs_labels[(section, cle)] = erreur
        var.trace_add("write", lambda *_: self._maj_statut())

    def _page_themes(self) -> ttk.Frame:
        page = ttk.Frame(self.onglets, padding=12)
        choix = ttk.Frame(page)
        choix.pack(fill="x")
        ttk.Label(choix, text="Thème :").pack(side="left")
        self.theme_choisi = tk.StringVar()
        liste = ttk.Combobox(choix, textvariable=self.theme_choisi, state="readonly", width=24)
        liste.pack(side="left", padx=8)
        self.zone_theme = ttk.Frame(page)
        self.zone_theme.pack(fill="both", expand=True, pady=(8, 0))
        self.pages_themes: dict[str, ttk.Frame] = {}
        noms = ce.noms_themes(self.doc)
        liste["values"] = noms
        for nom in noms:
            section = f"theme.{nom}"
            cles = self.doc.cles(section)
            self.pages_themes[nom] = self._page(section, cles, parent=self.zone_theme)
        liste.bind("<<ComboboxSelected>>", lambda _e: self._montrer_theme())
        if noms:
            self.theme_choisi.set(noms[0])
            self._montrer_theme()
        return page

    def _montrer_theme(self) -> None:
        for page in self.pages_themes.values():
            page.pack_forget()
        page = self.pages_themes.get(self.theme_choisi.get())
        if page is not None:
            page.pack(fill="both", expand=True)

    # ---------- état ----------
    def _charger(self) -> None:
        for cle, valeur in self.doc.valeurs().items():
            self.originaux[cle] = valeur
            self.variables[cle].set(valeur)
        self._maj_statut()

    def _modifications(self) -> dict[tuple[str, str], str]:
        return {cle: var.get() for cle, var in self.variables.items() if var.get() != self.originaux[cle]}

    def _maj_statut(self) -> None:
        n = len(self._modifications())
        self.statut.set(f"{n} modification(s) non enregistrée(s)" if n else "Aucune modification")

    def _annuler(self) -> None:
        for cle, valeur in self.originaux.items():
            self.variables[cle].set(valeur)
        self._effacer_erreurs()

    def _effacer_erreurs(self) -> None:
        for label in self.erreurs_labels.values():
            label.config(text="")

    def _quitter(self) -> None:
        if self._modifications() and not messagebox.askyesno(
                "Quitter", "Des modifications ne sont pas enregistrées. Quitter quand même ?"):
            return
        self.destroy()

    # ---------- enregistrement ----------
    def _enregistrer(self) -> None:
        self._effacer_erreurs()
        saisies = {cle: var.get() for cle, var in self.variables.items()}
        erreurs = ce.valider_tout(self.doc, saisies)
        if erreurs:
            for cle, message in erreurs.items():
                self.erreurs_labels[cle].config(text="✗ " + message)
            messagebox.showerror("Réglages refusés", "\n".join(
                f"[{s}] {c} : {m}" for (s, c), m in erreurs.items()))
            return
        modifs = self._modifications()
        if not modifs:
            messagebox.showinfo("Rien à enregistrer", "Aucune modification.")
            return
        ce.appliquer(self.doc, modifs)
        try:
            sauvegarde = ce.enregistrer(self.doc, self.chemin)
        except (ValueError, OSError) as erreur:
            messagebox.showerror("Enregistrement impossible", str(erreur))
            return
        for cle, valeur in saisies.items():
            self.originaux[cle] = valeur
        self._maj_statut()
        messagebox.showinfo("Enregistré", (
            f"{len(modifs)} réglage(s) enregistré(s).\n"
            f"Ancienne version : {sauvegarde.name}\n\n"
            "Pour que le site en tienne compte : reconstruire (bin/build_site.py), puis publier."))


def main() -> None:
    Parametres().mainloop()


if __name__ == "__main__":
    main()
