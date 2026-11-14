let openPopover = null;
// Nombre d'images dans la galerie d'un panneau de catégorie
const NB_GALERIE_CATEGORIE = 12;
// Adresse et historique des panneaux. Un panneau ouvert par un clic ajoute une entrée d'historique
// (état { panneau, empile: true }) : le bouton précédent du téléphone ou du navigateur le referme et
// ramène au panneau d'avant, ou à l'accueil. Un panneau rouvert au chargement (adresse /#cat=…) n'ajoute
// rien : son état n'a pas « empile ».
function majAdresse(ancre, etat = history.state) {
  const adresse = location.pathname + location.search + (ancre ? '#' + ancre : '');
  try { history.replaceState(etat, '', adresse); } catch (e) {}
}
// Masque le panneau sans toucher à l'historique
function masquerPanneau() {
  if (openPopover) {
    openPopover.hidden = true;
    openPopover = null;
  }
}
// Fermeture demandée (×, fond sombre, Échap) : on remonte l'historique si le panneau y a son entrée
function closePopover() {
  if (!openPopover) return;
  if (history.state && history.state.panneau && history.state.empile) {
    // Masqué tout de suite : history.back() n'agit qu'un instant plus tard, et un second appel
    // (double appui sur ×) remonterait une entrée de trop. « popstate » rouvre le panneau d'avant.
    masquerPanneau();
    history.back();
  } else {
    masquerPanneau();
    majAdresse('', null);
  }
}
// historique : 'ajouter' (nouvelle entrée), 'remplacer' (ouverture au chargement), 'aucun' (retour/avance du navigateur)
function showPopover(id, historique = 'ajouter') {
  // Fermer le menu navbar quand on ouvre un panneau
  const navbarMenu = document.querySelector('.navbar-menu');
  if (navbarMenu) navbarMenu.classList.remove('open');

  const container = document.getElementById('container-' + id);
  const dejaOuvert = !!container && openPopover === container;
  masquerPanneau();
  if (!container) return;
  container.hidden = false;
  openPopover = container;
  if (id.startsWith('cat-') || id.startsWith('source-') || id === 'search-results' || id === 'favoris' || id === 'conduct') {
    const adresse = location.pathname + location.search + (container.ancre ? '#' + container.ancre() : '');
    const dejaEmpile = !!(history.state && history.state.panneau && history.state.empile);
    try {
      if (historique === 'ajouter' && !dejaOuvert) history.pushState({ panneau: id, empile: true }, '', adresse);
      else if (historique !== 'aucun') history.replaceState({ panneau: id, empile: dejaEmpile }, '', adresse);
    } catch (e) {}
  }
}
// Bouton précédent/suivant du navigateur : l'écran suit l'entrée d'historique
window.addEventListener('popstate', (e) => {
  const etat = e.state || {};
  if (etat.carte) return;  // carte d'article : le panneau du dessous ne bouge pas
  if (!etat.panneau) { masquerPanneau(); return; }
  const container = document.getElementById('container-' + etat.panneau);
  if (container && openPopover === container) return;  // on referme seulement une carte posée dessus
  if (container) {
    if (etat.panneau === 'favoris') afficherFavoris(getFavorites());
    showPopover(etat.panneau, 'aucun');
    const page = parseInt(new URLSearchParams(location.hash.slice(1)).get('p'), 10) || 1;
    if (container.afficherPage) container.afficherPage(page);
  } else if (!ouvrirDepuisAdresse('aucun')) {
    masquerPanneau();  // panneau disparu (page rechargée) : accueil
  }
});
// Menu de la barre du haut : ouverture au bouton, fermeture au clic dehors.
// aria-expanded suit la classe « open », quel que soit le code qui la change.
const menuNavbar = document.querySelector('.navbar-menu');
const btnMenuNavbar = document.querySelector('.btn-menu');
if (menuNavbar && btnMenuNavbar) {
  new MutationObserver(() => {
    btnMenuNavbar.setAttribute('aria-expanded', String(menuNavbar.classList.contains('open')));
  }).observe(menuNavbar, { attributes: true, attributeFilter: ['class'] });
  btnMenuNavbar.addEventListener('click', () => menuNavbar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    const navbar = document.querySelector('.kioske-navbar');
    if (navbar && !navbar.contains(e.target)) menuNavbar.classList.remove('open');
  });
}

