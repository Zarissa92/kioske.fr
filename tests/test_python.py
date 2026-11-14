"""Tests du code Python qui fabrique les pages : gabarits, JSON des données, galerie des blocs, scripts.

Bibliothèque standard seulement (unittest). Lancés par tests/lancer.sh.
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from kioske import gabarits, javascript  # noqa: E402
from kioske.rendu import NB_GALERIE_BLOC, render_galerie_bloc  # noqa: E402


class Gabarits(unittest.TestCase):
    def test_chaque_gabarit_existe(self):
        for nom in ("accueil.html", "article.html", "categorie.html", "rss.html"):
            self.assertTrue((gabarits.DOSSIER_GABARITS / nom).is_file(), nom)

    def test_valeur_manquante_arrete_le_build(self):
        with self.assertRaises(KeyError) as erreur:
            gabarits.remplir("rss.html", css="")
        self.assertIn("rss.html", str(erreur.exception))

    def test_valeur_inseree_telle_quelle(self):
        # Une valeur qui contient « $ » ou « ${…} » n'est pas relue comme un gabarit
        gabarits._GABARITS["essai"] = gabarits.Template("<p>${texte}</p>\n")
        self.assertEqual(gabarits.remplir("essai", texte="10 $ et ${autre}"), "<p>10 $ et ${autre}</p>\n")


class Javascript(unittest.TestCase):
    def test_json_ne_ferme_pas_la_balise(self):
        donnees = {"t": "</script><script>alert(1)</script><!-- x"}
        texte = javascript.json_pour_page(donnees)
        self.assertNotIn("</", texte)
        self.assertNotIn("<!--", texte)
        self.assertEqual(json.loads(texte), donnees)

    def test_aucun_script_ne_ferme_la_balise(self):
        for fichier in javascript.DOSSIER_JS.glob("*.js"):
            self.assertNotIn("</script", fichier.read_text(encoding="utf-8").lower(), fichier.name)

    def test_chaque_fichier_js_est_utilise(self):
        code = (Path(javascript.__file__)).read_text(encoding="utf-8")
        for fichier in javascript.DOSSIER_JS.glob("*.js"):
            self.assertIn(f'lire("{fichier.name}")', code, f"{fichier.name} n'est lu par aucune constante")


class GalerieDesBlocs(unittest.TestCase):
    def articles(self, n):
        return [{"link": f"https://exemple.test/a{i}", "title": f'Titre {i} "x" <b>',
                 "image": "" if i % 5 == 0 else f"img/veille/f{i}.jpg"} for i in range(n)]

    def test_limite_et_articles_sans_image(self):
        html = render_galerie_bloc("Médias", self.articles(40), {})
        self.assertEqual(html.count('class="galerie-carte"'), NB_GALERIE_BLOC)
        self.assertNotIn('src=""', html)   # les articles sans image sont sautés

    def test_texte_echappe(self):
        html = render_galerie_bloc('Médias & "tests"', self.articles(3), {})
        self.assertIn("&lt;b&gt;", html)
        self.assertNotIn("<b>", html)
        self.assertIn("Médias &amp; &quot;tests&quot;", html)

    def test_fleches_comme_la_grande_galerie(self):
        html = render_galerie_bloc("Médias", self.articles(3), {})
        self.assertIn('class="galerie-arrow-left"', html)
        self.assertIn('class="galerie-arrow-right"', html)

    def test_aucune_image_aucune_galerie(self):
        sans_image = [a for a in self.articles(20) if not a["image"]]
        self.assertEqual(render_galerie_bloc("Médias", sans_image, {}), "")


if __name__ == "__main__":
    unittest.main()
