// Fermeture des panneaux et de la carte sur l'accueil : ×, double appui, Échap, fond sombre, bouton
// précédent. Aucune fermeture ne doit remonter l'historique plus loin que l'accueil.
const { attendre, charger, clic, touche, panneauOuvert, poserHistorique, surAccueil, suite } = require('./outils');

(async () => {
  const t = suite('Fermeture des panneaux et de la carte');
  const { w, d, erreurs } = charger('index.html', '/');
  await attendre(300);
  poserHistorique(w);
  const btnCat = d.querySelector('.tag-categorie');
  const croix = () => panneauOuvert(d).querySelector('.categorie-fermer');

  clic(w, btnCat); await attendre();
  t.verif('le bouton + ouvre le panneau de la catégorie', panneauOuvert(d) && w.history.state.panneau);
  clic(w, croix()); await attendre();
  t.verif('× : retour à l\'accueil, pas plus loin', !panneauOuvert(d) && surAccueil(w));

  clic(w, btnCat); await attendre();
  const x = croix(); clic(w, x); clic(w, x); await attendre();
  t.verif('double appui sur × : une seule entrée remontée', !panneauOuvert(d) && surAccueil(w));

  const tag = d.querySelector('.nuage .tag');
  clic(w, tag); await attendre();
  t.verif('une étiquette ouvre le panneau de la source', panneauOuvert(d) && panneauOuvert(d).id.startsWith('container-source-'));
  clic(w, croix()); await attendre();
  t.verif('× du panneau de source', !panneauOuvert(d) && surAccueil(w));

  clic(w, btnCat); await attendre();
  const idCat = panneauOuvert(d).id;
  clic(w, tag); await attendre();
  clic(w, croix()); await attendre();
  t.verif('× d\'une source ouverte par-dessus une catégorie : revient à la catégorie', panneauOuvert(d) && panneauOuvert(d).id === idCat);

  const lien = panneauOuvert(d).querySelector('a.carte');
  clic(w, lien); await attendre(300);
  const carte = d.querySelector('.carte-ouverte');
  t.verif('un clic sur une carte ouvre l\'article', carte && !carte.hidden && w.history.state.carte);
  const retour = carte.querySelector('.btn-retour');
  clic(w, retour); clic(w, retour); await attendre();
  t.verif('double appui sur « ← Retour » : le panneau est toujours là', carte.hidden && panneauOuvert(d) && panneauOuvert(d).id === idCat);
  clic(w, lien); await attendre(300);
  clic(w, d.querySelector('.carte-ouverte-fond')); await attendre();
  t.verif('clic sur le fond de la carte', carte.hidden && panneauOuvert(d) && panneauOuvert(d).id === idCat);
  clic(w, lien); await attendre(300);
  touche(w, 'Escape'); await attendre();
  t.verif('Échap ferme la carte, pas le panneau', carte.hidden && panneauOuvert(d) && panneauOuvert(d).id === idCat);
  clic(w, croix()); await attendre();
  t.verif('× de la catégorie après la carte', !panneauOuvert(d) && surAccueil(w));

  clic(w, btnCat); await attendre();
  touche(w, 'Escape'); await attendre();
  t.verif('Échap ferme le panneau', !panneauOuvert(d) && surAccueil(w));
  clic(w, btnCat); await attendre();
  clic(w, panneauOuvert(d).querySelector('.categorie-backdrop')); await attendre();
  t.verif('clic sur le fond sombre', !panneauOuvert(d) && surAccueil(w));

  clic(w, d.querySelector('.btn-favs')); await attendre();
  t.verif('♡ de la barre ouvre « Mes favoris »', panneauOuvert(d) && panneauOuvert(d).id === 'container-favoris');
  clic(w, d.querySelector('#favoris .categorie-fermer')); await attendre();
  t.verif('× des favoris', !panneauOuvert(d) && surAccueil(w));

  clic(w, btnCat); await attendre();
  w.history.back(); await attendre();
  t.verif('bouton précédent du navigateur', !panneauOuvert(d) && surAccueil(w));

  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();
})();