// Fermeture du conteneur d'infos
document.querySelectorAll('[data-close-infos]').forEach(elem => {
  elem.addEventListener('click', (e) => {
    const container = document.getElementById('bloc-infos-container');
    if (container) {
      container.hidden = true;
    }
  });
});
// Panneau des favoris, déjà dans la page : son bouton × et son fond sombre. Les autres panneaux,
// créés par le script, branchent les leurs à la création.
document.querySelector('#favoris .categorie-fermer')?.addEventListener('click', () => closePopover());
document.querySelectorAll('.categorie-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePopover();
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (carteOuverte && !carteOuverte.hidden) {
      fermerCarte();
    } else {
      closePopover();
    }
  }
});
// Carte d'un article dans une grille (panneaux, recherche, favoris). Les textes viennent des flux RSS
// et d'autres sites : ils sont posés avec textContent, jamais interprétés comme du HTML.
function creerCarte({ adresse, image, source, meta, titre, extrait }) {
  const span = (classe, texte) => {
    const s = document.createElement('span');
    s.className = classe;
    if (texte !== undefined) s.textContent = texte || '';
    return s;
  };
  const carte = document.createElement('a');
  carte.href = adresse;
  carte.className = 'carte';
  const cadre = span('carte-image');
  cadre.setAttribute('aria-hidden', 'true');
  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    cadre.appendChild(img);
  } else {
    cadre.appendChild(span('lettre', (source || '').charAt(0).toUpperCase() || '•'));
  }
  const corps = span('carte-corps');
  corps.append(span('meta', meta), span('carte-titre', titre), span('carte-extrait', extrait));
  carte.append(cadre, corps);
  return carte;
}

// Carte d'un article des données de la page ou de l'index (title, summary, date, host, source, image)
function carteArticle(article, adresse) {
  return creerCarte({
    adresse: adresse, image: article.image, source: article.source,
    meta: article.date + ' · ' + article.host, titre: article.title, extrait: article.summary
  });
}

// Identifiant d'un panneau : préfixe (« source- », « cat- ») et nom réduit aux lettres, chiffres et tirets
function idPanneau(prefixe, nom) {
  return prefixe + nom.replace(/[^a-z0-9-]/gi, '_');
}

