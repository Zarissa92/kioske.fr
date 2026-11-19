// Ajout aux favoris : le ♡ pulse et des étoiles jaillissent (animerAjout, favoris.js). Pas d'animation au retrait,
// ni en mode sobre, ni quand le système demande de réduire les animations.
const fs = require('fs');
const path = require('path');
const { attendre, charger, clic, suite } = require('./outils');

const dossier = path.join(__dirname, '..', 'build', 'articles');
const art = fs.readdirSync(dossier).find(d => fs.existsSync(path.join(dossier, d, 'index.html')));
const chemin = '/articles/' + art + '/';
const etoiles = (d) => d.querySelectorAll('.etoiles .etoile').length;

(async () => {
  const t = suite('Cœur des favoris : animation à l\'ajout');
  let r = charger('articles/' + art + '/index.html', chemin);
  await attendre(300);
  const coeur = r.d.querySelector('.fav-heart');
  t.verif('ajout : étoiles jaillissent', (clic(r.w, coeur), true) && etoiles(r.d) === 6, '(' + etoiles(r.d) + ')');
  t.verif('ajout : le cœur pulse', coeur.classList.contains('coeur-anime'));
  await attendre(1000);
  t.verif('étoiles retirées après l\'animation', etoiles(r.d) === 0);
  t.verif('cœur : classe d\'animation retirée', !coeur.classList.contains('coeur-anime'));
  clic(r.w, coeur); await attendre(50);
  t.verif('retrait : aucune étoile', etoiles(r.d) === 0);
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  r.w.close();

  r = charger('articles/' + art + '/index.html', chemin, { avant: (w) => w.localStorage.setItem('kioske-sobre', '1') });
  await attendre(300);
  clic(r.w, r.d.querySelector('.fav-heart')); await attendre(50);
  t.verif('mode sobre : aucune étoile', etoiles(r.d) === 0);
  r.w.close();

  r = charger('articles/' + art + '/index.html', chemin, { avant: (w) => {
    w.matchMedia = () => ({ matches: true, addEventListener() {}, addListener() {} }); } });
  await attendre(300);
  clic(r.w, r.d.querySelector('.fav-heart')); await attendre(50);
  t.verif('réduire les animations : aucune étoile', etoiles(r.d) === 0);
  r.w.close();
  t.fin();
})();
