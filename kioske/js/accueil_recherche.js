// Accueil : barre de recherche. Le résultat ouvre le panneau « Résultats » (index des articles en JSON).
// Deux façons de chercher :
//  - Entrée ou la loupe : recherche immédiate ;
//  - en direct : pendant la frappe, après une courte pause (RECHERCHE_PAUSE), dès RECHERCHE_MIN caractères.
// L'index n'est chargé qu'une fois par page (indexArticles), pas à chaque lettre tapée.
const rechercheInput = document.getElementById('recherche');
const RECHERCHE_MIN = 2;        // caractères avant la recherche en direct
const RECHERCHE_PAUSE = 300;    // ms sans frappe avant la recherche en direct
let indexArticles = null;       // promesse de la liste des articles (null : pas encore chargée, ou échec)
let minuterieRecherche = null;

function chargerIndexArticles() {
  if (!indexArticles) {
    indexArticles = fetch('/articles-index.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch(err => { indexArticles = null; throw err; });  // un échec n'est pas gardé : on réessaiera
  }
  return indexArticles;
}

// Le panneau des résultats s'ouvre sous la barre du haut : le champ reste visible et utilisable
// pendant la recherche en direct (sinon le fond sombre du panneau le recouvre).
function placerSousLaBarre(container) {
  const barre = document.querySelector('.kioske-navbar');
  if (!container || !barre) return;
  container.style.top = Math.max(0, Math.round(barre.getBoundingClientRect().bottom)) + 'px';
}

function messageRecherche(grille, texte) {
  const p = document.createElement('p');
  p.className = 'recherche-message';
  p.textContent = texte;
  grille.appendChild(p);
}

function lancerRecherche(texte) {
  const query = (texte || '').toLowerCase().trim();
  if (!query) return;

  createSearchResultsPanel();

  chargerIndexArticles()
    .then(articles => {
      const resultGrid = document.getElementById('search-results-grille');
      if (!resultGrid) {
        console.error('Grille de résultats non trouvée');
        return;
      }
      // La saisie a changé pendant le chargement : ce résultat est déjà périmé
      if (rechercheInput && rechercheInput.value.toLowerCase().trim() !== query && document.activeElement === rechercheInput) return;
      resultGrid.replaceChildren();

      // Filtrer les articles par query (tous les termes)
      const terms = query.split(/\s+/).filter(t => t.length > 0);
      const results = articles.filter(article => {
        const searchText = (article.title + ' ' + article.summary + ' ' + article.source).toLowerCase();
        return terms.every(term => searchText.includes(term));
      });

      results.forEach(article => {
        resultGrid.appendChild(carteArticle(article, article.url));
      });
      if (!results.length) messageRecherche(resultGrid, 'Aucun résultat pour « ' + texte.trim() + ' ».');

      const compte = document.querySelector('#search-results-panneau h2 .compte');
      if (compte) compte.textContent = `(${results.length})`;
      const container = document.getElementById('container-search-results');
      placerSousLaBarre(container);
      showPopover('search-results');
    })
    .catch(err => {
      console.error('Erreur lors du chargement de l\'index:', err);
      const resultGrid = document.getElementById('search-results-grille');
      if (!resultGrid) return;
      resultGrid.replaceChildren();
      messageRecherche(resultGrid, 'Recherche impossible pour le moment. Vérifiez votre connexion.');
      placerSousLaBarre(document.getElementById('container-search-results'));
      showPopover('search-results');
    });
}

function rechercheOuverte() {
  const container = document.getElementById('container-search-results');
  return !!container && !container.hidden;
}

if (rechercheInput) {
  rechercheInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(minuterieRecherche);
    lancerRecherche(rechercheInput.value);
  });
  // Recherche en direct
  rechercheInput.addEventListener('input', () => {
    clearTimeout(minuterieRecherche);
    const texte = rechercheInput.value.trim();
    if (!texte) {                       // champ vidé : le panneau des résultats se ferme
      if (rechercheOuverte()) closePopover();
      return;
    }
    if (texte.length < RECHERCHE_MIN) return;
    minuterieRecherche = setTimeout(() => lancerRecherche(rechercheInput.value), RECHERCHE_PAUSE);
  });
  // Premier clic dans le champ : l'index se charge en avance, la première recherche est immédiate
  rechercheInput.addEventListener('focus', () => { chargerIndexArticles().catch(() => {}); }, { once: true });
}
const formRecherche = document.getElementById('form-recherche');
if (formRecherche) {
  formRecherche.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(minuterieRecherche);
    lancerRecherche(rechercheInput?.value || '');
  });
}