// Crée un panneau d'articles avec pagination (30 cartes par page). S'il existe déjà, ne fait rien.
//   id       : identifiant du panneau (idPanneau)
//   titre    : titre affiché
//   cle      : clé de la source ou nom de la catégorie
//   articles : les articles, du plus récent au plus ancien
//   ancre    : page => ancre de l'adresse (« source=…&p=2 »)
//   galerie  : true pour afficher, au-dessus des cartes, la galerie des derniers articles en images
function creerPanneauArticles({ id, titre: texteTitre, cle, articles, ancre, galerie: avecGalerie }) {
  const containerId = 'container-' + id;
  if (document.getElementById(containerId)) return;
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.setAttribute('data-close-source', cle);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopover(); });

  const panneau = document.createElement('div');
  panneau.id = id + '-panneau';
  panneau.className = 'categorie-panneau';

  const header = document.createElement('div');
  header.className = 'panneau-entete';

  const titre = document.createElement('h2');
  titre.textContent = texteTitre;
  titre.className = 'panneau-titre';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer fermer-entete';
  fermer.setAttribute('data-article-id', id);
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.addEventListener('click', () => closePopover());

  const grille = document.createElement('div');
  grille.className = 'grille';
  grille.id = id + '-grille';

  // Seule la zone des cartes défile ; l'en-tête et la pagination restent en place
  const grilleContainer = document.createElement('div');
  grilleContainer.className = 'panneau-defilant';
  grilleContainer.appendChild(grille);

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);
  panneau.appendChild(grilleContainer);
  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);

  const articlesPerPage = 30;
  let currentPage = 1;
  const totalPages = Math.ceil(articles.length / articlesPerPage);
  container.ancre = () => ancre(currentPage);
  // Adresse d'un article, avec le retour vers la page affichée du panneau
  const adresseArticle = (article) => article.url + '?from=' + encodeURIComponent('/#' + container.ancre());

  // Galerie : les derniers articles ayant une image, au-dessus de la grille (elle défile avec elle).
  // Même balisage que la galerie de l'accueil.
  let majGalerie = () => {};
  const avecImage = avecGalerie ? articles.filter(a => a.image).slice(0, NB_GALERIE_CATEGORIE) : [];
  if (avecImage.length) {
    const slider = document.createElement('section');
    slider.className = 'galerie-slider galerie-panneau';
    slider.setAttribute('aria-label', 'Derniers articles en images : ' + texteTitre);
    const fleche = (classe, texte, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = classe;
      b.setAttribute('aria-label', label);
      b.textContent = texte;
      return b;
    };
    const galerie = document.createElement('div');
    galerie.className = 'galerie';
    avecImage.forEach(article => {
      const lien = document.createElement('a');
      lien.className = 'galerie-carte';
      lien.title = article.title;
      const img = document.createElement('img');
      img.src = article.image;
      img.alt = article.title;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      lien.appendChild(img);
      galerie.appendChild(lien);
    });
    // L'adresse de retour suit la page affichée dans le panneau
    majGalerie = () => {
      galerie.querySelectorAll('a.galerie-carte').forEach((lien, i) => { lien.href = adresseArticle(avecImage[i]); });
    };
    slider.appendChild(fleche('galerie-arrow-left', '<', 'Défiler vers la gauche'));
    slider.appendChild(galerie);
    slider.appendChild(fleche('galerie-arrow-right', '>', 'Défiler vers la droite'));
    grilleContainer.insertBefore(slider, grille);
    if (typeof brancherGalerie === 'function') brancherGalerie(slider);
  }

  // Pagination
  const paginationContainer = document.createElement('div');
  paginationContainer.className = 'pagination';

  const btnPrecedentes = document.createElement('button');
  btnPrecedentes.type = 'button';
  btnPrecedentes.className = 'pagination-btn';
  btnPrecedentes.textContent = '← Pages précédentes';

  const pageInfo = document.createElement('span');
  pageInfo.className = 'pagination-info';

  const btnSuivantes = document.createElement('button');
  btnSuivantes.type = 'button';
  btnSuivantes.className = 'pagination-btn';
  btnSuivantes.textContent = 'Pages suivantes →';

  function afficherPage(page) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    grille.replaceChildren();
    const start = (currentPage - 1) * articlesPerPage;
    articles.slice(start, start + articlesPerPage).forEach(article => {
      grille.appendChild(carteArticle(article, adresseArticle(article)));
    });

    pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    btnPrecedentes.disabled = currentPage === 1;
    btnSuivantes.disabled = currentPage === totalPages;
    majGalerie();
    if (openPopover === container) majAdresse(container.ancre());
  }
  container.afficherPage = afficherPage;

  btnPrecedentes.addEventListener('click', () => afficherPage(currentPage - 1));
  btnSuivantes.addEventListener('click', () => afficherPage(currentPage + 1));

  paginationContainer.appendChild(btnPrecedentes);
  paginationContainer.appendChild(pageInfo);
  paginationContainer.appendChild(btnSuivantes);
  panneau.appendChild(paginationContainer);

  afficherPage(1);
}

// Panneau des articles d'une source
function createSourcePanel(sourceKey, sourceName) {
  creerPanneauArticles({
    id: idPanneau('source-', sourceKey), titre: sourceName, cle: sourceKey,
    articles: window.sourcesData[sourceKey] || [],
    ancre: page => 'source=' + encodeURIComponent(sourceKey) + '&p=' + page,
    galerie: false
  });
}

