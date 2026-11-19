"""Tests du code Python qui fabrique les pages : gabarits, JSON des données, galerie des blocs, scripts.

Bibliothèque standard seulement (unittest). Lancés par tests/lancer.sh.
"""
import json
import re
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
            self.assertTrue(f'lire("{fichier.name}")' in code or f'"{fichier.name}"' in code,
                            f"{fichier.name} n'est lu par aucune constante")


class GalerieDesBlocs(unittest.TestCase):
    def articles(self, n):
        return [{"link": f"https://exemple.test/a{i}", "title": f'Titre {i} "x" <b>',
                 "image": "" if i % 5 == 0 else f"img/veille/f{i}.jpg"} for i in range(n)]

    def test_limite_et_articles_sans_image(self):
        html = render_galerie_bloc("Médias", self.articles(40), {})
        self.assertEqual(html.count('<a href="'), NB_GALERIE_BLOC)   # une carte par article, avec ou sans image
        self.assertNotIn('src=""', html)   # sans image : le titre, pas une image vide

    def test_texte_echappe(self):
        html = render_galerie_bloc('Médias & "tests"', self.articles(3), {})
        self.assertIn("&lt;b&gt;", html)
        self.assertNotIn("<b>", html)
        self.assertIn("Médias &amp; &quot;tests&quot;", html)

    def test_fleches_comme_la_grande_galerie(self):
        html = render_galerie_bloc("Médias", self.articles(3), {})
        self.assertIn('class="galerie-arrow-left"', html)
        self.assertIn('class="galerie-arrow-right"', html)

    def test_sans_image_le_titre_remplace_la_vignette(self):
        sans_image = [a for a in self.articles(20) if not a["image"]]
        html = render_galerie_bloc("Médias", sans_image, {})
        self.assertIn("galerie-carte-sans-image", html)
        self.assertNotIn("<img", html)


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
    """Dispositions légales : document du Menu, à sa racine (menu/Dispositions-legales.md, adresse
    /menu/dispositions-legales/, thème du visiteur). Liée sous GitHub en bas de l'accueil ; l'ancienne
    adresse /dispositions-legales.html est redirigée par nginx."""

    RACINE = Path(__file__).resolve().parent.parent

    def test_document_a_la_racine_du_menu(self):
        from kioske.menu import charger_arbre
        arbre = charger_arbre(self.RACINE / "menu")
        racine = [c for c in arbre if c.get("fichier")]
        self.assertIn("dispositions-legales", [e["chemin"] for c in racine for e in c["entrees"]])

    def test_plus_de_page_statique(self):
        self.assertFalse((self.RACINE / "static" / "dispositions-legales.html").exists())

    def test_lien_sous_github(self):
        gabarit = (self.RACINE / "kioske" / "gabarits" / "accueil.html").read_text(encoding="utf-8")
        self.assertIn('href="/menu/dispositions-legales/"', gabarit)
        self.assertLess(gabarit.index("GitHub du projet"), gabarit.index("/menu/dispositions-legales/"))

    def test_nginx_redirige_l_ancienne_adresse(self):
        for nom in ("deployer_nginx.sh", "kioske-nginx.conf"):
            conf = (self.RACINE / "deploy" / nom).read_text(encoding="utf-8")
            self.assertIn("location = /dispositions-legales.html {", conf, nom)
            self.assertIn("return 301 /menu/dispositions-legales/;", conf, nom)


class CheminsSansPersonne(unittest.TestCase):
    """Aucun chemin personnel écrit en dur dans le code ou les scripts : les répertoires sont demandés."""

    RACINE = Path(__file__).resolve().parent.parent
    FICHIERS = ["kioske/config.py", "kioske.cfg", "deploy/kioske.sh", "deploy/lib_config.sh",
                "deploy/installer_serveur.sh", "deploy/verifier_serveur.sh", "deploy/deployer_nginx.sh",
                "deploy/deployer_nginx_simple.sh", "deploy/kioske-nginx.conf",
                "deploy/systemd/kioske-veille.service"]

    def test_pas_de_chemin_personnel(self):
        for nom in self.FICHIERS:
            texte = (self.RACINE / nom).read_text(encoding="utf-8")
            # Un dossier personnel écrit en dur (/home/<compte>/…) ; « /home/<utilisateur> » (exemple) est permis.
            # Aucun nom de compte n'est écrit ici : le motif suffit.
            trouve = re.search(r"/home/[a-z][a-z0-9_-]*", texte)
            self.assertIsNone(trouve, f"{nom} contient {trouve.group(0) if trouve else ''}")

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
        self.assertIn('data-repli="image"', html)   # repli sans onerror : images_repli.js
        self.assertIn('<span class="lettre" hidden>A</span>', html)


