// Mode sobre, depuis la page Paramètres (bouton data-reglage="sobre") : activé, mémorisé, libellé à jour.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Mode sobre (page Paramètres)');
  const { w, d, erreurs } = charger('menu/parametres/index.html', '/menu/parametres/');
  await attendre(200);
  const bouton = d.querySelector('main [data-reglage="sobre"]');
  t.verif('bouton présent sur la page', !!bouton);
  t.verif('désactivé par défaut', !!bouton && bouton.getAttribute('aria-pressed') === 'false' && d.documentElement.dataset.sobre !== 'oui');
  bouton.click();
  await attendre(30);
  t.verif('activé : attribut sobre sur <html>', d.documentElement.dataset.sobre === 'oui');
  t.verif('activé : bouton annonce l\'état', bouton.getAttribute('aria-pressed') === 'true' && bouton.textContent.includes('activé'));
  t.verif('activé : mémorisé', w.localStorage.getItem('kioske-sobre') === '1');
  bouton.click();
  await attendre(30);
  t.verif('désactivé : attribut sobre retiré', d.documentElement.dataset.sobre !== 'oui');
  t.verif('désactivé : mémorisé', w.localStorage.getItem('kioske-sobre') === '0');
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