// Panneau des articles d'une catégorie, toutes sources mélangées, avec sa galerie
function createCategoryPanel(categoryName) {
  creerPanneauArticles({
    id: idPanneau('cat-', categoryName), titre: categoryName, cle: categoryName,
    articles: window.categoriesData[categoryName] || [],
    ancre: page => 'cat=' + encodeURIComponent(categoryName) + '&p=' + page,
    galerie: true
  });
}

// Crée un panneau de résultats de recherche
function createSearchResultsPanel() {
  if (document.getElementById('container-search-results')) return;
  const container = document.createElement('div');
  container.id = 'container-search-results';
  container.className = 'categorie-container';
  container.hidden = true;
  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.setAttribute('data-close-source', 'search-results');
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopover(); });
  const panneau = document.createElement('div');
  panneau.id = 'search-results-panneau';
  panneau.className = 'categorie-panneau';
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('data-article-id', 'search-results');
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  const titre = document.createElement('h2');
  titre.innerHTML = 'Résultats <span class="compte">(0)</span>';
  const grille = document.createElement('div');
  grille.className = 'grille';
  grille.id = 'search-results-grille';
  panneau.appendChild(fermer);
  panneau.appendChild(titre);
  panneau.appendChild(grille);
  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);
  // Attacher le listener au bouton fermer
  fermer.addEventListener('click', () => closePopover());
}

// Crée un panneau pour afficher le code de conduite
function createConductPanel() {
  if (document.getElementById('container-conduct')) return;
  const container = document.createElement('div');
  container.id = 'container-conduct';
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopover(); });

  const panneau = document.createElement('div');
  panneau.id = 'conduct-panneau';
  panneau.className = 'categorie-panneau conduct-panneau';

  const header = document.createElement('div');
  header.className = 'panneau-entete panneau-entete-ligne';

  const titre = document.createElement('h2');
  titre.textContent = 'Code de conduite du Discord';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.classList.add('fermer-entete');
  fermer.addEventListener('click', () => closePopover());

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);

  const contenuContainer = document.createElement('div');
  contenuContainer.className = 'panneau-defilant';
  contenuContainer.innerHTML = window.conductCode || '<p>Contenu non disponible</p>';
  panneau.appendChild(contenuContainer);

  // Ajouter les boutons de partage
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'panneau-actions';

  const btnShare = document.createElement('button');
  btnShare.type = 'button';
  btnShare.textContent = '📤 Partager';
  btnShare.className = 'panneau-bouton';
  btnShare.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({
        title: 'Code de conduite du Discord',
        url: window.location.href
      }).catch(err => console.log('Partage annulé'));
    } else {
      alert('Le partage n\'est pas disponible sur ce navigateur');
    }
  });

  const btnCopy = document.createElement('button');
  btnCopy.type = 'button';
  btnCopy.textContent = '🔗 Copier le lien';
  btnCopy.className = 'panneau-bouton';
  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const originalText = btnCopy.textContent;
      btnCopy.textContent = '✓ Copié !';
      btnCopy.classList.add('est-copie');
      setTimeout(() => {
        btnCopy.textContent = originalText;
        btnCopy.classList.remove('est-copie');
      }, 2000);
    }).catch(() => {
      alert('Erreur lors de la copie du lien');
    });
  });

  buttonsContainer.appendChild(btnShare);
  buttonsContainer.appendChild(btnCopy);
  panneau.appendChild(buttonsContainer);

  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);
}
// Gestion des tags cliquables (sources)
document.querySelectorAll('.nuage .tag').forEach(tag => {
  tag.addEventListener('click', (e) => {
    const sourceKey = tag.getAttribute('data-source-key');
    const sourceName = tag.getAttribute('data-source-name');
    if (sourceKey && sourceName) {
      createSourcePanel(sourceKey, sourceName);
      const sourceId = idPanneau('source-', sourceKey);
      showPopover(sourceId);
      // Fermer le menu +
      const infosContainer = document.getElementById('bloc-infos-container');
      if (infosContainer) infosContainer.hidden = true;
    }
  });
});