class MenuDuDossier(unittest.TestCase):
    """Page Menu : lecture de menu/ (catégories, sous-catégories, front matter) et rendu Markdown."""

    def setUp(self):
        import tempfile
        self.tmp = tempfile.TemporaryDirectory()
        self.racine = Path(self.tmp.name) / "menu"
        self.racine.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def ecrire(self, chemin, texte):
        fichier = self.racine / chemin
        fichier.parent.mkdir(parents=True, exist_ok=True)
        fichier.write_text(texte, encoding="utf-8")

    def test_front_matter(self):
        from kioske.menu import separer_front_matter
        meta, corps = separer_front_matter('---\ntitre: "Bonjour"\nordre: 3\n---\n# Texte\n')
        self.assertEqual(meta, {"titre": "Bonjour", "ordre": "3"})
        self.assertEqual(corps, "# Texte\n")

    def test_sans_front_matter_tout_est_corps(self):
        from kioske.menu import separer_front_matter
        self.assertEqual(separer_front_matter("# Seul\n"), ({}, "# Seul\n"))

    def test_arborescence_categories_sous_categories_et_ordre(self):
        from kioske.menu import charger_arbre
        self.ecrire("Zeta/a.md", "# A\n")
        self.ecrire("Alpha/sous/b.md", "---\ntitre: Bee\nordre: 2\n---\nTexte **gras**\n")
        self.ecrire("Alpha/sous/c.md", "---\nordre: 1\n---\nTexte\n")
        self.ecrire("Alpha/_dossier.md", "---\ntitre: Première\nordre: 1\n---\n")
        arbre = charger_arbre(self.racine)
        # Ordre demandé d'abord : « Alpha » (ordre 1) avant « Zeta » (sans ordre)
        self.assertEqual([c["titre"] for c in arbre], ["Première", "Zeta"])
        sous = arbre[0]["sous"][0]
        self.assertEqual(sous["titre"], "sous")
        self.assertEqual([e["titre"] for e in sous["entrees"]], ["c", "Bee"])
        self.assertEqual(sous["entrees"][1]["chemin"], "alpha/sous/b")
        self.assertIn("<strong>gras</strong>", sous["entrees"][1]["html"])

    def test_fichiers_et_dossiers_caches_ignores(self):
        from kioske.menu import charger_arbre
        self.ecrire("Cat/_brouillon.md", "# Non\n")
        self.ecrire("Cat/.cache/x.md", "# Non\n")
        self.ecrire("Cat/ok.md", "# Oui\n")
        arbre = charger_arbre(self.racine)
        self.assertEqual([e["titre"] for e in arbre[0]["entrees"]], ["ok"])

    def test_fichier_a_la_racine_est_une_categorie(self):
        from kioske.menu import charger_arbre
        self.ecrire("Guide.md", "---\ntitre: Le guide\nordre: 1\n---\n# Texte\n")
        self.ecrire("index.md", "# Introduction\n")
        self.ecrire("Cat/doc.md", "# A\n")
        arbre = charger_arbre(self.racine)
        self.assertEqual([c["titre"] for c in arbre], ["Le guide", "Cat"])
        guide = arbre[0]
        self.assertEqual(guide["entrees"][0]["chemin"], "guide")
        self.assertIn('<h1 id="texte">Texte</h1>', guide["entrees"][0]["html"])  # toc : une ancre par titre

    def test_titre_du_nom_tirets_et_soulignes_comme_espaces(self):
        from kioske.menu import _titre_du_nom
        self.assertEqual(_titre_du_nom("mon_guide-2026"), "mon guide 2026")
        self.assertEqual(_titre_du_nom("a__b--c"), "a b c")

    def test_dossier_img_n_est_pas_une_categorie(self):
        from kioske.menu import charger_arbre
        self.ecrire("img/photo.png", "x")
        self.ecrire("Cat/img/autre.png", "x")
        self.ecrire("Cat/doc.md", "# A\n")
        arbre = charger_arbre(self.racine)
        self.assertEqual([c["titre"] for c in arbre], ["Cat"])
        self.assertEqual(arbre[0]["sous"], [])

    def test_image_relative_pointe_vers_le_dossier_du_document(self):
        from kioske.menu import charger_arbre
        self.ecrire("Cat/Sous/doc.md", "![alt](photo.png)\n\n![web](https://exemple.org/a.png)\n")
        html = charger_arbre(self.racine)[0]["sous"][0]["entrees"][0]["html"]
        self.assertIn('src="/menu/Cat/Sous/photo.png"', html)
        self.assertIn('src="https://exemple.org/a.png"', html)

    def test_dossier_trop_profond_ignore(self):
        from kioske.menu import charger_arbre
        self.ecrire("Cat/Sous/Trop/profond.md", "# Non\n")
        arbre = charger_arbre(self.racine)
        self.assertEqual(arbre[0]["sous"][0]["entrees"], [])

    def test_slugs_uniques_dans_un_dossier(self):
        from kioske.menu import charger_arbre
        self.ecrire("Cat/Mon doc.md", "# A\n")
        self.ecrire("Cat/mon-doc.md", "# B\n")
        slugs = [e["slug"] for e in charger_arbre(self.racine)[0]["entrees"]]
        self.assertEqual(len(set(slugs)), 2)

    def test_saut_de_ligne_garde(self):
        from kioske.menu import charger_arbre
        self.ecrire("Cat/saut.md", "Première ligne\nSeconde ligne\n")
        html = charger_arbre(self.racine)[0]["entrees"][0]["html"]
        self.assertIn("<br", html)

    def test_racine_absente_donne_une_arborescence_vide(self):
        from kioske.menu import charger_arbre
        self.assertEqual(charger_arbre(Path(self.tmp.name) / "absent"), [])

    def test_pages_statiques_sommaire_et_retour(self):
        from kioske.menu import charger_arbre, page_document, page_index
        self.ecrire("Cat/doc.md", "# A\n")
        arbre = charger_arbre(self.racine)
        index = page_index(arbre, 0, 0)
        self.assertIn('href="/menu/cat/doc/"', index)
        self.assertNotIn("onclick=", index)
        doc = page_document(arbre, arbre[0], None, arbre[0]["entrees"][0], 0, 0)
        self.assertIn('aria-current="page"', doc)
        self.assertNotIn("Toutes les ressources", doc)

    def test_code_de_conduite_statique(self):
        from kioske.rendu import render_code_de_conduite
        self.assertIn("<h1>Code de conduite</h1>", render_code_de_conduite(0, 0))



