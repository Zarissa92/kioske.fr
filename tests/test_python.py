"""Tests du code Python qui fabrique les pages : gabarits, JSON des données, galerie des blocs, scripts.

Bibliothèque standard seulement (unittest). Lancés par tests/lancer.sh.
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from kioske import gabarits, javascript, sources  # noqa: E402
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


class PageRemplaceeDe404(unittest.TestCase):
    """static/404.html : publiée à la racine, sobre, sans ressource d'un autre site."""

    PAGE = Path(__file__).resolve().parent.parent / "static" / "404.html"
    NGINX = Path(__file__).resolve().parent.parent / "deploy" / "deployer_nginx.sh"

    def test_page_en_francais_sans_indexation(self):
        html = self.PAGE.read_text(encoding="utf-8")
        self.assertIn('lang="fr"', html)
        self.assertIn('content="noindex"', html)

    def test_aucune_ressource_externe_ni_script(self):
        html = self.PAGE.read_text(encoding="utf-8")
        self.assertNotIn("<script", html)
        for attribut in ('src="', 'href="', 'url("'):
            for morceau in html.split(attribut)[1:]:
                adresse = morceau.split('"')[0].split(")")[0]
                self.assertFalse(adresse.startswith(("http://", "https://", "//")), adresse)

    def test_nginx_sert_la_page_sur_404(self):
        conf = self.NGINX.read_text(encoding="utf-8")
        self.assertIn("error_page 404 /404.html;", conf)
        self.assertIn("location = /404.html", conf)


class CommentairesDesSources(unittest.TestCase):
    """« # » ignore la fin de ligne (hors guillemets), et les sources restent lues."""

    def setUp(self):
        import tempfile
        self.dossier = Path(tempfile.mkdtemp())
        self.flux = self.dossier / "RSS_feeds.txt"
        self.twitch = self.dossier / "Twitch_feeds.txt"
        self.flux.write_text(
            "# commentaire seul\n"
            "[Panneau: Test] # après panneau\n"
            "[Test: Cat] # après catégorie\n"
            '"https://a.example/rss" # après flux\n'
            '"https://b.example/#frag"\n',
            encoding="utf-8")
        self.twitch.write_text(
            "[Panneau: Test]\n"
            "# rien\n"
            '"chaine1" # note\n',
            encoding="utf-8")

    def test_flux_lus_malgre_les_commentaires(self):
        self.assertEqual(sources.read_feeds(self.flux),
                         ["https://a.example/rss", "https://b.example/#frag"])

    def test_chaines_lues_malgre_les_commentaires(self):
        self.assertEqual(sources.read_twitch(self.twitch), ["chaine1"])

    def test_panneau_et_categorie_lus_apres_commentaire(self):
        panneaux, categories = sources.read_panneaux_and_categories(self.flux, self.twitch)
        self.assertEqual(panneaux["https://a.example/rss"], "Test")
        self.assertEqual(categories["https://a.example/rss"], "Cat")
        self.assertEqual(panneaux["twitch:chaine1"], "Test")

    def test_diese_entre_guillemets_fait_partie_de_l_url(self):
        self.assertIn("https://b.example/#frag", sources.read_feeds(self.flux))


