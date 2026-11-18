// Barre du haut : le bouton ⚙️ (menu) est retiré. Le bouton « Accueil » (➕) reste à droite, vers /ressources/.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Barre : bouton Menu, sans menu ⚙️');
  const { w, d, erreurs } = charger('index.html', '/');
  await attendre(200);
  t.verif('plus de bouton ⚙️ dans la barre', !d.getElementById('btn-menu'));
  t.verif('plus de menu déroulant dans la barre', !d.getElementById('navbar-menu'));
  const accueil = d.querySelector('.navbar-controls .btn-plus');
  t.verif('bouton « Menu » présent', !!accueil && accueil.getAttribute('aria-label') === 'Menu');
  t.verif('bouton « Menu » : lien vers /ressources/', !!accueil && accueil.getAttribute('href') === '/ressources/');
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