class OrdreDesPanneaux(unittest.TestCase):
    """[panneaux] ordre : les panneaux cités passent en tête, les autres gardent leur ordre."""

    def setUp(self):
        import configparser
        from kioske import config, rendu
        self.config, self.rendu = config, rendu
        self.sauve = config.CFG
        self.cfg = configparser.ConfigParser()

    def tearDown(self):
        self.config.CFG = self.sauve

    def ordre(self, valeur):
        self.cfg.add_section("panneaux")
        self.cfg.set("panneaux", "ordre", valeur)
        self.config.CFG = self.cfg
        return self.config.ordre_panneaux()

    def test_lecture_de_la_clef(self):
        self.assertEqual(self.ordre("LGBT, Médias, LGBT"), ["LGBT", "Médias"])

    def test_vide_donne_liste_vide(self):
        self.assertEqual(self.ordre(""), [])

    def test_sans_section_donne_liste_vide(self):
        self.config.CFG = self.cfg
        self.assertEqual(self.config.ordre_panneaux(), [])

    def test_demande_en_tete_puis_les_autres_dans_leur_ordre(self):
        noms = ["Actu", "Médias", "LGBT", "Vidéo"]
        self.assertEqual(self.rendu.ordre_des_panneaux(noms, ["LGBT", "Médias"]),
                         ["LGBT", "Médias", "Actu", "Vidéo"])

    def test_nom_inconnu_ignore(self):
        noms = ["Actu", "LGBT"]
        self.assertEqual(self.rendu.ordre_des_panneaux(noms, ["Inconnu", "LGBT"]), ["LGBT", "Actu"])

    def test_sans_demande_ordre_inchange(self):
        noms = ["Vidéo", "Actu", ""]
        self.assertEqual(self.rendu.ordre_des_panneaux(noms, []), noms)




class GalerieDeBloc(unittest.TestCase):
    """La galerie d'un bloc prend les articles les plus récents de la catégorie, toutes sources confondues."""

    def test_plus_recent_d_abord(self):
        from datetime import datetime, timezone
        from kioske.rendu import render_galerie_bloc
        ancien = {"link": "https://a.test/vieux", "title": "Vieux", "image": "https://a.test/v.jpg", "source": "A",
                  "date": datetime(2020, 1, 1, tzinfo=timezone.utc)}
        recent = {"link": "https://b.test/neuf", "title": "Neuf", "image": "https://b.test/n.jpg", "source": "B",
                  "date": datetime(2026, 11, 1, tzinfo=timezone.utc)}
        html = render_galerie_bloc("Divers", [ancien, recent], {})  # « ancien » vient en premier (source A)
        self.assertLess(html.index("Neuf"), html.index("Vieux"))


