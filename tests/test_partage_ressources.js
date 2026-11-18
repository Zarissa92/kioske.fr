// Bouton 📤 des pages Ressources : partage l'adresse de la page (sans paramètre) et son titre.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Partage des pages Ressources');
  const partages = [];
  const { w, d, erreurs } = charger('ressources/discord/index.html', '/ressources/discord/?x=1', {
    avant: (f) => {
      Object.defineProperty(f.navigator, 'share', { configurable: true, value: (donnees) => { partages.push(donnees); return Promise.resolve(); } });
    },
  });
  await attendre(200);
  const bouton = d.querySelector('main .ressources-partage .share-btn');
  t.verif('bouton 📤 présent', !!bouton);
  t.verif('libellé « Partager » sous l\'icône', !!bouton && bouton.querySelector('.partage-libelle')?.textContent === 'Partager');
  t.verif('en bas de page, après le texte', !!bouton && !!d.querySelector('main .ressources-texte ~ .ressources-partage'));
  bouton.click();
  await attendre(30);
  t.verif('partage lancé', partages.length === 1, '(' + partages.length + ')');
  t.verif('adresse de la page, sans paramètre', !!partages[0] && partages[0].url.endsWith('/ressources/discord/'));
  t.verif('titre de la page', !!partages[0] && partages[0].title.includes('Discord'));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
