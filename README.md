# kioske.fr

Le **KiosKe** : une veille automatique des médias indépendants, des luttes et des voix LGBTQIA+.
Pages HTML statiques (HTML5, CSS, JavaScript sans dépendance) générées toutes les 30 minutes sur le serveur
à partir de flux RSS et de chaînes Twitch. Une page d'accueil + une page par catégorie + une page par article
(plus de mille pages). Les images sont hébergées par le site : les pages ne chargent rien d'un autre site,
sans publicité ni pistage. Le JavaScript sert à la navigation (panneaux, cartes, recherche, favoris) ; sans
lui, les pages statiques d'articles et de catégories restent lisibles par leurs liens.

**Langue** : le site et le projet sont en français — pages (`lang="fr"`), flux RSS, code, commentaires
et documentation.

**Mots-clés** : kioske, veille, médias indépendants, LGBTQIA+, RSS, Twitch, informatique libre.

En haut de la page, le **bloc immuable** (cagnotte, lien Discord, code de conduite) n'est jamais
modifié par le build.

> Projet autonome depuis le 2026-11-11 (copie de `gauchiasses.fr`), réorganisé le même jour : code
> dans le paquet `kioske/`, site généré dans `build/`, réglages dans `kioske.cfg`.
> **À vérifier :** l'`origin` du dépôt git pointe encore vers `kit-gauchiasses.fr`.
>
> **Modifications récentes** :
> - **Squelettes des pages dans `kioske/gabarits/`** (2026-11-14) : le HTML complet des quatre types de page est sorti du code Python, dans `accueil.html` (barre du haut comprise), `article.html`, `categorie.html` et `rss.html`. Ce sont des fichiers HTML ordinaires où `${nom}` marque l'endroit d'une valeur (`string.Template`, bibliothèque standard, aucune dépendance) ; `kioske/gabarits.py` les lit et les remplit (`remplir()`). Les morceaux répétés ou conditionnels (cartes, étiquettes, galeries, boutons, balises d'image de partage) restent fabriqués en Python. Vérifié sur les 1311 pages du build local : l'accueil et `rss.html` sont identiques à l'octet près, les pages d'article et de catégorie aussi, à un saut de ligne final près (elles se terminent maintenant par un saut de ligne).
> - **Tout le JavaScript dans `kioske/js/`** (2026-11-14) : plus aucun script écrit dans le code Python. Les scripts des pages sont des fichiers de `kioske/js/` (`accueil.js`, `galerie.js`, `carte_ouverte.js`, `retour_app.js`, `installation_pwa.js`, `donnees_accueil.js`, `service_worker.js`, `page_article.js`, `page_categorie.js`, `page_rss.js`) ; `kioske/javascript.py` les lit et `rendu.py` / `rendu_statique.py` insèrent leur contenu dans les pages, comme pour `style.css`. Les pages construites sont les mêmes qu'avant, à trois détails près : les données de l'accueil (articles par source et par catégorie, code de conduite) sont écrites en JSON dans `<script type="application/json" id="kioske-donnees">` et lues par `donnees_accueil.js` ; les `onclick` écrits par Python (♡ et 📤 de la carte, ♡ de la barre, « Mes favoris », « Charger des favoris ») sont remplacés par des écouteurs dans les fichiers JS ; le service worker est enregistré partout par `/sw.js`. Reste un `onclick` dans `accueil/bloc_immuable.html` (bloc protégé, non modifié). `static/app.js`, `static/theme.js` et `static/sw.js` ne bougent pas : ils sont servis comme fichiers à part. Testé dans jsdom (accueil, page d'article, page de catégorie, page RSS).
> - **Tailles réglées dans `kioske.cfg` seulement** (2026-11-14) : les curseurs « Taille du site » et « Hauteur carte », leur script (accueil et `static/app.js`) et leur style sont supprimés. `taille_defaut` et `hauteur_carte_ouverte` restent dans `kioske.cfg` (bornés à 75-125 %) et sont écrits au build dans l'attribut `style` de `<html>` (`zoom` et `--hauteur-carte-ouverte`) : plus de script pour le zoom, et les valeurs autrefois enregistrées dans le navigateur des visiteurs (`kioske-taille`, `kioske-hauteur-carte`) ne sont plus lues. Cache du service worker : v21.
> - **Menu ≡ : boutons de thème remis à leur place** (2026-11-14) : ils remontaient par-dessus le titre « Thèmes » et débordaient du menu (marge haute négative de la règle générale `.choix-theme`). Dans le menu, ils sont maintenant en colonne sous le titre (`.theme-options .choix-theme` dans `kioske/style.css`). Non vérifié à l'écran.
> - **Galerie dans chaque bloc de catégorie de l'accueil** (2026-11-14) : sous le titre de chaque bloc, avant les étiquettes, une rangée de petites vignettes (5,5 × 4 rem ; 4,6 × 3,4 rem sous 600 px) des 12 derniers articles de la catégorie ayant une image (`NB_GALERIE_BLOC` et `render_galerie_bloc()` dans `kioske/rendu.py`). Écrite dans le HTML au build, avec les flèches < et > de la grande galerie (même balisage, même script `brancherGalerie()`) ; elle défile aussi au doigt ou à la barre de défilement. Style du bloc conservé : bordure fine de la couleur du thème, coins des étiquettes, pas d'agrandissement au survol (classe `.galerie-bloc` dans `kioske/style.css`). Pas de galerie si la catégorie n'a aucune image. Testé dans jsdom ; le rendu visuel n'a pas pu être vérifié.
> - **Galerie par catégorie** (2026-11-14) : le panneau d'une catégorie (bouton « + » de l'accueil) affiche, au-dessus de ses cartes, une galerie horizontale des 12 derniers articles de la catégorie ayant une image (`NB_GALERIE_CATEGORIE` dans `kioske/js/accueil.js`). Elle est plus petite que la galerie de l'accueil (130 × 95 px, 100 × 74 px sous 600 px de large ; classe `.galerie-panneau` dans `kioske/style.css`), défile avec la grille et n'apparaît pas si aucun article de la catégorie n'a d'image. Un clic ouvre la carte de l'article, comme partout. Le script des flèches est devenu une fonction, `brancherGalerie()`, commune aux deux galeries. Testé dans jsdom ; le rendu visuel (tailles, marges) n'a pas pu être vérifié.
> - **× qui remontait trop loin** (2026-11-14) : le bouton × des panneaux de source, de catégorie et du code de conduite avait deux écouteurs de clic, donc deux `history.back()` : on remontait une entrée de trop (panneau d'avant sauté, ou sortie du site). Écouteurs en double retirés ; `closePopover()` et `fermerCarte()` masquent maintenant le panneau ou la carte avant `history.back()`, si bien qu'un double appui ne remonte qu'une entrée. Testé dans jsdom, pas sur un téléphone.
> - **`from` retiré du bouton précédent** (2026-11-14) : dans l'app installée, le retour du téléphone sur une page d'article ouverte en premier ramène à l'accueil, sans lire le paramètre `from`. Le bouton précédent (navigateur, téléphone) suit donc toujours l'historique ; `from` ne sert plus qu'au bouton « ← Retour » des pages d'article et à Précédent/Suivant, qui le transmettent.
> - **nginx : en-tête `Content-Language: fr`** (2026-11-14, à déployer) : envoyé sur les pages HTML seulement, par une table `map $sent_http_content_type $kioske_langue` et un `add_header` au niveau `server` (aucun dans les blocs `location`). Ajouté dans `deploy/kioske-nginx.conf`, `deploy/deployer_nginx.sh` et `deploy/kioske.nginx.conf`. Non testé avec nginx sur le PC.
> - **Thème en JavaScript, pluie hors du HTML, langue déclarée** (2026-11-14) : les navigateurs prenaient le site pour du japonais, à cause des caractères de la pluie matricielle écrits dans chaque page. La pluie est maintenant fabriquée par `static/theme.js` ; ses signes sont dans un attribut (`data-g`) et affichés par CSS (`::before`) : la page ne contient plus aucun texte japonais. Le même script applique le thème choisi par le visiteur, gardé dans `localStorage` (clé `kioske-theme`) et valable sur toutes les pages ; les boutons radio et les règles `:has()` sont remplacés par des boutons (`.theme-bouton`). `kioske/themes.py` est réduit : plus de CSS généré ni de marqueurs `__FOND__`/`__PANNEAU__` dans `style.css`, `kioske/pluie.css` fusionné dans `style.css` et supprimé, thèmes lus une seule fois au lieu d'une fois par page. Langue : `<meta http-equiv="content-language" content="fr">` sur toutes les pages, `"lang": "fr"` dans `manifest.json`. Erreur de syntaxe corrigée dans le script de la page des flux. Cache service worker v20 (il liste `theme.js` et `app.js` à la place de `style.css` et `pluie.css`, qui n'existent pas dans `build/`).
> - **Code mort retiré** (2026-11-14) : réglage `slogan` (lu, mais plus utilisé nulle part) supprimé de `kioske.cfg` et de `kioske/config.py` ; dans le script de l'accueil, restes des anciens panneaux d'article (`article-container`, `closeArticleAndShowSource`, mémoire de défilement jamais alimentée) et leurs règles `.article-panneau` dans `kioske/style.css`. La page des flux n'a plus de script de panneau.
> - **Tout le CSS dans `kioske/style.css`, Python nettoyé** (2026-11-14) : les blocs `<style>` et les constantes CSS de `rendu.py` et `rendu_statique.py` (`CSS_CARTE_OUVERTE`, `CSS_CARTE_SUPERPOSEE`, `CSS_PAGE_ARTICLE`, styles du code de conduite, de la page des flux et des pages de catégorie), les attributs `style="…"` et les styles posés par le script des panneaux (`element.style.…`) sont devenus des règles et des classes à la fin de `style.css` (`.panneau-entete`, `.panneau-titre`, `.fermer-entete`, `.panneau-defilant`, `.pagination`, `.pagination-info`, `.panneau-actions`, `.panneau-bouton`, `.grille-vide`, `.tag-categorie`, `.recherche-form`, `.recherche-bouton`). Les règles propres à une page sont limitées par `:where(.panel-category)` et `:where(.page-article)` (classe ajoutée au `<body>` des pages d'article). Restent hors du fichier : les valeurs venues de `kioske.cfg` (variables sur `<html>`), le zoom réglé par le visiteur, les gouttes de pluie (positions tirées au hasard) et le bloc immuable. Python : imports et variables inutilisés retirés, fonction morte `render_card` supprimée, `render_galerie` renvoie seulement son HTML.
> - **Plus de vide autour des cartes sur ordinateur** (2026-11-14) : une carte occupait 75 % de sa colonne, centrée. Elle la remplit maintenant, et la grille gagne une colonne pour garder des cartes de taille voisine : 5 colonnes au-delà de 960 px (au lieu de 4), 4 entre 641 et 960 px (au lieu de 3). Téléphone inchangé (`.grille`, `.carte` dans `kioske/style.css`).
> - **Marges horizontales des panneaux réduites et réglables** (2026-11-14) : nouveau réglage `espacement_panneau_horizontal` dans `kioske.cfg` (`[site]`, défaut `0.5rem`, au lieu de 2rem sur ordinateur et 0,6 à 1rem sur téléphone). Il vaut pour tous les panneaux (source, catégorie, recherche, favoris, code de conduite) et toutes les tailles d'écran.
> - **Cartes superposées dans les favoris et la recherche** (2026-11-14) : dans ces deux panneaux, la grille est directement dans le panneau et défile ; ses lignes se tassaient sous la hauteur des cartes, qui se chevauchaient. Corrigé par `grid-auto-rows: max-content` sur `.categorie-panneau > .grille` (`kioske/style.css`). Non vérifié à l'écran.
> - **Bouton précédent du téléphone** (2026-11-14) : sur l'accueil, ouvrir un panneau (source, catégorie, recherche, favoris, code de conduite) ajoute une entrée d'historique ; le bouton précédent referme le panneau et ramène au panneau d'avant, ou à l'accueil, au lieu de quitter le site. ×, Échap et le clic sur le fond remontent la même entrée. Dans l'app installée (PWA), le bouton précédent ne ferme plus l'app : sur l'accueil on y reste, sur une page d'article ou de catégorie ouverte en premier on remonte à la page parente (`JS_RETOUR_APP` dans `kioske/rendu_statique.py`). Testé dans jsdom, pas sur un téléphone.
> - **Panneaux en plein écran** (2026-11-13) : les panneaux de source, de catégorie, de recherche, des favoris et du code de conduite remplissent l'écran et passent au-dessus de la barre du haut (`.categorie-container`, `.categorie-panneau` dans `kioske/style.css`). La carte d'article ouverte garde son format « carte à jouer ».
> - **Menu et page des flux vérifiés et corrigés** (2026-11-13) : les entrées Flux RSS, Discord et Mastodon du menu ≡ sont de vrais liens (`<a>`) et non plus des boutons avec `onclick` ; les liens externes s'ouvrent avec `rel="noopener noreferrer"`. Le bouton ≡ porte `aria-expanded`. `rss.html` ne liste plus que les catégories dont le flux est réellement écrit (le lien « Des Liens » menait à une page introuvable) et a un lien « ← Accueil ». Favoris et résultats de recherche : les cartes défilent dans le panneau.
> - **nginx : en-têtes de sécurité et politique de contenu corrigés** (2026-11-13, à déployer) : les blocs `location` contenaient un `add_header Cache-Control`, ce qui annulait tous les en-têtes du niveau `server` (HSTS, CSP, `nosniff`…) sur les pages. La durée de cache passe par une table `map` et un seul `add_header` au niveau `server` ; plus aucun `add_header` dans un `location`. La CSP autorise maintenant ce dont le site a besoin : `script-src 'self' 'unsafe-inline'`, `connect-src 'self'`, `manifest-src 'self'`, `worker-src 'self'`. `app.js` n'est plus mis en cache un an. Sauvegarde des anciens fichiers : `old/nginx-avant-csp-2026-11-13/`.
> - **Carte d'article ouverte en JavaScript sur l'accueil et sur les pages de catégorie** (2026-11-13) : un clic sur une carte (panneau de source ou de catégorie, galerie, recherche, favoris, page de catégorie) charge la page statique de l'article et affiche sa carte « à jouer » par-dessus la page, sans la quitter. Le style et le script de la carte sont des constantes partagées (`CSS_CARTE_OUVERTE`, `CSS_CARTE_SUPERPOSEE`, `JS_CARTE_OUVERTE` dans `kioske/rendu_statique.py`) : même rendu que la page statique. L'adresse devient celle de la page statique (partage, rechargement) ; fermer la carte (« ← Retour », Échap, clic sur le fond, bouton précédent du navigateur) ramène au panneau ou à la page de catégorie d'où l'on vient. Précédent/Suivant changent d'article dans la même carte. Ctrl+clic, clic molette et navigation sans JavaScript ouvrent la page statique, toujours générée (référencement). Favoris : même format sur l'accueil et sur les pages (`static/app.js`), un favori ouvre la carte du KiosKe et non plus le site d'origine. Les anciens favoris, enregistrés avec le seul lien du site d'origine, sont complétés à l'ouverture du panneau « Mes favoris » à partir de `articles-index.json` (page du KiosKe, image, date, résumé) ; un article qui n'est plus dans l'index garde son lien d'origine.
> - **Navigation JS corrigée** (2026-11-13) : le bouton « ← Retour » d'un article rouvre le panneau (source ou catégorie) d'où l'on vient, à la bonne page de pagination. L'adresse de l'accueil garde la trace du panneau ouvert (`/#source=…&p=2`, `/#cat=…&p=1`), les cartes des panneaux transmettent cette adresse dans `?from=`. La recherche lancée depuis une page d'article ou de catégorie (`/?q=…`) s'exécute maintenant sur l'accueil. Le paramètre `from` n'accepte qu'une adresse du site. Panneaux de catégorie triés par vraie date. Script temporaire `popstate` (renvoi vers `https://kioske.fr`) retiré. Service worker : les pages `/articles/…/` et `/categories/…/` passent en réseau d'abord (elles restaient figées dans le cache). Bouton 📤 de partage sur les pages d'article. Cache service worker v19.
> - **Code de conduite en panneau normalisé + boutons de partage** (2026-11-13 nuit) : code de conduite stocké dans `accueil/code-de-conduite.html`, s'ouvre dans un panneau au format standardisé du site (comme les sources et catégories). **Nouveaux boutons en bas du panneau** : 📤 Partager (Web Share API) et 🔗 Copier le lien (clipboard). Menu hamburger ferme automatiquement à l'ouverture. Corrections : ID manquant dans `showPopover()` pour afficher le panneau. Cache service worker v15.
> - **Navbar top sticky** (2026-11-13 nuit) : refonte complète de la navigation. Remplacement du bouton "+" + titre énorme + barre de recherche fragmentée par une **navbar horizontale sticky** en haut. Logo + stats à gauche, barre de recherche au centre, bouton ♡ Favoris + menu hamburger ≡ à droite. Menu déroulant contient : thèmes, taille du site, lien Flux RSS, lien Discord, code de conduite. Cache service worker v14.
> - **Panneaux de catégories + favoris corrigés** (2026-11-13 nuit) : boutons "+" des catégories → panneaux JS avec pagination identiques aux sources. Système de favoris entièrement réécrit : stockage des métadonnées complètes (image, date, host, résumé) et création des cartes favoris depuis les données, pas clonage du DOM. Cache service worker v13.
> - Panneaux de catégories dynamiques : boutons "+" des catégories → panneaux JS avec pagination (30 articles/page) identiques aux sources. Données injectées en JSON `window.categoriesData`. Cache service worker v12.
> - **Liens recherche corrigés** (2026-11-13 nuit) : les slugs de l'index JSON utilisent maintenant les titres des previews (comme les pages statiques). Résout les 404 sur les liens de recherche. Cache service worker v9.
> - **Galerie augmentée** (2026-11-13 nuit) : 10 → 12 articles. Cache service worker v8.
> - **Pages catégories refondues** (2026-11-13 nuit) : articles mélangés et triés par date (sans groupement par source). Tous les articles d'une catégorie dans une seule grille. Cache service worker v7.
> - **Cache PWA v6** (2026-11-13 nuit) : incrémentation du service worker pour forcer mise à jour.
> - **Corrections barre de recherche + cartes mobile** (2026-11-13 nuit) : fetch `/articles-index.json` (chemin absolu), vérification HTTP, alertes utilisateur. Cartes 2 fois plus petites sur mobile (2 par ligne, hauteur image −50%). Cache service worker v5.
> - **Navigation hiérarchique** (2026-11-13 matin) : pages statiques pour articles et catégories. Bouton retour en haut à gauche menant au parent (article → catégorie, catégorie → accueil).
> - **Typographie et interface** (2026-11-13 après-midi) : titres réduits (h1/h2 à 1.1rem), titre des cartes augmenté (1rem), étiquettes redessinées (fond blanc, texte noir, bordure rouge), slider hauteur carte supprimé, barre de recherche globale (accessible depuis chaque page, redirige vers l'accueil), galerie scroll horizontal fixé, cache service worker v4.
> - Menu "+" avec barre de recherche, choix des thèmes, sliders de taille, lien Discord, lien RSS et charte (2026-11-12 matin).
> - Page `rss.html` : découverte des flux RSS par catégories avec icônes aux couleurs du drapeau trans (2026-11-12 soir).
> - Toutes les heures affichées en **heure de Paris** (CET/CEST selon la saison).
> - Layout compacté. Étiquettes tronquées (20 chars max). Navigation Précédent/Suivant en galerie. Zoom PC supprimé.
> - **Barre de recherche refonte** : crée un panneau de résultats indépendant avec les cartes trouvées. Menu "+" se ferme à l'ouverture (2026-11-12 après-midi).
> - **Navigation : fermeture nette** — quand on ferme un article, retour à l'index (pas au panneau de la source).
> - **Galerie — clic seulement** : suppression du hover sur cartes, clic seul pour ouvrir (2026-11-12 soir).
> - **Preview nettoyé** : SVG et PNG de partage social régénérés, sans trace d'ancienne version (2026-11-12 soir).
> - **Système de favoris** : cœur cliquable dans barre de navigation (Précédent/Suivant), violet quand favorisé, localStorage, export/import JSON, panneau "Mes favoris" dans menu "+" (2026-11-12 soir).
> - **PWA compatible** (2026-11-12 soir) : installable sur téléphone et ordinateur, caching des assets statiques, service worker pour fonctionnement hors ligne.
> - **Zoom initial corrigé** (2026-11-12 après-midi) : la taille par défaut (`taille_defaut`) est maintenant appliquée au chargement de la page, sans intervention utilisateur.

<p align="center"><img src="docs/img/kioske-accueil.png" width="640" alt="Page d'accueil : choix du thème, titre, et étiquettes des sources rangées par catégorie"></p>

Cliquer sur une étiquette ouvre le panneau de la source, avec une carte par article. Cliquer sur une
carte ouvre l'article par-dessus la page, au format « carte à jouer » (texte du flux, lien vers l'original).

<p align="center"><img src="docs/img/kioske-cartes.png" width="640" alt="Fenêtre d'une source : une carte par article, avec image, date, titre et extrait"></p>

## Sommaire

1. [Structure](#structure)
2. [Réglages : `kioske.cfg`](#réglages--kioskecfg)
3. [Construire et publier](#construire-et-publier)
4. [Sources de la veille](#sources-de-la-veille)
5. [Bloc immuable](#bloc-immuable)
6. [La page](#la-page)
7. [Données, caches et images](#données-caches-et-images)
8. [Déploiement sur le serveur](#déploiement-sur-le-serveur)
9. [Référencement](#référencement)
10. [PWA (Progressive Web App)](#pwa-progressive-web-app)
11. [Limites](#limites)
12. [Licences](#licences)

## Structure

| Fichier / dossier | Rôle |
| --- | --- |
| `kioske.cfg` | **Tous les réglages** : domaine, thèmes, veille, serveur. Lu par Python et par les scripts bash. |
| `sources/` | Ce que la veille suit : `RSS_feeds.txt`, `Twitch_feeds.txt`, `flux_corrige_main.txt`. Écrits à la main. |
| `accueil/bloc_immuable.html` | Source du bloc immuable. |
| `static/` | Fichiers publiés tels quels : `favicon.svg`, `apple-touch-icon.png`, `preview.png`, `fonts/`, `app.js` (favoris et réglages des pages d'article et de catégorie), `theme.js` (thème choisi par le visiteur et pluie matricielle, sur toutes les pages), `sw.js` et `manifest.json` (PWA), icônes `icon-*.png`. |
| `kioske/` | Le code (paquet Python), la feuille de style `style.css`, les squelettes HTML des pages (`gabarits/`) et leur JavaScript (`js/`). Voir ci-dessous. |
| `bin/` | Points d'entrée : `build_site.py`, `publier_public.py`, `garde_immuable.py`. Quelques lignes chacun. |
| `deploy/` | Scripts du serveur : `kioske.sh` (point d'entrée), `installer_serveur.sh`, `deployer_nginx.sh`, `verifier_serveur.sh`, `lib_config.sh`, `systemd/`, `fail2ban/`. |
| `data/` | `immuable.json` (empreinte du bloc, suivie par git) ; `historique.db`, `cache/`, `build.lock` (locaux, jamais publiés). |
| `build/` | **Le site généré**, complet : `index.html` (accueil), `rss.html` (découverte des flux RSS), `articles/{id}-{slug}/index.html` (une page par article), `categories/{slug}/index.html` (une page par catégorie), `articles-index.json` (index de tous les articles : recherche et favoris), `rss.xml`, `rss/{slug}.xml` (flux par catégories), `img/veille/`, copie de `static/`, `robots.txt`, `sitemap.xml`. Hors git, jamais édité à la main, jamais envoyé au serveur. |
| `requirements.txt` | Dépendances Python (`feedparser`, `yt-dlp`, `legacy-cgi`). |
| `apercu/preview.svg` | Source de `static/preview.png` (image de partage social) : générer avec `rsvg-convert -w 1200 -h 630 apercu/preview.svg -o static/preview.png`. |
| `docs/img/` | Captures de ce README. |
| `old/` | Sauvegardes et reliquats (hors git, non synchronisés). `old/reliquats-2026-11-11/` : anciens scripts FTP et systemd ; `old/avant-reorganisation-2026-11-11.tar.gz` : le projet avant la réorganisation. |

Le paquet `kioske/` :

| Module | Rôle |
| --- | --- |
| `config.py` | Chemins du projet et valeurs de `kioske.cfg`. Aucun autre module n'écrit de chemin en dur. |
| `sources.py` | Lecture des fichiers de `sources/` (flux, chaînes, réglages locaux, catégories). |
| `flux.py`, `twitch.py`, `apercus.py`, `reseau.py` | Récupération : flux RSS, vidéos Twitch (yt-dlp), aperçus Open Graph. |
| `images.py` | Téléchargement des images dans `build/img/veille/`, et purge de celles qui ne servent plus. |
| `historique.py` | Base SQLite de tout ce qui a été récupéré. |
| `themes.py`, `style.css` | Thèmes et CSS. `themes.py` lit les thèmes de `kioske.cfg` et prépare ce que chaque page reprend (attributs de `<html>`, liste des thèmes pour `static/theme.js`, boutons de choix). `style.css` contient **tout** le CSS du site, pluie et thèmes compris : le code Python n'en écrit pas. |
| `rendu.py`, `rss.py`, `texte.py` | Contenu de la page d'accueil et de `rss.html` (étiquettes, galeries, données ; le squelette est dans `gabarits/`), flux RSS produits, outils de texte (slugs, IDs, échappement HTML). |
| `rendu_statique.py` | Contenu des pages statiques d'articles et de catégories (image, navigation, cartes ; le squelette est dans `gabarits/`). Aucun CSS (il est dans `style.css`) ni JavaScript (il est dans `js/`). |
| `gabarits.py`, `gabarits/` | Squelettes HTML des pages : `accueil.html`, `article.html`, `categorie.html`, `rss.html`. `${nom}` marque l'endroit d'une valeur ; ni boucle ni condition dans un gabarit. `gabarits.py` fournit `remplir("page.html", nom=valeur, …)` : une valeur manquante arrête le build, et le texte est échappé par Python (`esc()`) avant d'être passé. Un vrai signe dollar s'écrit `$$`. Pour modifier le HTML fixe d'une page, éditer son gabarit ; pour y ajouter une valeur, écrire `${nom}` dans le gabarit et passer `nom=…` dans l'appel `remplir()` de `rendu.py` ou `rendu_statique.py`. |
| `javascript.py`, `js/` | Tout le JavaScript écrit dans les pages. `js/` : un fichier par rôle — `accueil.js` (panneaux, recherche, favoris, menu), `galerie.js` (flèches des galeries), `carte_ouverte.js` (carte d'article par-dessus la page), `retour_app.js` (bouton précédent dans l'app installée), `installation_pwa.js`, `donnees_accueil.js` (lit le JSON des articles), `service_worker.js`, `page_article.js`, `page_categorie.js`, `page_rss.js`. `javascript.py` les lit (constantes `JS_…`) et fournit `json_pour_page()` pour les données. Pour ajouter un script : créer le fichier dans `js/`, ajouter sa constante dans `javascript.py`, l'insérer dans la page voulue. |
| `immuable.py` | Garde du bloc immuable. |
| `verrou.py` | Un seul build ou une seule publication à la fois. |
| `construction.py`, `publication.py` | Le build (`build/`) et la copie vers la racine web. |

## Réglages : `kioske.cfg`

Format INI, commenté dans le fichier. Une valeur manquante ou invalide arrête le build avec un message.

| Section | Clés |
| --- | --- |
| `[site]` | `domaine`, `nom`, `theme` (thème par défaut), `taille_defaut` (zoom de l'accueil en %, min 75, max 125, défaut 90 ; réglage du site, pas des visiteurs), `largeur_carte_ouverte` (largeur max du panneau article, ex: `min(600px, 85vw)`), `hauteur_carte_ouverte` (zoom de la hauteur des cartes, min 75, max 125, défaut 115), `bordure_panneau_epaisseur` (défaut 8), `espacement_panneau_vertical` (défaut `2.4rem`), `espacement_panneau_horizontal` (marge intérieure gauche et droite des panneaux, défaut `0.5rem`). |
| `[veille]` | `articles_flux_rss` (100), `videos_par_chaine` (15), `articles_par_source` (0 = tous), `delai_nouvel_essai_heures` (24). |
| `[serveur]` | `racine_web` (`/var/www/kioske.fr`), `ip_publique`, `intervalle_timer` (`30min`). |
| `[reseaux]` | `discord` (URL du serveur Discord), `mastodon` (profil Mastodon), `rss` (chemin vers la page RSS, défaut `rss.html`). Laissez vide pour désactiver un lien. |
| `[theme.<nom>]` | `nom`, `fond` (`etoiles` ou `noir`), `pluie` (`oui` ou `non`), `opacite_panneau` (0 à 100, en %). |

Deux thèmes existent : `voie_lactee` (fond noir étoilé, bande de la Voie lactée) et `pluie` (pluie
matricielle). Ajouter une section `[theme.<nom>]` ajoute un bouton de choix sur la page.

Les scripts bash lisent les mêmes valeurs avec `cfg <section> <clé>` (`deploy/lib_config.sh`).
Après un changement de `intervalle_timer` ou de `racine_web`, relancer `deploy/installer_serveur.sh`.

## Construire et publier

Le Python est toujours celui du venv du projet : `venv_blog/` sur le PC, `venv/` sur le serveur.

```bash
python3 -m venv venv_blog && venv_blog/bin/pip install -r requirements.txt   # une fois

venv_blog/bin/python bin/build_site.py                 # build complet : flux, Twitch, aperçus, images, page, flux RSS
venv_blog/bin/python bin/build_site.py --simple        # page seule, sans réseau (base et caches), flux RSS non réécrits
venv_blog/bin/python bin/build_site.py --no-twitch     # sans Twitch
venv_blog/bin/python bin/build_site.py --no-previews   # sans visiter les pages (rapide)
venv_blog/bin/python bin/build_site.py --no-cache      # ignore les caches
```

Le résultat est dans `build/`. Ouvrir `build/index.html` directement montre l'accueil, mais les cartes, la
recherche et les pages d'article utilisent des adresses absolues (`/articles/…`, `/articles-index.json`) :
pour les essayer, servir le dossier, par exemple `venv_blog/bin/python -m http.server -d build 8000`, puis
ouvrir `http://localhost:8000/`. Un build local sans réseau (`--simple`) n'a pas les images.

La publication copie `build/` dans la racine web (`racine_web`). Elle se lance **sur le serveur** :

```bash
venv/bin/python bin/publier_public.py                # construit, puis copie (ce que fait le timer)
venv/bin/python bin/publier_public.py --simple       # construit sans réseau, puis copie
venv/bin/python bin/publier_public.py --sans-build   # copie build/ tel quel
```

- Seuls les fichiers dont le contenu a changé sont copiés ; la dernière ligne donne le compte.
- Les images et flux de catégorie qui ne sont plus dans `build/` sont retirés de la racine web.
- Le build et la publication partagent un verrou (`data/build.lock`) : un lancement manuel pendant le
  passage du timer attend la fin de l'autre au lieu d'écrire les mêmes fichiers.

**Changer le thème ou la mise en page sans toucher aux articles** : `kioske_update` depuis le PC, puis
sur le serveur `venv/bin/python bin/publier_public.py --simple`. Un build seul ne publie rien.

## Sources de la veille

Dans `sources/`. Une ligne `[Nom]` seule ouvre une catégorie ; les flux ou chaînes qui suivent y vont,
jusqu'à la ligne `[…]` suivante. Une source sans catégorie tombe dans le bloc « Des Liens », en dernier.

```text
[Médias d'enquête]
"https://portail.basta.media/spip.php?page=backend"
[Twitch]
"ostpolitik"
```

- `RSS_feeds.txt` est une **copie** de la liste du bot Discord : si l'une des deux change, recopier l'autre.
- `Twitch_feeds.txt` est **propre à ce projet** (même format que celle du bot, mais indépendante).
- `flux_corrige_main.txt` : réglages locaux. `!"URL"` ignore un flux, `"URL" | Nom` change son nom
  affiché (flux RSS seulement). Pas de commentaire en fin de ligne. Un flux qui ne fournit pas de
  titre donne une étiquette vide (seulement « ×10 ») : lui donner un nom ici, comme pour
  `agauche.org` (« À gauche »). Le nom apparaît au build complet suivant, pas avec `--simple`.
- Une source présente dans deux catégories garde la première. Les étiquettes sont regroupées par URL :
  un flux renommé n'apparaît qu'une fois.

## Bloc immuable

`accueil/bloc_immuable.html` contient le bloc entre `<!-- IMMUABLE:DEBUT -->` et `<!-- IMMUABLE:FIN -->`.
Le build l'insère tel quel. Deux contrôles :

1. la source doit correspondre à l'empreinte de `data/immuable.json` ;
2. la page générée doit contenir le bloc **à l'identique**, avant et après son écriture, et encore
   avant la publication.

```bash
venv_blog/bin/python bin/garde_immuable.py verifier      # échoue si le bloc a changé
venv_blog/bin/python bin/garde_immuable.py enregistrer   # accepte la version actuelle (après une modif voulue)
```

Tant que l'empreinte n'est pas réenregistrée après une modification, rien n'est écrit ni publié.

## La page

### Accueil

- **Barre du haut** (fixe en haut de l'écran) : logo avec le nombre d'articles et de sources, champ de
  recherche, bouton ♡ (favoris), menu ≡. Le menu contient le choix du thème, les liens Flux RSS, Discord et
  Mastodon (selon `[reseaux]` ; de vrais liens, les externes dans un nouvel onglet avec
  `rel="noopener noreferrer"`) et le code de conduite. Le bouton ≡ annonce l'état du menu (`aria-expanded`).
- **Thème au choix du visiteur** : boutons `.theme-bouton`, gérés par `static/theme.js`. Le choix est gardé
  dans `localStorage` (clé `kioske-theme`, aucun cookie) et s'applique à toutes les pages. Le build pose le
  thème par défaut sur `<html>` (`data-fond`, `data-pluie`, `--panneau-opacite`) : sans JavaScript, c'est
  lui qui s'affiche, sans pluie. Les règles sont dans la section « Thèmes » de `kioske/style.css`.
- **Pluie matricielle** : colonnes créées par `static/theme.js`, signes affichés par CSS depuis un attribut.
  La page ne contient aucun texte japonais (les navigateurs ne proposent plus de la traduire).
- **`theme.js` est mis en cache** par le service worker : après l'avoir modifié, changer `CACHE_VERSION`
  dans `static/sw.js`.
- **Recherche** : taper puis Entrée. Le script charge `/articles-index.json` et cherche dans les titres,
  les résumés et les noms de sources ; les résultats s'affichent en cartes dans un panneau. Depuis une page
  d'article ou de catégorie, la recherche renvoie vers l'accueil (`/?q=…`), qui l'exécute.
- **Galerie horizontale** : les 12 derniers articles ayant une image. Les flèches < et > font défiler au
  survol.
- **Galerie des blocs de catégorie** : dans chaque bloc de l'accueil, entre le titre et les étiquettes, une
  rangée de petites vignettes des 12 derniers articles de la catégorie ayant une image. Flèches < et >
  comme sur la grande galerie ; elle défile aussi au doigt ou à la barre de défilement. Un clic ouvre la
  carte de l'article.
- **Galerie par catégorie** : dans le panneau d'une catégorie, la même galerie en plus petit, avec les 12
  derniers articles de la catégorie ayant une image. Elle est placée au-dessus des cartes et défile avec
  elles. Pas de galerie si la catégorie n'a aucune image.
- **Étiquettes** : une par source, dans un bloc par catégorie. Un clic ouvre le panneau de la source
  (30 cartes par page, pagination). Le bouton « + » d'un titre de catégorie ouvre le panneau de la catégorie,
  toutes sources mélangées, du plus récent au plus ancien.
- **Favoris** : cœur ♡ dans la carte ouverte, violet quand l'article est en favori. Stockage dans le
  navigateur (`localStorage`), sans serveur ni pistage. Le bouton ♡ de la barre ouvre « Mes favoris » :
  cartes des favoris, export et import en JSON, effacement. Les favoris enregistrés par une ancienne version
  (lien du site d'origine seul) sont complétés à l'ouverture du panneau à partir de `articles-index.json` ;
  un article qui n'est plus dans l'index garde son lien d'origine.
- **Code de conduite** : panneau ouvert depuis le menu ≡, avec boutons Partager et Copier le lien.
- **Heures en Paris** : toutes les dates affichées sont en heure de Paris (CET/CEST). L'attribut HTML
  `datetime` reste en UTC.
- **Page de découverte des flux** : `rss.html` liste le flux principal et un flux par catégorie ayant des
  articles (les mêmes que ceux écrits dans `build/rss/`), avec icônes RSS aux couleurs du drapeau trans et
  un lien de retour vers l'accueil. Les flux sont aussi déclarés dans l'en-tête de l'accueil.
- **Lien GitHub** : en bas de la page, avec la licence (GPL v3).

### Carte d'article

- **Format** : « carte à jouer » (ratio 2.5:3.5), image fixe en haut (35 % de la hauteur), texte
  défilant au milieu, boutons en bas (Précédent, ♡, 📤 partage, Suivant). Plein écran sur téléphone.
- **Ouverture en JavaScript** (accueil et pages de catégorie) : un clic simple sur une carte charge la
  page statique de l'article (`fetch`), en extrait `main.panel-article` et l'affiche par-dessus la page,
  dans `.carte-ouverte`. Le style (section « Carte d'article ouverte » de `kioske/style.css`) et le script
  (`kioske/js/carte_ouverte.js`) sont partagés avec la page statique. La page qui inclut le script
  fournit `updateHearts()` et `toggleFavorite()` (`kioske/js/accueil.js`, ou `static/app.js`) et ferme la
  carte sur Échap.
- **Adresse** : à l'ouverture, `history.pushState` met l'adresse de la page statique de l'article (lien
  partageable, rechargement possible). `popstate` referme ou rouvre la carte.
- **Fermeture** : « ← Retour », Échap, clic sur le fond sombre ou bouton précédent du navigateur. On
  retrouve le panneau ou la page de catégorie d'où l'on vient.
- **Précédent/Suivant** : article voisin dans l'ordre chronologique de tous les articles, chargé dans la
  même carte sans nouvelle entrée d'historique.
- **Lien normal conservé** : Ctrl+clic, Maj+clic, clic molette et navigation sans JavaScript ouvrent la
  page statique. Si le chargement échoue, le navigateur ouvre aussi la page statique.
- **Taille** : l'accueil est agrandi par `taille_defaut` (`kioske.cfg`, écrit au build dans le `style` de
  `<html>`, non modifiable par les visiteurs) ; ce zoom est annulé sur la carte ouverte pour qu'elle ait
  la taille de la page statique.

### Bouton précédent et historique

- **Panneaux de l'accueil** : un panneau ouvert par un clic ajoute une entrée d'historique
  (`history.pushState`, état `{ panneau, empile: true }`). Le bouton précédent du téléphone ou du
  navigateur le referme : on retrouve le panneau d'avant (par exemple la catégorie ouverte avant les
  favoris), sinon l'accueil. ×, Échap et le clic sur le fond sombre font `history.back()` : pas d'entrées
  qui s'empilent. `history.back()` n'agit qu'un instant plus tard : le panneau (ou la carte) est masqué
  avant l'appel, pour qu'un second appel (double appui, écouteur en double) ne remonte pas une entrée de
  trop. Changer de page dans un panneau remplace l'entrée, sans en ajouter.
- **Panneau rouvert au chargement** (adresse `/#cat=…`, retour depuis une page d'article) : aucune entrée
  ajoutée ; × referme sur place.
- **App installée** (`display-mode: standalone`), script `kioske/js/retour_app.js` inclus dans l'accueil, les pages
  d'article et les pages de catégorie : quand la page est la première de l'historique, une entrée « socle »
  est glissée dessous au premier geste (toucher, touche). Y revenir par le bouton précédent ramène à
  l'accueil ; sur l'accueil, on y reste. Dans un navigateur ordinaire, le script ne fait rien : précédent
  quitte le site normalement.
- **`from` ne sert qu'aux boutons** : le bouton précédent du navigateur ou du téléphone ne lit jamais le
  paramètre `from`, il suit l'historique. Seul le bouton « ← Retour » des pages d'article l'utilise.
- **Limite** : Chrome saute les entrées d'historique ajoutées sans geste. Sans avoir touché l'écran
  (défilement seul), ou en appuyant deux fois de suite sur précédent depuis l'accueil, l'app peut se fermer.

### Pages statiques

- **Architecture** : le build écrit une page d'accueil (`index.html`), une page par article
  (`articles/{id}-{slug}/index.html`) et une page par catégorie (`categories/{slug}/index.html`). Ce sont
  elles que voient les moteurs de recherche et les visiteurs sans JavaScript.
- **Bouton retour** (en haut à gauche) :
  - **Article** → l'adresse donnée par `from` (« ← Retour », ou « ← Retour à la catégorie »), sinon l'accueil ;
  - **Catégorie** → l'accueil (« ← Accueil »).
- **Paramètre `from`** : les liens vers un article disent d'où l'on vient. Depuis une page de catégorie :
  `/articles/abc123-titre/?from=%2Fcategories%2Fmedias%2F`. Depuis un panneau de l'accueil : `from` vaut
  `/#source=<clé>&p=<page>` ou `/#cat=<nom>&p=<page>`. L'accueil écrit cette ancre dans son adresse quand un
  panneau est ouvert, et la lit au chargement pour rouvrir le panneau à la bonne page. `from` doit être une
  adresse du site (commençant par un seul `/`), sinon le retour mène à l'accueil. Précédent/Suivant
  conservent `from`.
- **Identifiants persistants** : chaque article a un ID (12 caractères du hash SHA256 du lien) et un slug
  lisible (titre + 8 caractères du hash). Les catégories ont un slug issu du nom.

### Mise en page

- **Panneaux** : fond noir semi-transparent (70 %) autour du panneau, cliquable pour fermer ; croix × ;
  Échap. Un panneau remplit tout l'écran, au-dessus de la barre du haut (taille en % de son conteneur fixe, pour rester juste quand la page est agrandie) ; il se ferme par la croix × ou Échap, et ses cartes défilent à l'intérieur. Pour les sources et les
  catégories, la zone défilante est créée par le script ; pour les favoris et les résultats de recherche,
  c'est la grille elle-même (`.categorie-panneau > .grille` dans `kioske/style.css`).
- **Téléphone** (640 px et moins) : deux cartes par ligne, image en haut, seul le titre est affiché.
- **Écrans plus larges** : trois cartes par ligne jusqu'à 960 px, quatre au-delà ; blocs de catégories sur
  deux colonnes dès 900 px.
- **Lisibilité** : cartes et panneaux opaques ; seul le grand panneau principal est translucide
  (`opacite_panneau`).

Le CSS est dans `kioske/style.css`, inséré dans la page au build. Celui du bloc
immuable est dans `accueil/bloc_immuable.html`.

## Données, caches et images

- **`data/historique.db`** (SQLite, table `articles`) : tout ce qui a été récupéré. Rien n'y est effacé
  automatiquement. La page affiche les articles des sources **encore listées** : retirer une ligne de
  `sources/` cache ses articles sans les supprimer. `articles_par_source` limite l'affichage sans
  toucher à la base. Un flux injoignable ne fait rien disparaître.
- **`data/cache/`** : `previews_cache.json` (aperçus), `twitch_cache.json`, `images_echecs.json`. Une
  page ou une image en échec est réessayée après `delai_nouvel_essai_heures`.
- **Images** : téléchargées dans `build/img/veille/` sous un nom dérivé de leur adresse. JPEG, PNG,
  WebP, GIF et AVIF seulement (pas de SVG), 5 Mo au maximum. Les images qu'aucun article affiché
  n'utilise plus sont supprimées à chaque build.
- **Flux RSS produits** : `build/rss.xml` (les 100 articles les plus récents) et un flux par catégorie
  dans `build/rss/`, avec le texte complet de chaque article.

## Déploiement sur le serveur

Le site est construit et servi par le serveur (Debian 13, nginx). Le projet vit dans
`/home/meli/kioske.fr`, la racine servie est `racine_web`.

**Depuis le PC** : la fonction fish `kioske_update` (rsync avec `--delete`).

```bash
kioske_update --dry-run    # ce qui serait envoyé
kioske_update              # envoi vers meli@zarisse.fr:/home/meli/kioske.fr/
```

Elle n'envoie ni `build/`, ni `data/historique.db`, ni `data/cache/`, ni les venvs, ni `old/`,
`docs/`, `apercu/`, `.git/`, `CLAUDE.md`.

**Sur le serveur**, en utilisateur normal (`meli`) ; les étapes qui en ont besoin demandent `sudo` :

```bash
deploy/kioske.sh                          # tout, dans l'ordre
deploy/kioske.sh --email toi@exemple.fr   # tout, et demande le certificat Let's Encrypt
deploy/kioske.sh --certificat-ok          # tout, mais mise à jour nginx uniquement (config et headers), sans certificats
deploy/kioske.sh veille                   # seulement la mise à jour (ce que lance le timer)
deploy/kioske.sh --simulation             # affiche sans rien lancer
```

| Étape | Ce qu'elle fait |
| --- | --- |
| `immuable` | Vérifie l'empreinte du bloc immuable. |
| `serveur` | `installer_serveur.sh` : venv, racine web, unités systemd, premier passage. |
| `veille` | `publier_public.py` : construit `build/` puis le copie dans la racine web. |
| `nginx` | `deployer_nginx.sh` : HTTP, puis HTTPS si le certificat existe. Options `--email`, `--sans-certificat`. |
| `fail2ban` | Page « Tu es banni » et jail `kioske-scan`. Ignorée si la jail `sans_pitie` manque. |
| `statut` | `verifier_serveur.sh` : DNS, nginx, HTTPS, certificat, timer, âge de la dernière publication. |

**Service** : le timer `kioske-veille` lance `deploy/kioske.sh veille` à l'intervalle de `kioske.cfg`.
Les modèles sont dans `deploy/systemd/` ; `installer_serveur.sh` y remplace l'utilisateur, le dossier,
la racine web et l'intervalle. Le service tourne sous `meli` (`Group` = son groupe principal, calculé
par `id -gn "$UTILISATEUR"`), avec `SupplementaryGroups=www-data`, `UMask=0002` et
`ExecStartPost=+chown -R www-data:www-data` sur la racine web.

```bash
systemctl list-timers kioske-veille.timer
journalctl -u kioske-veille.service -n 50
sudo systemctl start kioske-veille.service   # publier tout de suite
```

**Droits** : la racine web est en `www-data:www-data`, dossiers `2775`, fichiers `664`. `data/` et
`build/` appartiennent à l'utilisateur du service.

**nginx** : HTTPS seul avec HSTS, **TLS 1.3 seul**, 0-RTT refusé, version masquée, méthodes `GET` et `HEAD`, fichiers cachés refusés, en-têtes de sécurité, politique de contenu `default-src 'none'` puis, pour le site seulement (`'self'`) : images, styles, polices, scripts (ceux des pages et `/app.js`), `fetch` (`connect-src` : recherche, carte ouverte, favoris), `manifest.json` et `sw.js`. Rien ne peut être chargé depuis un autre site.

**Règle à respecter dans la configuration** : aucun `add_header` dans un bloc `location`. Dans nginx, un `add_header` placé dans un `location` annule tous ceux du niveau `server` pour ce `location`. La durée de cache est donc choisie par une table `map $uri $kioske_cache_control` en tête de fichier et envoyée par un seul `add_header Cache-Control` au niveau `server`. Deux scripts de déploiement :
- **`deploy/deployer_nginx.sh`** : complet, gère les certificats Let's Encrypt (appelle certbot) et déploie nginx. À utiliser lors de l'installation initiale ou pour renégocier les certificats.
- **`deploy/deployer_nginx_simple.sh`** : copie la configuration nginx depuis `deploy/kioske-nginx.conf`, teste, et recharge nginx sans toucher aux certificats. À utiliser pour mettre à jour la configuration (cache headers, CSP, etc.) si les certificats sont déjà en place.

Les deux scripts testent la configuration et restaurent l'ancienne version si le test échoue. Le certificat couvre le domaine seul, sans `www`.

**fail2ban** (`deploy/fail2ban/`) : `f2b.sh` (copie de `~/fail2ban_hardened/f2b.sh`), filtre
`kioske-scan.conf` (fichiers cachés, PHP, WordPress, `/cgi-bin/`), jail `kioske-scan.jail.conf`
(5 scans en 10 minutes, ban d'un jour). Débannir : `sudo fail2ban-client set kioske-scan unbanip <IP>`.

**Domaines alternatifs** : `gauchiasse.org` et `gauchiasses.org` redirigent vers `kioske.fr` (301).
Le script est dans `~/Lenovo_scripts/redirections_gauchiasses.sh`, à lancer en root sur le serveur.

### Après la réorganisation du 2026-11-11

1. `kioske_update --dry-run`, puis `kioske_update`.
2. Sur le serveur : `bash deploy/installer_serveur.sh`. Il déplace l'ancien `img/` dans `build/img/`,
   réinstalle les unités systemd et lance un passage.
3. Vérifier : `bash deploy/verifier_serveur.sh`.
4. Retirer ensuite l'exclusion `/img/` de `kioske_update`.

## Référencement

Le titre et la description de la page décrivent son contenu réel : `nom` de `kioske.cfg`,
nombre de sources et noms des catégories du jour. La page a une adresse canonique, des balises Open
Graph et Twitter (image `preview.png`), un `robots.txt` et un `sitemap.xml`. Chaque flux RSS est
déclaré dans l'en-tête.

## PWA (Progressive Web App)

Le site est compatible PWA : il peut être installé sur un téléphone ou un ordinateur comme une
application native, et fonctionne partiellement hors ligne.

**Fichiers PWA** :
- `static/manifest.json` : métadonnées de l'application (nom, description, icônes en 5 tailles, screenshots, theme colors).
- `static/sw.js` : service worker pour le caching des assets statiques et la résilience hors ligne.
- `static/icon-96.png`, `icon-128.png`, `icon-192.png`, `icon-256.png`, `icon-512.png` : icônes en 5 résolutions (générées depuis `apercu/preview.svg` avec `rsvg-convert`).

**Service Worker** :
- **Cache-first** : assets statiques (CSS, JS, fonts, icônes). Se chargent depuis le cache si disponibles.
- **Network-first** : toutes les pages (accueil, `/articles/…/`, `/categories/…/`, `.html`), flux RSS, images. Vérifient le réseau d'abord, cache en fallback si hors ligne.
- **Fallback hors ligne** : page d'accueil cachée si le réseau est indisponible et la page ne l'est pas.

**Installation** :
- **Bouton « ⬇ Installer l'app »** : présent dans l'ancien panneau d'infos (menu « + »), qui n'a plus de bouton d'ouverture depuis la barre du haut. Voir « Limites ».
- **Via le navigateur** :
  - **Téléphone** (Chrome, Firefox, Edge) : visiter le site, puis « Installer » dans le menu du navigateur.
  - **Ordinateur** (Chrome, Edge) : visiter le site, cliquer sur l'icône « Installer » dans la barre d'adresse.
- **Raccourci PWA** : lien vers la page RSS (`rss.html`) depuis le manifest.

**Cache headers** (nginx) :
- Service worker (`sw.js`) : `no-cache, max-age=0` (toujours vérifier les mises à jour).
- Manifest (`manifest.json`) : `max-age=86400` (1 jour).
- Icônes PWA, polices, `favicon.svg` : `max-age=31536000, immutable` (1 an).
- Images de la veille (`/img/`) : `max-age=2592000` (30 jours).
- Flux RSS/XML : `no-cache, max-age=0` (pas de cache, rafraîchir régulièrement).
- Tout le reste (pages, `app.js`, `articles-index.json`) : `max-age=1800` (30 min, durée du timer).
- Les réponses d'erreur n'ont pas de `Cache-Control`.

**Mise à jour du cache** :
Le cache est versionné (`CACHE_VERSION` dans `static/sw.js`). Pour forcer une mise à jour après un déploiement :
modifier la version (ex: de `kioske-v1` à `kioske-v2`). Les anciens caches seront supprimés automatiquement
au prochain chargement.

## Limites

- **Configuration nginx à déployer et à vérifier** : la correction des en-têtes (voir « Déploiement ») n'a
  pas pu être testée avec nginx sur le PC. Après `bash deploy/deployer_nginx_simple.sh` sur le serveur, contrôler que
  `curl -sI https://kioske.fr/` affiche `content-security-policy`, `strict-transport-security`,
  `cache-control` et `content-language: fr`, puis essayer la recherche et l'ouverture d'une carte. La CSP est appliquée aux pages
  pour la première fois : si un élément ne s'affiche plus, la console du navigateur indique la règle en cause.
- **Deux invitations Discord différentes** : le menu ≡ utilise `discord` de `kioske.cfg`, le bloc immuable
  en contient une autre. À harmoniser si l'une des deux est périmée.
- **Panneau d'infos sans bouton** : le bouton « Installer l'app » est dans un panneau (`bloc-infos-container`) que plus aucun bouton n'ouvre.
- **Cartes des pages de catégorie statiques** : la ligne sous l'image affiche l'adresse de l'article au lieu
  de « date · site ».
- **Titres et résumés des flux** : insérés tels quels dans le HTML des panneaux par le JavaScript de
  l'accueil ; un flux malveillant pourrait y injecter du code.
- Un flux injoignable est ignoré avec un message `[flux] …` ; la page est construite sans lui.
- Twitch passe par yt-dlp. Une vidéo réservée aux abonnés ou supprimée est ignorée avec un message.
- Les aperçus viennent de la page de l'article ; certains sites ne fournissent pas d'image.
- La base n'est jamais purgée : sans `articles_par_source`, la page grossit avec le temps.
- Ne pas mettre dans la veille une ressource dont le nom se résout en adresse privée
  (ex. `blog.zarisse.fr` depuis le réseau local) : Chrome demande alors l'accès au réseau local.

## Licences

**kioske.fr** : GNU General Public License v3 (`LICENSE`). Vous pouvez copier, modifier et distribuer ce projet
sous les termes de la GPL v3.

Articles et vidéos de la veille : leurs auteur.ice.s et sites respectifs. Police Russo One : SIL Open
Font License (`static/fonts/OFL.txt`).