class GalerieSansImage(unittest.TestCase):
    """Un article sans image garde sa place dans la galerie, avec son titre à la place de la vignette."""

    def test_titre_sans_image(self):
        from datetime import datetime, timezone
        from kioske.rendu import render_galerie_bloc
        sans = {"link": "https://a.test/texte", "title": "Article texte", "image": "", "source": "A",
                "date": datetime(2026, 11, 2, tzinfo=timezone.utc)}
        html = render_galerie_bloc("Divers", [sans], {})
        self.assertIn("galerie-carte-sans-image", html)
        self.assertIn('<span class="galerie-carte-texte">Article texte</span>', html)



class RobotsTxt(unittest.TestCase):
    """robots.txt : les robots d'IA sont autorisés avec un délai, les autres sans restriction."""

    def test_robots_ia_autorises_avec_delai(self):
        from kioske.construction import DELAI_ROBOTS_IA, ROBOTS_IA, texte_robots
        texte = texte_robots()
        groupe_ia, reste = texte.split("\n\nUser-agent: *\n")
        for nom in ("GPTBot", "ClaudeBot", "CCBot", "Google-Extended"):
            self.assertIn(nom, ROBOTS_IA)
            self.assertIn(f"User-agent: {nom}\n", groupe_ia)
        self.assertIn("Allow: /\n", groupe_ia)
        self.assertNotIn("Disallow", groupe_ia)
        self.assertTrue(groupe_ia.rstrip().endswith(f"Crawl-delay: {DELAI_ROBOTS_IA}"))
        self.assertTrue(reste.startswith("Allow: /"))
        self.assertIn("Sitemap: ", reste)

if __name__ == "__main__":
    unittest.main()


class MenuEtHorsLigne(unittest.TestCase):
    """Menu à /menu/ (ancienne /ressources/ redirigée), page hors ligne et raccourcis de l'app installée."""

    RACINE = Path(__file__).resolve().parent.parent
    CONFS = ["deploy/kioske-nginx.conf", "deploy/deployer_nginx.sh"]   # à modifier ensemble

    def test_nginx_menu_et_redirection(self):
        for nom in self.CONFS:
            conf = (self.RACINE / nom).read_text(encoding="utf-8")
            self.assertIn("location ~ ^/menu(/[a-z0-9-]+)?", conf, nom)
            self.assertIn("return 301 /menu$1$is_args$args;", conf, nom)
            self.assertIn("hors-ligne\\.html", conf, nom)

    def test_page_hors_ligne_sans_script_ni_ressource_externe(self):
        html = (self.RACINE / "static" / "hors-ligne.html").read_text(encoding="utf-8")
        self.assertIn('lang="fr"', html)
        self.assertNotIn("<script", html)
        self.assertNotIn("https://", html)

    def test_service_worker_met_en_cache_menu_et_hors_ligne(self):
        sw = (self.RACINE / "static" / "sw.js").read_text(encoding="utf-8")
        for adresse in ("'/menu/'", "'/menu/parametres/'", "'/hors-ligne.html'"):
            self.assertIn(adresse, sw)
        self.assertNotIn("/ressources/", sw)

    def test_raccourcis_du_manifeste(self):
        import json
        manifeste = json.loads((self.RACINE / "static" / "manifest.json").read_text(encoding="utf-8"))
        adresses = [r["url"] for r in manifeste.get("shortcuts", [])]
        self.assertEqual(adresses, ["/?recherche", "/?favoris", "/?flux=personnaliser", "/menu/"])
        for r in manifeste["shortcuts"]:
            self.assertTrue(r["name"] and r["icons"][0]["src"].startswith("/"))


class NginxAligne(unittest.TestCase):
    """deploy/kioske-nginx.conf (utilisé par « kioske.sh --certificat-ok nginx ») et deploy/deployer_nginx.sh
    servent les mêmes adresses : les blocs location du HTTPS sont identiques (le domaine mis à part)."""

    RACINE = Path(__file__).resolve().parent.parent
    MARQUE = "    # Le site est statique : seules les adresses"

    def test_memes_emplacements(self):
        sh = (self.RACINE / "deploy" / "deployer_nginx.sh").read_text(encoding="utf-8")
        bloc = sh.split("EMPLACEMENTS=\"$(cat <<'NGINX'\n", 1)[1].split("\nNGINX\n", 1)[0]
        attendu = bloc[bloc.index(self.MARQUE):].replace("__DOMAINE__", "kioske.fr").rstrip()
        conf = (self.RACINE / "deploy" / "kioske-nginx.conf").read_text(encoding="utf-8")
        https = conf[conf.index(self.MARQUE):]
        self.assertTrue(https.startswith(attendu), "blocs location différents entre les deux fichiers")

    def test_page_404_perso(self):
        conf = (self.RACINE / "deploy" / "kioske-nginx.conf").read_text(encoding="utf-8")
        self.assertIn("error_page 404 /404.html;", conf)
        self.assertIn("return 301 /menu/dispositions-legales/;", conf)
        self.assertIn("img/previews", conf)