// Gestion des boutons "+ " des catégories
document.querySelectorAll('.tag-categorie').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const categoryName = btn.getAttribute('data-category-name');
    if (categoryName) {
      createCategoryPanel(categoryName);
      const categoryId = idPanneau('cat-', categoryName);
      showPopover(categoryId);
      // Fermer le menu +
      const infosContainer = document.getElementById('bloc-infos-container');
      if (infosContainer) infosContainer.hidden = true;
    }
  });
});

// Barre de recherche
const rechercheInput = document.getElementById('recherche');
function lancerRecherche(texte) {
    const query = (texte || '').toLowerCase().trim();
    if (!query) return;

    // Créer le panneau s'il n'existe pas
    createSearchResultsPanel();

    // Charger l'index JSON et filtrer les articles
    fetch('/articles-index.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(articles => {
        const resultGrid = document.getElementById('search-results-grille');
        if (!resultGrid) {
          console.error('Grille de résultats non trouvée');
          return;
        }
        resultGrid.replaceChildren();

        // Filtrer les articles par query
        const results = articles.filter(article => {
          const searchText = (article.title + ' ' + article.summary + ' ' + article.source).toLowerCase();
          return searchText.includes(query);
        });

        // Créer les cartes au format Pokémon
        results.forEach(article => {
          resultGrid.appendChild(carteArticle(article, article.url));
        });

        if (results.length > 0) {
          const compte = document.querySelector('#search-results-panneau h2 .compte');
          if (compte) {
            compte.textContent = `(${results.length})`;
          }
          showPopover('search-results');
          // Fermer le menu +
          const infosContainer = document.getElementById('bloc-infos-container');
          if (infosContainer) infosContainer.hidden = true;
        } else {
          alert('Aucun résultat trouvé pour: ' + query);
        }
      })
      .catch(err => {
        console.error('Erreur lors du chargement de l\'index:', err);
        alert('Erreur lors de la recherche. Vérifiez votre connexion.');
      });
}
if (rechercheInput) {
  rechercheInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    lancerRecherche(rechercheInput.value);
  });
}

// Au chargement : rouvrir le panneau indiqué par l'adresse, ou lancer la recherche /?q=…
function ouvrirDepuisAdresse(historique = 'remplacer') {
  const ancre = new URLSearchParams(location.hash.slice(1));
  const page = parseInt(ancre.get('p'), 10) || 1;
  const sourceKey = ancre.get('source');
  const categoryName = ancre.get('cat');
  let id = null;
  if (sourceKey && Object.hasOwn(window.sourcesData, sourceKey)) {
    const tag = Array.from(document.querySelectorAll('.nuage .tag'))
      .find(t => t.getAttribute('data-source-key') === sourceKey);
    createSourcePanel(sourceKey, tag ? tag.getAttribute('data-source-name') : sourceKey);
    id = idPanneau('source-', sourceKey);
  } else if (categoryName && Object.hasOwn(window.categoriesData, categoryName)) {
    createCategoryPanel(categoryName);
    id = idPanneau('cat-', categoryName);
  }
  if (id) {
    showPopover(id, historique);
    const container = document.getElementById('container-' + id);
    if (container && container.afficherPage) container.afficherPage(page);
    return true;
  }
  if (historique === 'aucun') return false;
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    if (rechercheInput) rechercheInput.value = q;
    lancerRecherche(q);
  }
}
ouvrirDepuisAdresse();

// Favoris : getFavorites(), saveFavorites(), toggleFavorite() et updateHearts() sont dans favoris.js.