class EditeurCfg(unittest.TestCase):
    """outils/cfg_editeur.py : modifier kioske.cfg sans perdre ses commentaires, et valider les valeurs."""

    CFG = Path(__file__).resolve().parent.parent / "kioske.cfg"

    def setUp(self):
        from outils import cfg_editeur
        self.ce = cfg_editeur
        self.texte = self.CFG.read_text(encoding="utf-8")

    def test_relecture_sans_modification_identique(self):
        self.assertEqual(self.ce.lire(self.texte).texte(), self.texte)

    def test_modification_ne_change_que_la_valeur(self):
        doc = self.ce.lire(self.texte)
        doc.modifier("veille", "articles_flux_rss", "150")
        nouveau = doc.texte()
        self.assertIn("articles_flux_rss = 150\n", nouveau)
        self.assertEqual(nouveau.count("#"), self.texte.count("#"), "les commentaires doivent rester")
        self.assertEqual(len(nouveau.splitlines()), len(self.texte.splitlines()))

    def test_modification_relue_par_configparser(self):
        import configparser
        doc = self.ce.lire(self.texte)
        doc.modifier("site", "galerie_panneau", "1")
        cfg = configparser.ConfigParser()
        cfg.read_string(doc.texte())
        self.assertEqual(cfg["site"]["galerie_panneau"], "1")

    def test_cle_absente_refusee(self):
        with self.assertRaises(KeyError):
            self.ce.lire(self.texte).modifier("site", "inexistant", "x")

    def test_validation(self):
        doc = self.ce.lire(self.texte)
        themes = self.ce.noms_themes(doc)
        self.assertIsNone(self.ce.valider("veille", "articles_flux_rss", "100"))
        self.assertIsNotNone(self.ce.valider("veille", "articles_flux_rss", "abc"))
        self.assertIsNotNone(self.ce.valider("veille", "articles_flux_rss", "5000"))
        self.assertIsNone(self.ce.valider("site", "theme", "default", themes=themes))
        self.assertIsNotNone(self.ce.valider("site", "theme", "inconnu", themes=themes))
        self.assertIsNotNone(self.ce.valider("theme.red_neon", "opacite_panneau", "101"))
        self.assertIsNotNone(self.ce.valider("theme.red_neon", "pluie_tete", "rouge"))
        self.assertIsNone(self.ce.valider("theme.red_neon", "pluie_tete", "#ff0000"))
        self.assertIsNotNone(self.ce.valider("theme.red_neon", "fond", "bleu"))

    def test_aide_tiree_du_commentaire(self):
        doc = self.ce.lire(self.texte)
        self.assertIn("Nombre d'articles dans chaque flux RSS", doc.aides[("veille", "articles_flux_rss")])


class DispositionsLegales(unittest.TestCase):
    """Page « Dispositions légales » : publiée, liée sous GitHub en bas de l'accueil, servie par nginx."""

    RACINE = Path(__file__).resolve().parent.parent

    def test_page_publiee_sans_script(self):
        html = (self.RACINE / "static" / "dispositions-legales.html").read_text(encoding="utf-8")
        self.assertIn('lang="fr"', html)
        self.assertNotIn("<script", html)

    def test_lien_sous_github(self):
        gabarit = (self.RACINE / "kioske" / "gabarits" / "accueil.html").read_text(encoding="utf-8")
        self.assertIn('href="/dispositions-legales.html"', gabarit)
        self.assertLess(gabarit.index("GitHub du projet"), gabarit.index("/dispositions-legales.html"))

    def test_nginx_laisse_passer_la_page(self):
        conf = (self.RACINE / "deploy" / "deployer_nginx.sh").read_text(encoding="utf-8")
        self.assertIn("dispositions-legales\\.html", conf)


class CheminsSansPersonne(unittest.TestCase):
    """Aucun chemin personnel écrit en dur dans le code ou les scripts : les répertoires sont demandés."""

    RACINE = Path(__file__).resolve().parent.parent
    FICHIERS = ["kioske/config.py", "kioske.cfg", "deploy/kioske.sh", "deploy/lib_config.sh",
                "deploy/installer_serveur.sh", "deploy/verifier_serveur.sh", "deploy/deployer_nginx.sh",
                "deploy/deployer-nginx-simple.sh", "deploy/kioske-nginx-simple.conf",
                "deploy/systemd/kioske-veille.service"]

    def test_pas_de_chemin_personnel(self):
        for nom in self.FICHIERS:
            texte = (self.RACINE / nom).read_text(encoding="utf-8")
            for motif in ("/home/<utilisateur>", "/home/<utilisateur>"):
                self.assertNotIn(motif, texte, f"{nom} contient {motif}")

    def test_ip_publique_absente_de_la_configuration(self):
        self.assertNotIn("ip_publique", (self.RACINE / "kioske.cfg").read_text(encoding="utf-8"))


class ImagesDesSources(unittest.TestCase):
    """Les images des articles gardent leur adresse d'origine : rien n'est copié dans build/."""

    def test_adresses_https_gardees_telles_quelles(self):
        from kioske import images
        urls = ["https://exemple.test/a.jpg", "http://exemple.test/b.jpg", None, "", "https://exemple.test/a.jpg"]
        self.assertEqual(images.telecharger_images(urls), {"https://exemple.test/a.jpg": "https://exemple.test/a.jpg"})

    def test_repli_sur_la_lettre(self):
        from kioske.rendu_statique import image_avec_repli
        html = image_avec_repli("https://exemple.test/a.jpg", "Titre", "A")
        self.assertIn('onerror="this.onerror=null;this.hidden=true;this.nextElementSibling.hidden=false"', html)
        self.assertIn('<span class="lettre" hidden>A</span>', html)


if __name__ == "__main__":
    unittest.main()