class CartesDePartage(unittest.TestCase):
    """Cartes de partage (kioske/previews.py) : police du site, lettre de repli, version dans le nom, cartes
    d'une version précédente refaites par lots."""

    def setUp(self):
        import tempfile
        import kioske.previews as previews
        self.p = previews
        self.tmp = tempfile.TemporaryDirectory()
        self.build_origine = previews.BUILD
        previews.BUILD = Path(self.tmp.name)
        (previews.BUILD / previews.DOSSIER_PREVIEWS).mkdir(parents=True)

    def tearDown(self):
        self.p.BUILD = self.build_origine
        self.tmp.cleanup()

    def test_police_du_site(self):
        from PIL import ImageFont
        self.assertIsInstance(self.p.FONT_TITLE, ImageFont.FreeTypeFont)
        self.assertEqual(self.p.FONT_TITLE.getname()[0], "Inter Variable")
        self.assertTrue(self.p.POLICE_SITE.is_relative_to(Path(__file__).resolve().parent.parent / "static"))

    def test_lettre_de_repli(self):
        self.assertEqual(self.p.lettre_repli("19/11/2026 · The Pink Times", "Tim Asato"), "T")
        self.assertEqual(self.p.lettre_repli("19/11/2026 · « Basta! »", "x"), "B")
        self.assertEqual(self.p.lettre_repli("19/11/2026 · ", "élan"), "É")
        self.assertNotEqual(self.p.lettre_repli("01/01/2026 · Les Jours", ""), "H")   # plus le « h » de https

    def test_version_dans_le_nom(self):
        self.assertTrue(self.p.nom_preview("https://a.org/x").endswith(f"-v{self.p.VERSION_PREVIEW}.png"))

    def test_anciennes_cartes_refaites_par_lots(self):
        from datetime import datetime, timezone
        dossier = self.p.BUILD / self.p.DOSSIER_PREVIEWS
        articles = [{"link": f"https://a.org/{i}", "title": f"Titre {i}", "source": "Source",
                     "date": datetime(2026, 11, 10 + i, tzinfo=timezone.utc)} for i in range(3)]
        for a in articles:   # cartes de l'ancienne version (sans suffixe)
            (dossier / f"{self.p.chemin_preview(a['link'])}.png").write_bytes(b"ancienne")
        resultat = self.p.generer_previews(articles, {}, telecharger=True, refaites_max=1)
        recent = articles[2]["link"]   # la plus récente est refaite d'abord
        self.assertEqual(resultat[recent], f"{self.p.DOSSIER_PREVIEWS}/{self.p.nom_preview(recent)}")
        self.assertFalse((dossier / f"{self.p.chemin_preview(recent)}.png").exists(), "ancienne carte retirée")
        for a in articles[:2]:   # au-delà de la limite : l'ancienne carte reste servie
            self.assertEqual(resultat[a["link"]], f"{self.p.DOSSIER_PREVIEWS}/{self.p.chemin_preview(a['link'])}.png")
        nouveau = {"link": "https://a.org/neuf", "title": "Neuf", "source": "S", "date": None}
        resultat = self.p.generer_previews([nouveau], {}, telecharger=True, refaites_max=0)
        self.assertIn("-v", resultat["https://a.org/neuf"], "une carte neuve n'est pas limitée")

    def test_build_simple_ne_refait_rien(self):
        from datetime import datetime, timezone
        dossier = self.p.BUILD / self.p.DOSSIER_PREVIEWS
        a = {"link": "https://a.org/s", "title": "T", "source": "S", "date": datetime(2026, 11, 1, tzinfo=timezone.utc)}
        (dossier / f"{self.p.chemin_preview(a['link'])}.png").write_bytes(b"ancienne")
        resultat = self.p.generer_previews([a], {}, telecharger=True, refaites_max=0)
        self.assertTrue(resultat[a["link"]].endswith(f"{self.p.chemin_preview(a['link'])}.png"))
        self.assertFalse((dossier / self.p.nom_preview(a["link"])).exists())

    def test_duree_bornee(self):
        from datetime import datetime, timezone
        dossier = self.p.BUILD / self.p.DOSSIER_PREVIEWS
        a = {"link": "https://a.org/d", "title": "T", "source": "S", "date": datetime(2026, 11, 1, tzinfo=timezone.utc)}
        (dossier / f"{self.p.chemin_preview(a['link'])}.png").write_bytes(b"ancienne")
        self.p.generer_previews([a], {}, telecharger=True, duree_max=0)
        self.assertFalse((dossier / self.p.nom_preview(a["link"])).exists())

    def test_build_simple_passe_la_consigne(self):
        source = (Path(__file__).resolve().parent.parent / "kioske" / "construction.py").read_text(encoding="utf-8")
        self.assertIn("ecrire_pages_articles(items, previews, simple=args.simple)", source)
        self.assertIn("refaites_max=0 if simple else REFAITES_PAR_BUILD", source)

    def test_carte_prend_l_image_de_l_apercu(self):
        source = (Path(__file__).resolve().parent.parent / "kioske" / "construction.py").read_text(encoding="utf-8")
        self.assertIn('previews.get(item["link"], {}).get("image") or item.get("image")', source)


