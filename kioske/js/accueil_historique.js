// Accueil : panneaux ouverts et adresse. Un panneau ouvert ajoute une entrée d'historique ; le bouton
// précédent du navigateur le referme (popstate). Le popover ouvert est mémorisé dans openPopover.
// Script de l'accueil : menu ≡, panneaux d'articles (source, catégorie, recherche, favoris), barre de
// recherche et adresse des panneaux (#source=…, #cat=…, &p=…). Les favoris (lecture, sauvegarde, cœur)
// sont dans favoris.js ; la carte d'article ouverte, dans carte_ouverte.js.
// Popover ouvert (un seul à la fois), ou null.
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
