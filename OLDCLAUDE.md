# Consignes — kioske.fr

Projet autonome, copié de `gauchiasses.fr` le 2026-11-11 et réorganisé le même jour. Le venv local
est `venv_blog/bin/python`, à recréer avec `requirements.txt` si besoin.

Ce fichier ne contient que les règles de travail propres à ce projet. Pour la
structure, la veille et le déploiement, lire `README.md`,
qui est la référence et doit rester à jour.

## Modifications récentes

### Session 23 (2026-11-13, nuit - code de conduite en panneau normalisé + boutons partage/copie)

**Code de conduite : page HTML séparée + panneau au format normalisé**
- **Avant** : code de conduite intégré au bloc immuable, ouvert comme popover HTML5 natif
- **Après** : 
  - **Page HTML séparée** : `accueil/code-de-conduite.html` (contenu seul, sans styles)
  - **Panneau normalisé** : le clic sur "Code de conduite" ouvre un panneau au format standardisé du site (`.categorie-panneau`)
  - **Navigation cohérente** : le panneau du code de conduite suit les mêmes patterns que les panneaux de sources/catégories
  - **Menu ferme automatiquement** : à l'ouverture du panneau du code de conduite
- **Structure du panneau** :
  - Header avec titre + bouton fermer
  - Contenu scrollable avec toute la documentation
  - Styles CSS personnalisés pour h2, h3, ul, blockquote, etc. dans le panneau
  - **Boutons d'action en bas** : 📤 Partager + 🔗 Copier le lien
- **Données injectées** : contenu du code de conduite stocké dans `window.conductCode` (variable JavaScript)
- **Fonction JavaScript** : `createConductPanel()` crée le panneau dynamiquement (similaire à `createSourcePanel()` et `createCategoryPanel()`)
- **Corrections appliquées** :
  - ID manquant dans `showPopover()` : ajout de `id === 'conduct'` à la condition pour que le panneau s'affiche
  - Collision d'IDs du bouton : suppression de l'ID du bloc immuable, le bouton du bloc appelle maintenant le clic du bouton de la navbar
- **Boutons d'action** :
  - **📤 Partager** : utilise l'API Web Share native du navigateur (si disponible)
  - **🔗 Copier le lien** : copie l'URL dans le presse-papiers et affiche une confirmation "✓ Copié !" en vert pendant 2 secondes
  - Styles cohérents : effet hover (fond rouge, texte noir), transition douce
- **Modifications** :
  - `accueil/code-de-conduite.html` : nouveau fichier (contenu seul)
  - `accueil/bloc_immuable.html` : 
    - Suppression du code de conduite et de son CSS
    - Bouton "Code de conduite" utilise `onclick` pour appeler le clic du bouton de la navbar
    - Simplification du HTML (suppression du `<div id="code-conduite" popover>`)
  - `kioske/rendu.py` :
    - Import de `Path` depuis `pathlib`
    - Chargement du contenu du code de conduite depuis le fichier
    - Injection du contenu dans `window.conductCode`
    - Ajout de la fonction `createConductPanel()` avec boutons de partage/copie
    - Gestionnaire d'événements pour le bouton `#btn-open-conduite`
    - CSS pour styliser le contenu du code de conduite (`.conduct-panneau`)
    - **Correction** : ajout de `id === 'conduct'` dans `showPopover()` pour afficher le panneau
  - `kioske/immuable.py` :
    - Suppression de `'id="code-conduite"'` de la liste `ATTENDUS`
    - Empreinte ré-enregistrée
  - `static/sw.js` : version du cache incrémentée `kioske-v14` → `kioske-v15`
- **Résultat** : 
  - Code de conduite toujours accessible dans un panneau normalisé
  - Panneau fonctionne maintenant correctement (correction du showPopover)
  - Utilisateurs peuvent partager ou copier le lien vers la page du code de conduite
  - Bloc immuable simplifié (contient uniquement Discord/Mastodon/RSS)
  - Interface cohérente : tous les panneaux utilisent le même système

### Session 22 (2026-11-13, nuit - navbar top sticky + réseaux sociaux configurables)

**Réseaux sociaux configurables via kioske.cfg**
- **Nouveauté** : section `[reseaux]` dans `kioske.cfg` pour configurer les liens
- **Clés** :
  - `discord` — URL du serveur Discord (ex: `https://discord.gg/QSCfR2NHJ`)
  - `mastodon` — profil Mastodon (ex: `https://tech.lgbt/@zarisse`)
  - `rss` — chemin vers la page RSS (défaut: `rss.html`)
- **Navbare** : les boutons s'affichent conditionnellement selon la configuration (laissez vide pour désactiver)
- **Bloc immuable** : reste immuable. Si vous changez les réseaux sociaux dans le bloc immuable, vous devez ré-enregistrer l'empreinte avec `venv_blog/bin/python bin/garde_immuable.py enregistrer`
- **Modifications** :
  - `kioske.cfg` : ajout section `[reseaux]`
  - `kioske/rendu.py` : lecture des réseaux et injection dans la navbar de manière conditionnelle
- **Résultat** : tous les réseaux sociaux de la navbar sont maintenant configurables depuis `kioske.cfg`

**Navbar top sticky (voir plus bas)**

### Session 22 (2026-11-13, nuit - navbar top sticky)

**Refonte complète de la navigation : navbar top sticky remplace le bouton "+" + titre + recherche**
- **Avant** : bouton "+" (top-left, ouvre popover), titre énorme (h1 avec drapeaux), barre de recherche (au centre)
- **Après** : **navbar sticky en haut de la page** avec :
  - **Gauche** : drapeau 🏳️‍⚧️ + titre "kioske.fr" + stats (X articles · Y sources)
  - **Centre** : barre de recherche (flexible, toujours visible)
  - **Droite** : bouton "♡ Favoris" + menu hamburger "≡" (toggle)