class PlusLus(unittest.TestCase):
    """Galerie « Les plus lus » : comptage dans le journal d'accès de nginx (kioske/plus_lus.py)."""

    def setUp(self):
        import tempfile
        self.tmp = tempfile.TemporaryDirectory()
        self.journal = Path(self.tmp.name) / "kioske.fr.access.log"

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def ligne(ip, quand, chemin, code=200, agent="Mozilla/5.0 (X11)"):
        return f'{ip} - - [{quand} +0100] "GET {chemin} HTTP/2.0" {code} 10 "-" "{agent}"\n'

    def test_comptage(self):
        import gzip
        from datetime import datetime, timezone
        from kioske.plus_lus import compter
        A, B = "/articles/aaaaaaaaaaaa-un-titre-11111111/", "/articles/bbbbbbbbbbbb-autre-22222222/"
        C = "?carte=1"   # marqueur d'une carte ouverte (kioske/js/carte_ouverte.js)
        self.journal.write_text(
            self.ligne("1.1.1.1", "18/Nov/2026:10:00:00", A + C)
            + self.ligne("1.1.1.1", "18/Nov/2026:11:00:00", A + C)                  # même visiteur : une fois
            + self.ligne("2.2.2.2", "18/Nov/2026:10:00:00", A + C, code=304)        # carte déjà en cache
            + self.ligne("3.3.3.3", "18/Nov/2026:10:00:00", A + "index.html" + C)
            + self.ligne("8.8.8.8", "18/Nov/2026:10:00:00", A)                      # page sans carte : ne compte pas
            + self.ligne("9.9.9.9", "18/Nov/2026:10:00:00", A + "?from=%2F")        # idem
            + self.ligne("4.4.4.4", "18/Nov/2026:10:00:00", A + C, agent="GPTBot/1.0")   # robot
            + self.ligne("5.5.5.5", "18/Nov/2026:10:00:00", A + C, code=404)        # page absente
            + self.ligne("127.0.0.1", "18/Nov/2026:10:00:00", A + C)                # serveur (ip_jamais_bannies)
            + self.ligne("6.6.6.6", "01/Nov/2026:10:00:00", B + C)                  # trop ancien
            + "ligne illisible\n", encoding="utf-8")
        with gzip.open(str(self.journal) + ".2.gz", "wt", encoding="utf-8") as f:   # archive tournée
            f.write(self.ligne("7.7.7.7", "17/Nov/2026:10:00:00", B + C))
        compte = compter(self.journal, 7, "127.0.0.1/8 ::1", maintenant=datetime(2026, 11, 19, tzinfo=timezone.utc))
        self.assertEqual(compte, {"aaaaaaaaaaaa": 3, "bbbbbbbbbbbb": 1})

    def test_sans_journal(self):
        from kioske.plus_lus import compter
        self.assertEqual(compter(Path(self.tmp.name) / "absent.log", 7), {})

    def test_classement(self):
        from datetime import datetime, timezone
        from kioske.plus_lus import plus_lus
        from kioske.texte import article_id
        items = [{"link": f"https://a.org/{i}", "date": datetime(2026, 11, i + 1, tzinfo=timezone.utc)} for i in range(4)]
        ids = [article_id(i["link"]) for i in items]
        compte = {ids[0]: 5, ids[1]: 9, ids[2]: 5, "inconnu00000": 50}   # « inconnu » : plus affiché par le site
        classement = plus_lus(items, compte, 2, article_id)
        self.assertEqual([(i["link"], n) for i, n in classement], [("https://a.org/1", 9), ("https://a.org/2", 5)])

    def test_galerie(self):
        from datetime import datetime, timezone
        from kioske.rendu import render_galerie_plus_lus
        item = {"link": "https://a.org/x", "title": "Un <titre>", "image": "", "source": "S",
                "date": datetime(2026, 11, 1, tzinfo=timezone.utc)}
        html = render_galerie_plus_lus([(item, 3)], {}, 7)
        self.assertIn('class="galerie-plus-lus"', html)
        self.assertIn(">Les + vus de la semaine</h2>", html)
        self.assertIn('aria-label="Les plus vus de la semaine"', html)
        self.assertIn("Un &lt;titre&gt;", html)
        self.assertIn("galerie-carte-sans-image", html)
        self.assertEqual(render_galerie_plus_lus([], {}, 7), "")

    def test_date_sans_dependre_de_la_langue(self):
        import locale
        from datetime import datetime, timedelta, timezone
        from kioske.plus_lus import lire_date
        attendu = datetime(2026, 11, 19, 10, 0, 0, tzinfo=timezone(timedelta(hours=1)))
        ancienne = locale.setlocale(locale.LC_TIME)
        try:
            try:
                locale.setlocale(locale.LC_TIME, "fr_FR.UTF-8")   # comme un serveur en français, si disponible
            except locale.Error:
                pass
            self.assertEqual(lire_date("19/Nov/2026:10:00:00 +0100"), attendu)
        finally:
            locale.setlocale(locale.LC_TIME, ancienne)
        self.assertIsNone(lire_date("19/nov./2026:10:00:00 +0100"))

    def test_titre_de_la_grande_galerie(self):
        from datetime import datetime, timezone
        from kioske.rendu import render_galerie
        item = {"link": "https://a.org/y", "title": "T", "image": "https://a.org/i.jpg", "source": "S",
                "date": datetime(2026, 11, 1, tzinfo=timezone.utc)}
        html = render_galerie([item], {})
        self.assertIn('<h2 class="galerie-titre">Les derniers articles</h2>', html)
        self.assertLess(html.index('class="galerie-derniers"'), html.index("galerie-titre"))   # masqué avec elle



