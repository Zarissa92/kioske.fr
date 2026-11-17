// Accueil : barre de recherche. Le résultat ouvre le panneau « Résultats » (index des articles en JSON).
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

      // Filtrer les articles par query (tous les termes)
      const terms = query.split(/\s+/).filter(t => t.length > 0);
      const results = articles.filter(article => {
        const searchText = (article.title + ' ' + article.summary + ' ' + article.source).toLowerCase();
        return terms.every(term => searchText.includes(term));
      });

      // Une carte par résultat
      results.forEach(article => {
        resultGrid.appendChild(carteArticle(article, article.url));
      });

      if (results.length > 0) {
        const compte = document.querySelector('#search-results-panneau h2 .compte');
        if (compte) {
          compte.textContent = `(${results.length})`;
        }
        showPopover('search-results');
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
const formRecherche = document.getElementById('form-recherche');
if (formRecherche) {
  formRecherche.addEventListener('submit', (e) => {
    e.preventDefault();
    lancerRecherche(rechercheInput?.value || '');
  });
}