// Adresse venue des favoris enregistrés ou d'un fichier importé : gardée seulement si c'est un chemin
// du site ou une adresse http(s), pour qu'un fichier trafiqué ne puisse pas glisser « javascript: ».
function adresseSure(adresse, defaut = '#') {
  const a = String(adresse || '');
  if (/^\/(?![\/\\])/.test(a) || /^https?:\/\//i.test(a)) return a;
  return defaut;
}

function openFavoritesPanel() {
  // Fermer le menu navbar quand on ouvre le panneau des favoris
  const navbarMenu = document.querySelector('.navbar-menu');
  if (navbarMenu) navbarMenu.classList.remove('open');

  document.getElementById('bloc-infos-container').hidden = true;

  afficherFavoris(getFavorites());
  showPopover('favoris');
  completerFavoris();
}

function afficherFavoris(favorites) {
  const favGrille = document.getElementById('fav-grille');
  favGrille.replaceChildren();

  if (Object.keys(favorites).length === 0) {
    favGrille.innerHTML = '<p class="grille-vide">Aucun favori pour le moment</p>';
    return;
  }
  Object.entries(favorites).forEach(([favKey, data]) => {
    // Carte faite des données enregistrées, qui peuvent être incomplètes (anciens favoris) ou venir
    // d'un fichier importé : l'adresse n'est suivie que si c'est une page du site ou une adresse web.
    favGrille.appendChild(creerCarte({
      adresse: adresseSure(data.url || data.lien),
      image: adresseSure(data.image, ''),
      source: data.source || 'Article',
      meta: [data.date, data.host].filter(x => x).join(' · ') || 'Sans date',
      titre: data.title || data.titre || 'Sans titre',
      extrait: data.summary || ''
    }));
  });
}

// Anciens favoris : seul le lien du site d'origine était enregistré. L'index des articles
// donne la page du KiosKe correspondante (et l'image, la date, le résumé).
function completerFavoris() {
  const favorites = getFavorites();
  const incomplets = Object.entries(favorites)
    .filter(([cle, data]) => !String(data.url || '').startsWith('/articles/'));
  if (incomplets.length === 0) return;
  fetch('/articles-index.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(articles => {
      const parLien = new Map(articles.map(a => [a.link, a]));
      let change = false;
      incomplets.forEach(([cle, data]) => {
        const a = parLien.get(data.lien) || parLien.get(cle);
        if (!a) return;
        favorites[cle] = Object.assign({}, data, {
          title: a.title, titre: a.title, lien: a.link, url: a.url, image: a.image,
          summary: a.summary, date: a.date, host: a.host, source: a.source
        });
        change = true;
      });
      if (!change) return;
      saveFavorites(favorites);
      const conteneur = document.getElementById('container-favoris');
      if (conteneur && !conteneur.hidden) afficherFavoris(favorites);
    })
    .catch(err => console.error('Favoris non complétés :', err));
}

function exportFavorites() {
  const favorites = getFavorites();
  if (Object.keys(favorites).length === 0) {
    alert('Aucun favori à exporter');
    return;
  }
  const data = JSON.stringify(favorites, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kioske-favoris.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importFavorites() {
  const file = document.getElementById('fav-file-input').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const favorites = getFavorites();
      Object.assign(favorites, data);
      saveFavorites(favorites);
      openFavoritesPanel();
      alert('Favoris importés avec succès !');
    } catch (err) {
      alert('Erreur lors de l\'import : format JSON invalide');
    }
  };
  reader.readAsText(file);
}

function clearFavorites() {
  if (confirm('Êtes-vous sûr de vouloir effacer tous vos favoris ?')) {
    localStorage.removeItem('kioske_favoris');
    updateHearts();
    openFavoritesPanel();
  }
}

// Boutons
document.getElementById('fav-export-btn')?.addEventListener('click', exportFavorites);
document.getElementById('fav-file-input')?.addEventListener('change', importFavorites);
// Boutons de la page : ♡ de la barre et « Mes favoris » ouvrent le panneau, « Charger des favoris »
// ouvre le choix de fichier
document.querySelectorAll('.btn-favs, .btn-mes-favoris').forEach(b => b.addEventListener('click', () => openFavoritesPanel()));
document.getElementById('fav-import-btn')?.addEventListener('click', () => document.getElementById('fav-file-input').click());
document.getElementById('fav-clear-btn')?.addEventListener('click', clearFavorites);


// Gestionnaire pour le bouton "Code de conduite"
const btnOpenConduct = document.getElementById('btn-open-conduite');
if (btnOpenConduct) {
  btnOpenConduct.addEventListener('click', () => {
    createConductPanel();
    showPopover('conduct');
    // Fermer le menu
    const menu = document.querySelector('.navbar-menu');
    if (menu) menu.classList.remove('open');
  });
}