class GaleriesParDefaut(unittest.TestCase):
    """Galeries affichées par défaut : lues dans kioske.cfg et écrites dans les données de la page."""

    def test_valeurs_dans_la_page(self):
        import json
        from kioske.config import GALERIES_DEFAUT
        from kioske.themes import SCRIPT_THEME
        donnees = json.loads(SCRIPT_THEME.split('id="kioske-themes">', 1)[1].split("</script>", 1)[0].replace("<\\/", "</"))
        self.assertEqual(donnees["galeries"], GALERIES_DEFAUT)
        self.assertEqual(set(GALERIES_DEFAUT), {"plus_lus", "grande", "blocs"})

    def test_chemin_du_journal(self):
        from kioske.config import JOURNAL_PAR_DEFAUT, journal_acces
        self.assertEqual(journal_acces(""), JOURNAL_PAR_DEFAUT)
        self.assertEqual(journal_acces("1"), JOURNAL_PAR_DEFAUT)          # pris pour un interrupteur : ignoré
        self.assertEqual(journal_acces("/tmp/a.log"), Path("/tmp/a.log"))



class ImagesDeLIndex(unittest.TestCase):
    """articles-index.json : une image externe reste telle quelle (avant : « /https://… », demandé au site, 404 et ban)."""

    def test_image_index(self):
        from kioske.construction import image_index
        self.assertEqual(image_index("https://a.org/i.jpg"), "https://a.org/i.jpg")
        self.assertEqual(image_index("http://a.org/i.jpg"), "http://a.org/i.jpg")
        self.assertEqual(image_index("img/veille/a.jpg"), "/img/veille/a.jpg")
        self.assertEqual(image_index("/img/veille/a.jpg"), "/img/veille/a.jpg")
        self.assertEqual(image_index(""), "")

    def test_index_construit_sans_slash_devant_https(self):
        index = (Path(__file__).resolve().parent.parent / "build" / "articles-index.json")
        if index.exists():
            self.assertNotIn('"/http', index.read_text(encoding="utf-8"))


