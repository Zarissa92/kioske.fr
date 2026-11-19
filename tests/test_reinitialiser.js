// Bouton « Tout remettre par défaut » (page Paramètres) : deux clics, les réglages sont effacés, les favoris
// et les notifications reçues restent.
const { attendre, charger, suite } = require('./outils');

const REGLAGES = {
  'kioske-theme': 'trans', 'kioske-sobre': '1', 'kioske-galerie-plus-lus': '0', 'kioske-grande-galerie': '1',
  'kioske-galeries-blocs': '1', 'kioske_flux_personnalise': '{"a":true}', 'kioske_flux_connus': '["a"]',
  'kioske_notifications': '1', 'kioske_notif_site': '1',
};
const DONNEES = {
  kioske_favoris: '[{"url":"/articles/x/","title":"Un favori"}]', kioske_notifs: '[{"id":"maj:x"}]',
  kioske_menu_vues: '["/menu/discord/"]', kioske_maj_vues: '["point"]', kioske_flux_annonces: '["a"]',
};

(async () => {
  const t = suite('Tout remettre par défaut (page Paramètres)');
  let recharge = 0;
  const r = charger('menu/parametres/index.html', '/menu/parametres/', {
    avant: (w) => {
      for (const [k, v] of Object.entries({ ...REGLAGES, ...DONNEES })) w.localStorage.setItem(k, v);
    },
  });
  await attendre(200);
  const bouton = r.d.querySelector('[data-reglage="reinitialiser"]');
  // Données telles que la page les a laissées au chargement (les notifications du site peuvent en ajouter)
  const avant = Object.fromEntries(Object.keys(DONNEES).map(k => [k, r.w.localStorage.getItem(k)]));
  t.verif('bouton présent', !!bouton);
  // jsdom ne recharge pas la page : location.reload est remplacé pour compter l'appel
  try { Object.defineProperty(r.w.location, 'reload', { value: () => { recharge++; } }); } catch (e) {}
  bouton.click();
  await attendre(30);
  t.verif('premier clic : demande de confirmation, rien d\'effacé',
    /Confirmer/.test(bouton.textContent) && r.w.localStorage.getItem('kioske-theme') === 'trans');
  bouton.click();
  await attendre(30);
  t.verif('second clic : réglages effacés', Object.keys(REGLAGES).every(k => r.w.localStorage.getItem(k) === null),
    Object.keys(REGLAGES).filter(k => r.w.localStorage.getItem(k) !== null).join(', '));
  t.verif('favoris gardés', r.w.localStorage.getItem('kioske_favoris') === DONNEES.kioske_favoris);
  t.verif('notifications et éléments vus gardés',
    Object.keys(DONNEES).every(k => r.w.localStorage.getItem(k) === avant[k]),
    Object.keys(DONNEES).filter(k => r.w.localStorage.getItem(k) !== avant[k]).map(k => k + '=' + r.w.localStorage.getItem(k)).join(' | '));
  t.verif('aucune erreur JavaScript', r.erreurs.filter(e => !/reload|navigation/i.test(e)).length === 0, r.erreurs.join(' | '));
  t.fin();
})();
