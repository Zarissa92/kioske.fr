// Accueil : panneaux d'articles (source, catégorie, résultats de recherche), avec pagination et galerie ;
// clics sur les tags de source et les titres de panneau.
function creerPanneauArticles({ id, titre: texteTitre, cle, articles, ancre, galerie: avecGalerie }) {
  const containerId = 'container-' + id;
  if (document.getElementById(containerId)) return;
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
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
      img.src = adresseImage(article.image);
      img.alt = article.title;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => lien.remove(), { once: true });
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
    galerie: !!window.galeriePanneau
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

// Gestion des tags cliquables (sources)
document.querySelectorAll('.nuage .tag').forEach(tag => {
  tag.addEventListener('click', (e) => {
    const sourceKey = tag.getAttribute('data-source-key');
    const sourceName = tag.getAttribute('data-source-name');
    if (sourceKey && sourceName) {
      avecDonneesAccueil(() => {   // donnees_accueil.js : articles chargés au premier panneau ouvert
        createSourcePanel(sourceKey, sourceName);
        showPopover(idPanneau('source-', sourceKey));
      });
    }
  });
});

// Gestion des titres cliquables (panneaux et catégories) pour ouvrir les panneaux
document.querySelectorAll('.titre-panneau').forEach(titre => {
  titre.addEventListener('click', (e) => {
    e.preventDefault();
    const categoryName = titre.getAttribute('data-category-name');
    if (categoryName) {
      avecDonneesAccueil(() => {
        createCategoryPanel(categoryName);
        showPopover(idPanneau('cat-', categoryName));
      });
    }
  });
});