class EtoilesAuDessus(unittest.TestCase):
    """Les étoiles du ♡ passent au-dessus de la carte ouverte (z-index 10000) : sinon elles sont cachées."""

    def test_z_index(self):
        import re
        racine = Path(__file__).resolve().parent.parent
        carte = re.search(r"\.carte-ouverte \{[^}]*z-index: (\d+)", (racine / "kioske" / "style_default.css").read_text(encoding="utf-8"))
        etoiles = re.search(r"\.etoiles \{[^}]*z-index: (\d+)", (racine / "kioske" / "style_favoris.css").read_text(encoding="utf-8"))
        self.assertIsNotNone(carte)
        self.assertIsNotNone(etoiles)
        self.assertGreater(int(etoiles.group(1)), int(carte.group(1)))


class EspacesDuMarkdown(unittest.TestCase):
    """Documents du Menu : lignes vides, espaces et retraits conservés ; listes et blocs de code inchangés."""

    def test_lignes_vides_en_trop(self):
        from kioske.menu import _html_du_markdown
        html = _html_du_markdown("Un\n\n\n\nDeux")
        self.assertEqual(html.count('class="menu-espace"'), 2)   # 3 lignes vides : séparation + 2 espaces
        self.assertIn("<p>Un</p>", html)
        self.assertIn("<p>Deux</p>", html)

    def test_espaces_et_retrait_gardes(self):
        from kioske.menu import _html_du_markdown
        html = _html_du_markdown("Premier   mot\n    indenté")
        self.assertIn("Premier   mot", html)
        self.assertIn("    indenté", html)
        self.assertNotIn("<br />\n", html)

    def test_listes_et_code_inchanges(self):
        from kioske.menu import _html_du_markdown
        html = _html_du_markdown("- a\n  - sous\n\n```\nx\n\n\ny\n```\n")
        self.assertIn("<li>sous</li>", html)
        self.assertIn("x\n\n\ny", html)        # le bloc de code garde ses lignes vides telles quelles
        self.assertNotIn("menu-espace", html)


class FonctionsDuMarkdown(unittest.TestCase):
    """Chaque fonction du Markdown des documents du Menu, rendue dans le pipeline réel (_ameliorer compris)."""

    EXEMPLE = """# Titre

Texte avec **gras**, *italique*, `code` et [un lien](https://ex.org) et [interne](/menu/).
Deux lignes du même paragraphe.

- niveau un
  - niveau deux
    - niveau trois
- retour

1. premier
2. second

> une citation

| colonne a | colonne b |
|---|---|
| 1 | 2 |

```python
print(1)
```

![Une photo](photo.png)

Note[^1].

[^1]: la note.
"""

    def rendu(self):
        from kioske.menu import _ameliorer, _html_du_markdown
        return _ameliorer(_html_du_markdown(self.EXEMPLE), "/menu/")

    def test_titres_gras_italique_code(self):
        html = self.rendu()
        self.assertIn('<h1 id="titre">Titre</h1>', html)
        self.assertIn("<strong>gras</strong>", html)
        self.assertIn("<em>italique</em>", html)
        self.assertIn("<code>code</code>", html)

    def test_liens_externes_et_internes(self):
        html = self.rendu()
        self.assertIn('href="https://ex.org"', html)
        self.assertIn('target="_blank"', html)
        self.assertIn('href="/menu/"', html)

    def test_listes_et_sous_listes(self):
        html = self.rendu()
        self.assertEqual(html.count("<ul>"), 3)            # liste, sous-liste, sous-sous-liste
        self.assertIn("<ol>", html)
        self.assertIn("<li>niveau trois</li>", html)

    def test_citation_tableau_code(self):
        html = self.rendu()
        self.assertIn("<blockquote>", html)
        self.assertIn("<table>", html)
        self.assertIn('<code class="language-python">', html)

    def test_image_centree_avec_legende(self):
        html = self.rendu()
        self.assertIn('<figure class="menu-image">', html)
        self.assertIn("<figcaption>Une photo</figcaption>", html)
        self.assertIn('loading="lazy"', html)            # chargement différé de l'image

    def test_note_de_bas_de_page(self):
        html = self.rendu()
        self.assertIn('class="footnote"', html)

    def test_retour_a_la_ligne_et_ancres(self):
        html = self.rendu()
        self.assertIn("Deux lignes du même paragraphe.", html)
        self.assertIn("<br />", html)                    # nl2br : un saut de ligne reste un saut

    def test_ordre_des_galeries_de_l_accueil(self):
        source = (Path(__file__).resolve().parent.parent / "kioske" / "rendu.py").read_text(encoding="utf-8")
        self.assertIn("galerie_html = render_galerie(items, previews) + render_galerie_plus_lus(", source)