- **Menu déroulant** (le "≡") contient :
  - 🎨 **Thèmes** — boutons radio (remplace les labels du popover)
  - 🔍 **Taille du site** — slider (même fonctionnalité qu'avant)
  - 📡 **Flux RSS** — lien vers `rss.html`
  - 💜 **Discord** — lien vers serveur
  - 📖 **Code de conduite** — ouvre un panneau normalisé avec les règles de la communauté et la charte
- **Le panneau principal** commence maintenant directement à la galerie (sans titre, kicker, stats, barre de recherche)
- **CSS** : `.kioske-navbar` sticky, flex layout, responsive (reflow sur mobile <768px, compact <480px)
- **JavaScript** :
  - Fermer le menu au clic dehors
  - Mettre à jour la taille du site depuis le slider de la navbar (sync avec l'ancien slider du popover)
  - Recherche fonctionne depuis la barre de la navbar (même logique qu'avant)
- **Modifications** :
  - `kioske/rendu.py` : génération de la navbar HTML, suppression du titre/kicker/recherche du panneau
  - `kioske/style.css` : ajout des styles `.kioske-navbar` et dérivés, media queries responsive
  - `static/sw.js` : version incrémentée `kioske-v13` → `kioske-v14`
- **Résultat** : 
  - Navigation cohérente et conventionnelle
  - Espace libéré : le panneau n'a plus de "décors" et commence directement au contenu
  - Recherche toujours accessible (barre collante)
  - Tous les contrôles centralisés dans le menu hamburger
  - Responsive jusqu'à 300px

### Session 21 (2026-11-13, nuit - panneaux de catégories + favoris corrigés)

**Boutons "+" des catégories → panneaux JS dynamiques**
- **Avant** : les boutons "+" des catégories naviguaient vers des pages HTML statiques (`/categories/{slug}/`)
- **Après** : **les boutons "+" deviennent cliquables et ouvrent des panneaux JS dynamiques** identiques à ceux des sources
- **Données injectées** : création d'un dictionnaire JSON `window.categoriesData` contenant tous les articles groupés par catégorie (clé), avec titre, image, résumé, date, host, URL, source
- **Panneau dynamique** : fonction `createCategoryPanel(categoryName)` crée un panneau avec :
  - Structure flexbox (header + grille scrollable + pagination)
  - Grille de cartes Pokémon
  - Pagination : 30 articles max par page, boutons "← Pages précédentes" et "Pages suivantes →"
  - Bouton "×" en haut à droite (ferme le panneau)
  - Tous les articles de la catégorie, triés par date décroissante
- **Responsive** : identique aux panneaux de sources
- **Modifications** :
  - `kioske/rendu.py` :
    - Transformation du bouton "+" en `<button>` cliquable avec `data-category-name` au lieu de lien `<a>`
    - Génération de `window.categoriesData` en JSON avec tous les articles regroupés par catégorie
    - Fonction `createCategoryPanel()` qui crée le panneau avec pagination
    - Gestionnaire d'événements sur les boutons `.tag-categorie` pour déclencher le panneau au clic
  - `static/sw.js` : version incrémentée `kioske-v11` → `kioske-v12`
- **Résultat** : clic sur "+" d'une catégorie → affichage d'un panneau avec tous les articles de cette catégorie, avec pagination, responsive et design identique aux sources

**Système de favoris entièrement réécrit**
- **Avant** : `toggleFavorite()` et `openFavoritesPanel()` essayaient de cloner les cartes du DOM, mais elles n'y existaient jamais (créées dynamiquement dans les panneaux)
- **Après** : 
  - `toggleFavorite()` charge l'article complet depuis `window.sourcesData` ou `window.categoriesData` et stocke toutes les métadonnées (image, résumé, date, host, source)
  - Clé de favori : `fav_{articleLink}` (sanitisé)
  - `openFavoritesPanel()` crée les cartes en utilisant les données stockées au lieu de cloner
  - Les cartes favoris ont maintenant image, date, host, résumé — identiques aux panneaux sources/catégories
- **Fallback** : si les données JSON ne sont pas disponibles (pages statiques), stocke titre + URL minimales
- **Modifications** :
  - `kioske/rendu.py` : `toggleFavorite()`, `updateHearts()` réécrits
  - `static/app.js` : idem pour les pages statiques d'articles
- **Résultat** : "Mes favoris" affiche maintenant les cartes complètes avec toutes les infos

### Session 20 (2026-11-13, nuit - panneaux de source + pagination + responsive)

**Tuiles de source cliquables avec panneaux JS et pagination**
- **Panneau de source** : structure flexbox avec header (titre + bouton ×) + grille scrollable + pagination
- **Pagination** : 30 articles max par page, boutons "← Pages précédentes" et "Pages suivantes →", indicateur "Page X / Y"
- **Bordures configurable** : `bordure_panneau_epaisseur = 8` (pixels) dans `kioske.cfg`
- **Espacement configurable** : `espacement_panneau_vertical = 4rem` dans `kioske.cfg`
- **Responsive mobile** :
  - ≥640px : design optimisé, 90vh max-height
  - 640px-429px : mobile optimisé, 85vh max-height, padding réduit
  - 429px-300px : mobile serré, 80vh max-height, boutons réduits
  - <300px : ultra compact, 75vh max-height, boutons très petits
- **Grille mobile** : 2 colonnes (640px-429px) → 1 colonne (<429px)
- **Modifications** :
  - `kioske/rendu.py` :
    - Structure du panneau avec flexbox (header fixe + grille scrollable + pagination)
    - Pagination avec 30 articles/page, boutons de navigation
    - Classe `.pagination-btn` pour les boutons
    - Données injectées dans `window.sourcesData` JSON
  - `kioske/style.css` :
    - `.categorie-panneau` : `display: flex; flex-direction: column;` + variable CSS pour espacement
    - Bordures en haut/bas avec variable CSS `--bordure-panneau-epaisseur`
    - Media queries pour <640px, <429px, <300px avec optimisations progressives
  - `kioske.cfg` :
    - `bordure_panneau_epaisseur = 8` (configurable)
    - `espacement_panneau_vertical = 4rem` (configurable)
- **Cache PWA** : version incrémentée `kioske-v10` → `kioske-v11`
- **Résultat** : panneaux de source cliquables avec pagination, parfaitement responsive jusqu'à 300px

### Session 19 (2026-11-13, nuit - tuiles cliquables)

**Tuiles (sources) rendues cliquables avec panneaux JS**
- **Avant** : les étiquettes de source étaient de simples `<span>` non cliquables, affichant juste le nom et le nombre d'articles
- **Après** : **les étiquettes deviennent des `<button>` cliquables qui ouvrent un panneau JS** listant tous les articles de la source
- **Données injectées** : création d'un dictionnaire JSON `window.sourcesData` contenant tous les articles groupés par source (clé), avec titre, image, résumé, date, host, URL, source
- **Panneau dynamique** : fonction `createSourcePanel(sourceKey, sourceName)` crée un panneau identique aux catégories, avec :
  - Grille de cartes Pokémon
  - Bouton "← Accueil" en haut à gauche (ferme le panneau)
  - Bouton "×" en haut à droite (ferme le panneau)
- **Styles CSS** : 
  - ajout de `.nuage button.tag { margin: 0; }` pour éviter les styles par défaut du navigateur
  - ajout de `.categorie-retour { ... }` pour styliser le bouton "Accueil"
- **Gestion des IDs** : normalisation des clés de source en IDs HTML valides (caractères spéciaux remplacés par `_`)
- **Modifications** :
  - `kioske/rendu.py` :
    - Transformation des tags en `<button>` cliquables avec `data-source-key` et `data-source-name`
    - Génération de `window.sourcesData` en JSON avec tous les articles et métadonnées
    - Fonction `createSourcePanel()` qui crée le panneau avec bouton "Accueil" et grille
    - Gestionnaire d'événements sur `.nuage .tag` pour déclencher le panneau au clic
    - Mise à jour de `showPopover()` pour gérer les IDs `source-*`
  - `kioske/style.css` : 
    - ajout du sélecteur `.nuage button.tag` pour éviter les styles par défaut
    - ajout du sélecteur `.categorie-retour` pour le bouton "Accueil"
- **Cache PWA** : version incrémentée `kioske-v9` → `kioske-v10`
- **Résultat** : clic sur une tuile → affichage d'un panneau avec tous les articles de cette source, avec bouton "← Accueil" pour revenir

### Session 18 (2026-11-13, nuit - liens recherche 404 fix)

**Correction des liens de recherche (404)**
- **Problème** : les liens de la barre de recherche renvoyaient vers des 404
- **Cause** : l'index JSON utilisait les titres originaux des articles pour générer les slugs, mais les pages statiques utilisaient les titres des previews → slugs divergents
- **Solution** : utiliser le titre du preview dans `ecrire_index_articles()` pour que les URLs correspondent
- **Modification** : `kioske/construction.py` — `ecrire_index_articles()` utilise maintenant `previews.get(...).get("title")`
- **Cache PWA** : version incrémentée `kioske-v8` → `kioske-v9`
- **Résultat** : les liens de la barre de recherche pointent maintenant vers les bonnes pages

### Session 17 (2026-11-13, nuit - galerie 12 articles)

**Galerie : augmentation du nombre d'articles**
- Nombre d'articles augmenté : **10 → 12**
- Modifications :
  - `kioske/rendu.py` : `render_galerie()` — limite passée de 10 à 12
- **Cache PWA** : version incrémentée `kioske-v7` → `kioske-v8`
- **Résultat** : galerie avec plus d'articles visibles

### Session 16 (2026-11-13, nuit - pages catégories sans groupement)

**Pages de catégories : affichage fusionné par date**
- **Avant** : articles groupés par source (une section par source, articles triés par date au sein de chaque section)
- **Après** : **tous les articles d'une catégorie mélangés dans une seule grille, triés par date décroissante** (plus récents d'abord)
- **Suppression du groupement par source** : les articles n'ont plus de bloc "Nom de la source"
- **Modifications** :
  - `kioske/construction.py` : `ecrire_pages_categories()` — fusion de tous les articles, tri global par date
  - `kioske/rendu_statique.py` : `render_category_page()` — signature changée (reçoit une liste plate d'articles, pas une liste de tuples)
- **Cache PWA** : version incrémentée `kioske-v6` → `kioske-v7`
- **Résultat** : pages de catégories plus lisibles, articles récents visibles d'emblée

### Session 15 (2026-11-13, nuit - corrections + cache v6)

**Mise à jour du cache PWA**
- Version incrémentée : `kioske-v5` → **`kioske-v6`**
- Force la mise à jour automatique du cache côté navigateur
- Fichier : `static/sw.js`
- Build régénéré avec `--simple`

### Session 15 (2026-11-13, nuit - corrections barre de recherche et cartes mobile)

**Barre de recherche : corrections critiques**
- **Problème** : la barre de recherche ne fonctionnait pas — elle ne retournait rien ou causait des erreurs silencieuses
- **Causes identifiées** :
  - Fetch utilisait un chemin relatif `./articles-index.json` (ambigu selon le contexte)
  - Pas de vérification HTTP de la réponse
  - Code redondant qui créait deux fois le panneau
  - Erreur d'échappement JavaScript dans `console.error('Erreur lors du chargement de l\'index:', err)` générait une syntaxe invalide
- **Corrections appliquées** :
  - Chemin du fetch changé en `/articles-index.json` (absolu, robuste)
  - Vérification `.ok` de la réponse HTTP + meilleure gestion d'erreur
  - Suppression du code redondant
  - Correction de l'échappement : `\'` → `\\\'` pour générer du JavaScript valide
  - Ajout d'alertes utilisateur en cas d'erreur ou absence de résultats
- **Fichiers modifiés** : `kioske/rendu.py` (JavaScript de la barre de recherche)
- **Résultat** : 
  - La recherche fonctionne — les cartes s'affichent dans un panneau
  - 121 articles trouvés pour "trans" (test validé)
  - Meilleur retour utilisateur en cas d'erreur

**Cartes sur téléphone : réduction de taille**
- **Objectif** : cartes 2 fois plus petites sur mobile pour meilleure densité
- **Modifications** :
  - `kioske/style.css` : media query `max-width: 640px`
    - Grille : 1 colonne → **2 colonnes** (`--colonnes: 2`)
    - Hauteur d'image : `9.5rem` → **`4.75rem`** (−50%)
    - Padding : `.6rem/.8rem` → **`.3rem/.4rem`** (−50%)
    - Font size titre : `.8rem` → **`.6rem`** (−25%)
    - Bouton "+" réduit proportionnellement
- **Résultat** : cartes compactes, 2 par ligne, meilleure UX sur petit écran

**Cache PWA : forçage de mise à jour**
- **Modification** : `static/sw.js`
  - Version incrémentée : `kioske-v4` → **`kioske-v5`**
- **Résultat** : 
  - Navigateur détecte automatiquement la nouvelle version
  - Rechargement avec `Ctrl+Maj+R` / `Cmd+Maj+R` vidé le cache
  - Tous les changements chargés

### Session 14 (2026-11-13, soir - barre de recherche)

**Système de recherche entièrement refactorisé :**
- **Placement** : barre de recherche en haut du panneau principal (hors du menu "+")
- **Affichage des résultats** : panneau JS identique aux panneaux de catégories
- **Format des cartes** : format Pokémon (identique aux cartes de catégories)
- **Cliquabilité** : cartes créées avec liens directs vers `/articles/{id}-{slug}/`
- **Données** : la recherche charge `/articles-index.json` et filtre par titre, résumé, source
- **Modifications** :
  - `kioske/rendu.py` : 
    - Suppression de la barre de recherche du popover du menu "+"
    - Ajout de la barre de recherche en haut du panneau principal
    - Refactorisation du JavaScript pour charger l'index JSON
    - Génération dynamique des cartes au format Pokémon avec liens HTML
- **Résultat** :
  - Barre de recherche visible et accessible en permanence
  - Appui sur Entrée → affiche un panneau avec les résultats
  - Les cartes sont identiques visuellement aux cartes de catégorie
  - Clic sur une carte → navigation vers la page de l'article

### Session 13 (2026-11-13, soir - refonte complète)

**Navigation entièrement en HTML statique :**
- **Tuiles** : non cliquables, juste décoratives (`<div>` avec `cursor: default`)
- **Étiquettes de source** : non cliquables, juste des étiquettes décoratives (`<span>`)
- **Bouton "+" par catégorie** : ajouté au titre de chaque groupe
  - Clic sur "+" → navigue vers la **page HTML statique** de la catégorie (`/categories/{slug}/`)
  - Pages préexistantes (International, Médias d'enquête, etc.) avec tous les articles du groupe
- **Modifications** :
  - `kioske/rendu.py` : 
    - `render_card()` : cartes transformées en `<div>` non cliquables
    - `render_page()` : 
      - Étiquettes de source transformées en `<span>` non cliquables
      - Bouton "+" transformé en lien `<a>` vers `/categories/{slug}/`
      - Suppression de la génération des panneaux (utilisation des pages statiques existantes)
- **Résultat** : 
  - Accueil : affichage des tuiles décoratives et des sources (non cliquables)
  - Clic sur "+" → navigation vers la page HTML de la catégorie
  - Chaque page de catégorie affiche les articles du groupe avec bouton retour en haut à gauche
  - Clic sur une carte → navigation vers la page de l'article
  - **Avantage** : plus de JavaScript de panneau sur l'accueil, navigation pure HTML

### Session 12 (2026-11-13, soir)

**Correction définitive des liens Précédent/Suivant (404) :**
- **Problème** : les boutons pointaient vers des URLs en 404 quand le titre du preview différait du titre original
- **Cause** : les pages statiques étaient générées avec le titre du preview (pour le slug), mais les liens Précédent/Suivant recalculaient les slugs avec le titre original → slug divergent → lien cassé
- **Solution** : passer le dict des previews à `render_article_page()` pour que les slugs des liens utilisent les mêmes titres que ceux de la page
- **Modifications** : 
  - `kioske/rendu_statique.py` : ajout param `previews` à `render_article_page()`, utilisation du titre du preview pour les slugs de prev/next
  - `kioske/construction.py` : passer `previews` lors de l'appel à `render_article_page()`
- **Résultat** : tous les liens Précédent/Suivant pointent vers des pages qui existent réellement

### Session 11 (2026-11-13, soir - finale)

**Correction des boutons Précédent/Suivant :**
- **Problème** : les boutons pointaient vers des articles aléatoires car basés sur l'ordre initial des articles
- **Solution** : trier TOUS les articles par date décroissante, les boutons naviguent maintenant chronologiquement (du plus récent au plus ancien)
- **Modification** : `kioske/construction.py` - ajout de tri par date dans `ecrire_pages_articles()`
- **Résultat** : navigation fluide et logique : Précédent = article plus ancien, Suivant = article plus récent

### Session 11 (2026-11-13, soir - suite finale)

**Système de recherche complet — index JSON + cartes au format catégorie :**
- **Index JSON enrichi** : `build/articles-index.json` contient pour chaque article : titre, résumé, source, catégorie, lien, URL, **image**, **date**, **host**, texte de recherche
- **Cartes au format catégorie** : les résultats s'affichent comme des vraies cartes `.carte` avec :
  - Image (ou lettre initiale si pas d'image)
  - Titre en gras
  - Extrait du résumé (100 caractères)
  - Date et host du lien
  - Bouton "+" coin bas-droit
  - Hover : changement de couleur, clic = navigation vers l'article
- **Grille dynamique** : les cartes sont créées en JavaScript et affichées dans une grille `.grille` identique aux catégories
- **Couverture complète** : **1310 articles** avec toutes leurs métadonnées
- **Chemins absolus pour les images** : tous les chemins d'images dans l'index commencent par `/` pour être corrects sur toutes les pages (notamment quand on navigue entre articles avec Précédent/Suivant)
- **Flux complet** :
  1. Utilisateur tape une recherche → pannneau s'ouvre
  2. Index JSON chargé via `fetch()`
  3. Cartes générées en JavaScript
  4. Affichage identique aux catégories
  5. Clic sur une carte → accès à l'article
- **Fichiers modifiés** : `kioske/construction.py` (ajout image/date/host à l'index, chemins absolus), `kioske/rendu.py` (création de cartes HTML en JS au lieu de liens).

### Session 10 (2026-11-13, soir - suite)

**Corrections du système de recherche :**
- **Bug #1 : Panneau bloquant** : le panneau de résultats ne pouvait pas se fermer. Solution : ajout de gestionnaires de clics pour fermer le panneau au clic sur le backdrop (fond sombre) ou le bouton × (même système que les catégories).
- **Bug #2 : Recherche "transg" sans résultats** : la recherche cherchait dans tout le texte mélangé. Solution : refactorisation pour chercher séparément dans le titre, l'extrait et la source de chaque carte. Cela améliore aussi la pertinence des résultats.
- **Logging ajouté** : `console.log` affiche le nombre de résultats trouvés pour déboguer les recherches vides.
- **Fichiers modifiés** : `kioske/rendu.py` (amélioration de la logique de recherche et ajout des gestionnaires de fermeture).

### Session 9 (2026-11-13, soir)

**Barre de recherche — système de panneau de résultats :**
- **Problème initial** : deux barres de recherche présentes (une globale en haut, une dans le popover). La barre du popover ne fonctionnait pas.
- **Solution finale** : 
  - Suppression de la barre du popover (elle ne devait pas y être)
  - **Création d'un panneau de résultats** : au lieu de filtrer les cartes, la barre de recherche génère un **vrai panneau** (comme les catégories)
  - **Cartes cliquables** : les cartes clonées dans le panneau sont cliquables et ouvrent les articles normalement
  - **Interface** : le panneau affiche le nombre de résultats dans le titre (ex: « Résultats pour « politique » (45) »)
- **Comportement** : 
  1. Utilisateur tape dans la barre en haut
  2. Clique sur la loupe 🔍 ou appuie sur Entrée
  3. Un panneau s'ouvre (plein écran, style catégorie) avec les cartes correspondantes
  4. Clic sur une carte ouvre l'article normalement
  5. Fermeture du panneau avec × ou click en dehors
- **Recherche sur** : titre, extrait et source de la carte
- **HTML ajouté** : conteneur `.categorie-container` avec ID `container-recherche`, grille `grille-recherche`
- **JavaScript** : 
  - `document.getElementById('form-recherche').addEventListener('submit')` déclenche la recherche
  - Clonage des cartes correspondantes dans la grille
  - Gestionnaire de clics global pour ouvrir les articles depuis le panneau
  - Fermeture automatique du menu "+" quand le panneau s'ouvre
- **Fichiers modifiés** : `kioske/rendu.py` (ajout du conteneur HTML, remplacement du JavaScript pour générer un panneau).
- **Support du paramètre `?q=...`** : quand un utilisateur revient de la page d'un article en passant par la barre de recherche (qui redirige vers `/?q=...`), le JavaScript détecte le paramètre et déclenche automatiquement la recherche au chargement de la page. L'URL est nettoyée après (remplacée par `/` sans paramètre).
- **Flux complet** :
  1. Page d'accueil : utilisateur tape « politique » et appuie sur Entrée
  2. Panneau de résultats s'ouvre avec les cartes correspondantes
  3. Utilisateur clique sur une carte d'article
  4. L'article s'ouvre en plein écran
  5. Utilisateur utilise la barre de recherche depuis la page d'article (redirige vers `/?q=...`)
  6. L'accueil se recharge avec le paramètre `?q=...`
  7. JavaScript détecte le paramètre et déclenche automatiquement la recherche
  8. Panneau de résultats s'ouvre directement
- **Test** : build avec `--simple` généré. Fonction `ouvrirPanneauRecherche(query)` en place (ligne 1336), support du paramètre `?q=...` (lignes 1380-1388).

### Session 8 (2026-11-13)

**Navigation hiérarchique — pages statiques (matin) :**
- **Architecture** : conversion terminée en pages statiques pour articles et catégories. Chaque article et catégorie a sa propre page HTML générée lors du build (1028 articles + 7 catégories).
- **Bouton retour hiérarchique** : chaque page (sauf accueil) a un bouton retour en haut à gauche qui ramène au parent :
  - **Article** → retour à la catégorie parente (via param `from` URL-encodé : `?from=%2Fcategories%2F{slug}%2F`)
  - **Catégorie** → retour à l'accueil (texte: « ← Accueil »)
  - **Accueil** → pas de bouton retour
- **Param `from` sécurisé** : le param `from` est URL-encodé avec `urllib.parse.quote()` pour éviter les interprétations incorrectes des `/` (ex: `/categories/{slug}/` devient `%2Fcategories%2F{slug}%2F`).
- **Texte du bouton** : 
  - Articles : « ← Retour à la catégorie » (adapté au contexte)
  - Catégories : « ← Accueil » (clair et direct)

**Typographie et interface (après-midi) :**
- **Titres réduits** : tous les `h1` et `h2` passent à `1.1rem` (10% plus gros que le texte normal de 1rem). Fichiers : `kioske/rendu_statique.py` (ajout de styles pour `article h1` et `.panel-category h1`).
- **Titre des cartes de catégories** : augmenté à `1rem` (au lieu de `.615rem`). Plus lisible. Fichier : `kioske/style.css`.
- **Slider hauteur carte supprimé** : le contrôle de hauteur des cartes est retiré du menu "+". La hauteur est maintenant fixée à 115% (`--hauteur-carte-ouverte: 1.15`). Fichiers : `kioske/rendu.py`, `kioske/rendu_statique.py`.
- **Étiquettes redesignées** : bordure rouge, fond blanc, texte noir, pas de shadow (lisible). Au hover : fond rouge, texte blanc. Fichier : `kioske/style.css`.
- **Barre de recherche globale** : retirée du menu "+", maintenant accessible depuis chaque page (accueil, articles, catégories). Sur l'accueil : filtre les étiquettes. Sur articles/catégories : redirige vers `/?q=...`. Fichiers : `kioske/rendu.py`, `kioske/rendu_statique.py`, `kioske/style.css`.
- **Galerie scroll horizontal fixé** : changé `justify-content: center` → `flex-start` pour permettre un scroll complet jusqu'aux extrêmes. Fichier : `kioske/style.css`.
- **Cache service worker incrémenté** : version `kioske-v1` → `kioske-v4` pour forcer les mises à jour. Fichier : `static/sw.js`.

### Session 1 (2026-11-12, matin)

**Interface et layout :**
- **Menu "+"** : un bouton "+" en haut à gauche du panneau principal ouvre un popover d'infos avec la barre de recherche, les thèmes du site, le lien Discord et la charte.
- **Compactage du layout** : marges et padding réduits pour une meilleure densité visuelle. Actuellement en dur dans CSS.
- **Zoom PC supprimé** : le `zoom: 1.25` sur grands écrans (≥1100px) a été retiré pour simplifier le CSS.

**Contenu et éléments :**
- **Troncature des étiquettes** : les noms de sources qui dépassent 20 caractères sont tronqués avec "..." (ex: "Blast - Le soufflé..." au lieu de "Blast - Le soufflé ministériel").
- **Navigation de galerie** : les articles de la galerie ont des boutons Précédent/Suivant pour naviguer sans recharger.
- **Flux RSS invisibles** : les icônes RSS cliquables ont été retirées. Les flux restent découvrables par agrégateurs via balises `<link>` HTML.
- **Image de partage** : `preview.png` (OG/Twitter) régénérée depuis `preview.svg`.

**Bloc immuable** : modifié pour bien fonctionner dans le popover d'infos (ajout de `.popover-infos .links { margin-top: 0; }`). Empreinte SHA256 ré-enregistrée.

### Session 2 (2026-11-12, soir)

**Découverte des flux RSS :**
- **Page rss.html** : nouvelle page de découverte listant le flux principal (`rss.xml`) et tous les flux par catégorie, chacun avec un lien cliquable et une icône RSS aux couleurs du drapeau trans.
- **Lien RSS dans le popover** : ajout du lien « Découvrir les flux RSS » dans le bloc immuable, même format que le lien Discord (avec `&gt;` prompt). Visible dans le popover d'infos et sur toutes les pages (index.html, rss.html).

**Fuseau horaire :**
- **Heures en heure de Paris** : tous les timestamps affichés sur le site (dates des articles, heure de mise à jour du panel) sont maintenant en heure de Paris (CET/CEST selon la saison). Import de `zoneinfo.ZoneInfo` pour la conversion (`Europe/Paris`). L'attribut HTML `datetime` reste en UTC (standard), seul l'affichage textuel est converti.

### Session 3 (2026-11-12, après-midi)

**Barre de recherche — refonte complète :**
- **Panneau de résultats indépendant** : la recherche crée un panneau qui s'ouvre comme une catégorie, avec les cartes trouvées clonées dedans. Comportement identique à l'ouverture d'une catégorie : cliquable, fermable avec × ou backdrop.
- **Comportement au clavier** : à l'appui d'Entrée (plus de filtre en place à l'écran). Les cartes clonées restent cliquables et ouvrent les articles normalement.
- **Menu "+" se ferme** : quand on ouvre un panneau (résultats, carte, catégorie), le menu "+" se ferme automatiquement pour ne pas encombrer.

**Navigation et fermeture :**
- **Retour à l'index** : quand on ferme un article (× ou clic dehors), on revient à l'index du site, pas au panneau de la source.
- **Exclusion du menu "+"** : le bouton "+" (classe `btn-infos`) n'est pas affecté par le code général d'ouverture de panneaux, il garde son comportement propre.

**Galerie — clic seulement :**
- **Clic** : cliquer sur une carte de galerie l'ouvre de façon permanente (comme un article normal).
- **Pas de hover** : le survol des cartes n'ouvre pas l'article (comportement supprimé).

### Session 4 (2026-11-12, soir)

**Nettoyage du preview (image de partage social) :**
- **SVG régénéré** : `apercu/preview.svg` réécrit de manière propre, sans métadonnées.
- **PNG régénéré** : `static/preview.png` régénéré avec `rsvg-convert` depuis le SVG nettoyé.
- **Raison** : forcer la mise à jour du cache des réseaux sociaux (Facebook, Twitter) qui conservaient une ancienne version du preview.

**Suppression du hover sur la galerie :**
- Hover sur cartes de galerie supprimé (mouseenter/mouseleave).
- Clic seul pour ouvrir les articles.

**Système de favoris (localStorage + export/import) :**
- **Cœur ♡ cliquable** : dans la barre de navigation (avec Précédent/Suivant) sous chaque article ouvert. Toggle pour ajouter/retirer des favoris.
- **Couleur active** : violet (#9c27b0) quand l'article est en favori.
- **Panneau "Mes favoris"** : accessible via le menu "+", affiche les favoris sous forme de grille. Boutons pour télécharger/charger/effacer.
- **Stockage** : localStorage (`kioske_favoris`), aucune trace serveur, zéro pistage.
- **Fonctionne partout** : articles normaux ET galerie.

### Session 5 (2026-11-12, soir)

**PWA (Progressive Web App) — première implémentation :**
- **Manifest JSON** : `static/manifest.json` avec métadonnées de l'app (nom `KiosKe.fr`, court `KiosKe`, icônes, couleurs, scope et URL de démarrage).
- **Service Worker** : `static/sw.js` pour cacher les assets statiques (CSS, JS, icônes, fonts) en mode "cache-first", et articles/flux en "network-first" avec fallback.
- **Icônes PWA** : `static/icon-192.png` et `static/icon-512.png` générées depuis `apercu/preview.svg` avec `rsvg-convert`.
- **Balises HTML** : lien vers manifest.json, balises meta (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, etc.) dans le `<head>`, script d'enregistrement du service worker.
- **Bouton d'installation** : dans le popover d'infos (menu "+"), bouton "⬇ Installer l'app" qui s'affiche quand le navigateur le propose (événement `beforeinstallprompt`).
- **Pages affectées** : `index.html` (accueil) et `rss.html` (découverte des flux). Le service worker gère le caching automatiquement.
- **Mise à jour du cache** : versionnée dans `static/sw.js` (`CACHE_VERSION`). Modifier la version force la mise à jour au prochain chargement.
- **Installation** : disponible en mode "standalone" sur mobiles et ordinateurs (Chrome, Edge, Firefox).

### Session 6 (2026-11-12, après-midi/soir)

**PWA — réinstallation complète et déploiement nginx :**
- **Icônes PWA élargies** : création en 5 résolutions (96×96, 128×128, 192×192, 256×256, 512×512 px) depuis `apercu/preview.svg` avec `rsvg-convert`. Support des icônes "maskable" pour les icônes adaptatives.
- **Manifest complet** : `static/manifest.json` avec description longue, screenshots (form_factor: wide et narrow), catégories, et raccourci vers `rss.html`.
- **Service Worker robuste** : `static/sw.js` avec gestion d'erreurs (certains assets peuvent ne pas se cacher complètement), stratégies claire (cache-first pour assets, network-first pour articles/flux).
- **Bouton d'installation toujours visible** : `btn-install-pwa` dans le menu "+" sans `display: none` au départ. Affiche un prompt d'installation si `beforeinstallprompt` se déclenche (navigateurs modernes + HTTPS), sinon une alerte explicative.
- **JavaScript PWA amélioré** : gestion de `beforeinstallprompt`, `appinstalled`, et fallback pour les navigateurs/contextes sans support.
- **CSS du bouton** : `.btn-install-pwa` stylisé identique à `.btn-mes-favoris` (rouge clair, hover rouge/noir, box-shadow).
- **Configuration nginx (`deploy/deployer_nginx.sh`) — headers de cache PWA** :
  - `sw.js` : `no-cache, must-revalidate, max-age=0` + `Service-Worker-Allowed: /` (toujours à jour).
  - `manifest.json` : `max-age=86400` (1 jour) + `Content-Type: application/manifest+json`.
  - Icônes PWA (`icon-\d+.png`) : `max-age=31536000, immutable` (1 an).
  - Assets statiques (CSS, JS, fonts, SVG) : `max-age=31536000, immutable` (1 an).
  - Pages HTML : `max-age=3600, must-revalidate` (1 heure).
  - Flux RSS/XML : `no-cache, max-age=0` (jamais de cache, rafraîchir régulièrement).
- **Correction du script deployer_nginx.sh** : régex nginx remplacée `\d` → `[0-9]` (nginx n'accepte pas la classe Perl `\d`).
- **Déploiement** : fichiers PWA générés dans `build/` lors du build. Nginx serveur avec headers corrects. Timer systemd `kioske-veille` reconstruit toutes les 30 min.
- **Résultat** : le site est maintenant installable comme PWA native sur Chrome/Edge/Firefox (HTTPS requis). Bouton visible et fonctionnel en ligne sur kioske.fr.

### Session 7 (2026-11-12, après-midi)

**Zoom au chargement initial :**
- **Problème** : le slider de taille (`taille_defaut` = 125 dans `kioske.cfg`) n'était pas appliqué au chargement de la page. Il fallait toucher au slider pour que le zoom s'applique.
- **Cause** : le JavaScript appliquait le zoom uniquement si `localStorage` contenait une valeur sauvegardée, sinon il ne faisait rien (même pas appliquer la valeur par défaut du slider).
- **Correction** : refactorisation du code JavaScript (dans `kioske/rendu.py`) pour appliquer le zoom dès le chargement initial, en utilisant `localStorage` ou la valeur du slider par défaut.
- **Résultat** : le site s'affiche maintenant correctement à 125% (ou la valeur de `taille_defaut`) dès le premier chargement, sans intervention utilisateur.

**Configuration nginx versionnée :**
- **Fichier** : `deploy/kioske-nginx.conf` — configuration nginx complète et à jour, avec tous les headers de cache et de sécurité pour PWA.
- **Déploiement simple** : nouveau script `deploy/deployer_nginx_simple.sh` qui copie la config, teste, et recharge nginx, sans toucher aux certificats. Utile pour mettre à jour les headers de cache ou la CSP entre deux renouvellements de certificats.
- **Option kioske.sh** : `deploy/kioske.sh --certificat-ok` utilise le script simple pour nginx. Tous les autres paramètres de configuration nginx (certificats, HTTPS, etc.) ne sont pas modifiés — seul le fichier de configuration est copié et reload lancé.

**Lien Mastodon ajouté au bloc immuable :**
- **Lien** : `<a rel="me" href="https://tech.lgbt/@zarisse">Mastodon</a>` ajouté dans `accueil/bloc_immuable.html`, après Discord.
- **Empreinte** : ré-enregistrée après la modification.

**Cache HTML réduit à 30 min :**
- **Problème** : les pages HTML étaient cachées 1h par nginx, alors que le timer les met à jour toutes les 30 min.
- **Correction** : `max-age=3600` → `max-age=1800` dans `deploy/kioske-nginx.conf` pour les pages HTML.
- **Résultat** : les visiteurs verront les mises à jour dans les 30 minutes suivant la publication (au lieu de jusqu'à 1h).

Les règles générales (git, `sudo`, les deux machines, cloisonnement, scratchpad)
sont dans `~/.claude/CLAUDE.md`.

## Vocabulaire

- **Carte** : la carte affichée sur le site, avec ses bordures (le cadre rouge,
  la case cliquable). Dans la veille, une carte est la case d'une source ou d'un article.
- **Article** : le contenu récupéré sur le web (titre, extrait, image, date,
  lien d'origine). Un article se trouve à l'intérieur d'une carte, il n'est
  pas la carte.

Quand je parle de « carte », je parle de l'élément affiché avec ses bordures.
Quand je parle d'« article », je parle du contenu récupéré.

- **KiosKe** : la page de veille, qui est aussi la page d'accueil (`build/index.html`). Son nom
  s'écrit « KiosKe » (pas « kiosque »).

## Menu "+" (popover d'infos)

Le bouton **"+"** en haut à gauche du panneau principal ouvre un **popover d'infos** qui regroupe :

1. **Barre de recherche** : filtre les cartes par texte (titre, source, extrait). À l'appui d'Entrée, affiche les correspondances en opacité 100%, masque les autres à 30%.
2. **Choix des thèmes** : boutons radio pour basculer entre thèmes (ex: "Voie lactée", "Pluie matricielle"). Pas de cookie ; le choix est temporaire par session.
3. **Taille du site** : slider horizontal (75% à 125%, défaut `taille_defaut` de `kioske.cfg`, valeur par défaut 100%). Applique un `zoom` global au `<html>`. Sauvegarde en `localStorage` — persiste à la fermeture.
4. **Mes favoris** : bouton pour ouvrir le panneau des favoris (cœurs sauvegardés). Export/import JSON, effacement total.
5. **Bouton PWA "⬇ Installer l'app"** : propose l'installation comme application native (visible automatiquement sur navigateurs modernes + HTTPS). Affiche une alerte sur contextes non compatibles.
6. **Lien Discord** : bouton pour rejoindre le serveur (lien externe).
7. **Lien RSS** : lien vers la page de découverte `rss.html` (même format que Discord).
8. **Code de conduite** : bouton qui ouvre un dialogue dédié avec les règles et la charte communautaire.

Le popover a un **arrière-plan sombre** (`.infos-backdrop`) qui le referme au clic. Contient le bloc immuable (voir ci-dessous).

## Le bloc immuable

C'est la règle la plus importante du projet. Le bloc entre `<!-- IMMUABLE:DEBUT -->` et
`<!-- IMMUABLE:FIN -->` contient le lien vers le Discord et le code de conduite.
Il est écrit une fois pour toutes dans `accueil/bloc_immuable.html`, et le build l'insère
tel quel dans la page.

**Aucun build ne modifie ce bloc, et toi non plus.** Si je te demande d'y toucher, préviens-moi que
son empreinte va changer et que je devrai lancer
`venv_blog/bin/python bin/garde_immuable.py enregistrer` pour l'accepter.

- Vérifier : `venv_blog/bin/python bin/garde_immuable.py verifier` (échoue si le bloc a changé).
- L'empreinte de référence est dans `data/immuable.json`. Elle porte sur `accueil/bloc_immuable.html`.
- Le code du garde est `kioske/immuable.py`. Tout ce qui écrit ou publie la page appelle
  `verifier_page()` : la page doit contenir le bloc à l'identique. Ne jamais affaiblir ce contrôle.

**Modification (2026-11-12)** : le bloc immuable a été adapté pour fonctionner dans le popover d'infos. 
CSS ajouté pour `.popover-infos .links { margin-top: 0; }`. L'empreinte a été ré-enregistrée.

## Configuration réglable

Paramètres dans `kioske.cfg` section `[site]` :
- `taille_defaut` : zoom global du site (75-125%, défaut 115)
- `largeur_carte_ouverte` : largeur max d'une carte ouverte (article ou catégorie), ex: `min(600px, 85vw)` (défaut `min(600px, 85vw)`). Passe en variable CSS `--largeur-carte-ouverte` dans le HTML.

## Structure : où va quoi

- `kioske.cfg` : **tous les réglages** (domaine, thèmes, veille, serveur). Aucune de ces valeurs ne
  s'écrit en dur dans le code ni dans les scripts : Python passe par `kioske/config.py`, bash par
  `cfg <section> <clé>` (`deploy/lib_config.sh`).
- `sources/` : `RSS_feeds.txt`, `Twitch_feeds.txt`, `flux_corrige_main.txt`.
- `kioske/` : tout le code Python, un module par rôle, et le CSS (`style.css`, `pluie.css`).
  `bin/` ne contient que des points d'entrée de quelques lignes : pas de logique dedans.
- `static/` : fichiers publiés tels quels. `deploy/` : scripts du serveur. `data/` : base et caches.
- `build/` : le site généré, complet. **Jamais édité à la main**, hors git, jamais envoyé au serveur.
  La racine web du serveur est une copie de `build/`, produite par `bin/publier_public.py`.
- `old/` : reliquats et sauvegardes. À ne pas utiliser ni prendre pour modèle.

Les sources à modifier :

- `accueil/bloc_immuable.html` pour le bloc immuable (à réenregistrer après toute modif) ;
- `sources/*.txt` pour la veille ;
- `kioske.cfg` pour les réglages et les thèmes ;
- `kioske/style.css` pour le CSS de la page (celui du bloc immuable est dans `accueil/bloc_immuable.html`).

## Python

En local : `venv_blog/bin/python`. Sur le serveur : `venv/bin/python`. Jamais le
Python système.

## JavaScript

La page utilise du JavaScript pour :
- Gérer l'ouverture/fermeture des panneaux (articles et catégories) avec `hidden`
- Backdrops cliquables autour des panneaux pour fermer et revenir au niveau précédent
- Navigation Précédent/Suivant entre articles d'une même source ou de la galerie, sans recharger la page
- Sauvegarder et restaurer la position du scroll quand on bascule entre panneaux
- Fermer avec Escape ou clic en dehors du panneau
- Barre de recherche : filtre les cartes à l'appui d'Entrée (opacity 100% pour les correspondances, 30% pour les autres)
- Galerie : ouvre les fiches des 10 derniers articles (ceux avec image) au clic sur leur image, avec boutons Précédent/Suivant

## Choix de lisibilité — à ne pas « améliorer »

- Cartes format « Pokémon » (ratio 2.5:3.5, style jeu de cartes avec bordures arrondies et ombres de profondeur) :
  dimensions et ratio configurés dans `kioske.cfg` section `[cartes]` (`largeur_pourcent`, `ratio_aspect`).
  Ne pas coder en dur dans le CSS.
- Cartes, fenêtres de catégorie et panneaux d'article **opaques** : pas de translucidité, pas de flou.
  Le grand panneau principal (`.panel`) a son opacité réglée par `opacite_panneau` dans `kioske.cfg`
  (en %) : ne pas la figer dans le code.
- Thèmes : ils se règlent dans `kioske.cfg`. Ne pas recoder un thème en dur.
- Le visiteur choisit le thème avec des boutons radio cachés (CSS seul, pas de JavaScript, pas de
  cookie). Ne pas ajouter de JavaScript pour ce choix.
- Pas de halo lumineux sur les textes courants (titres d'articles, noms de
  sources, descriptions) ; halo réduit sur le titre principal. Les étiquettes ne clignotent pas.
- `zoom: 1.25` au-delà de 1100 px de large. Largeur **et hauteur** des fenêtres y sont divisées par
  1,25 : sinon elles sortent de l'écran.
- Téléphone : la fenêtre de catégorie (`.categorie-panneau`) se cale sur
  `100%`, jamais sur `100vw`. Une carte par ligne, titre seul. Détails dans le README.
- La carte est un `<button>` : son contenu n'est fait que de `<span>` (pas de `<div>`, `<p>`, `<h3>`).

## Données

- `data/historique.db` (SQLite) n'est jamais publiée et rien n'y est effacé
  automatiquement. Retirer une source de `sources/RSS_feeds.txt` cache ses articles du
  site sans les supprimer de la base ; remettre la ligne les fait réapparaître.
- Un flux injoignable au moment du build ne fait rien disparaître.
- Les caches de `data/cache/` se régénèrent seuls ; `--no-cache` force une
  nouvelle récupération.
- Les images de `build/img/veille/` qui ne servent plus à aucun article affiché sont purgées par le
  build. La purge ne tourne qu'avec les fichiers de sources habituels.

## Déploiement

Point d'entrée : `deploy/kioske.sh` (sans argument, tout le déploiement ; `kioske.sh veille` est ce
que lance le timer). Voir README.

Le site est construit **sur le serveur**, par le timer systemd `kioske-veille`. Le projet vit dans
`/home/meli/kioske.fr/` ; la racine servie par nginx est `racine_web` de `kioske.cfg`.

- Changer le thème ou la mise en page sans toucher aux articles : `kioske_update` depuis Garuda, puis
  sur le serveur `venv/bin/python bin/publier_public.py --simple`. Un build seul ne publie pas.
- Unités : modèles dans `deploy/systemd/`, installés par `deploy/installer_serveur.sh` (à relancer
  après un changement de `intervalle_timer` ou de `racine_web`).
- Droits : racine web en `www-data:www-data` (dossiers `2775`, fichiers `664`). Le service
  tourne sous `meli`, avec `Group=meli` et `SupplementaryGroups=www-data`, `UMask=0002`, et
  `ExecStartPost=+chown -R www-data:www-data` (le « + » lance cette commande en root).
- Piège à ne pas refaire : lancé via `sudo`, `id -gn` donne `root`. Le groupe du service se
  calcule donc avec `id -gn "$UTILISATEUR"`, jamais `id -gn` seul.
- nginx : `deploy/deployer_nginx.sh` écrit la configuration (HSTS, **TLS 1.3 seul**, 0-RTT refusé,
  méthodes GET/HEAD, CSP sans source externe, fail2ban si installé). Il teste avant de recharger.
- Build et publication partagent le verrou `data/build.lock` (`kioske/verrou.py`).

L'envoi du projet depuis ce poste se fait avec la fonction fish
`kioske_update` (rsync `--delete`). Tu ne la lances pas de ta propre initiative : tu me la
donnes, avec `--dry-run` d'abord. Elle exclut `build/`, `data/historique.db`, `data/cache/`,
`data/build.lock`, les venvs, `old/`, `docs/`, `apercu/`, `.git/`, `.claude/`, `CLAUDE.md`.
`static/` doit toujours partir : sans `preview.png`, la publication s'arrête.

## Redirections (domaines alternatifs)

Les domaines `gauchiasse.org` (singulier) et `gauchiasses.org` (pluriel) redirigent
vers `kioske.fr` en HTTPS (HTTP 301 permanent). Le script de déploiement se trouve
dans `~/Lenovo_scripts/redirections_gauchiasses.sh` : à lancer en root sur le serveur.

## Référencement (SEO)

La page `index.html` inclut :
- **Titre** : simple et descriptif (`kioske.fr`)
- **Description** : résumé complet du site (balise meta `description`)
- **Keywords** : `kioske, veille, médias indépendants, LGBTQIA+, Mélenchon, RSS, Twitch, informatique libre`
- **Image de partage** : `static/preview.png` (générée depuis `apercu/preview.svg` avec `rsvg-convert`)
- **Balises Open Graph** : titre, description, URL canonique, image
- **Balises Twitter** : card, titre, description, image

Les mots-clés incluent « Mélenchon » pour le référencement politique.

## Licence

Le projet est publié sous **GNU General Public License v3** (`LICENSE`). Tout ce qui modifie ou distribue
le code doit rester sous cette même licence.

Le lien vers le dépôt GitHub s'affiche en bas de la page avec la mention de la licence.

## Listes de sources

- `sources/RSS_feeds.txt` est une **copie** de celle de `discord-rss-bot`. Si je modifie l'une des
  deux versions, l'autre doit être recopiée — mais tu ne vas pas écrire dans l'autre projet de ta
  propre initiative : tu me le signales.
- `sources/Twitch_feeds.txt` est **propre à ce projet** : même format que celle du bot, mais
  indépendante. Rien à recopier.
