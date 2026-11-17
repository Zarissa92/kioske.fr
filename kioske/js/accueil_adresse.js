// Accueil : au chargement, rouvre le panneau indiqué par l'adresse (#source=…, #cat=…, &p=…) ou lance la
// recherche ?q=…
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
