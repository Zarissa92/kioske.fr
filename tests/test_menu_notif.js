// Nouveau document dans le Menu : une notification effaçable. Première lecture silencieuse ; un document
// ajouté au sommaire est notifié ; « Tout effacer » l'enlève, et il ne revient pas.
const fs = require('fs');
const path = require('path');
const { attendre, charger, suite } = require('./outils');

const SOMMAIRE = fs.readFileSync(path.join(__dirname, '..', 'build', 'menu', 'index.html'), 'utf8');

function chargerAvec(extra, stockage, actif = true) {
  return charger('index.html', '/', {
    avant: (f) => {
      if (stockage) for (const [k, v] of Object.entries(stockage)) f.localStorage.setItem(k, v);
      if (!stockage || !('kioske_notif_site' in stockage)) f.localStorage.setItem('kioske_notif_site', actif ? '1' : '0');
      const original = f.fetch;
      f.fetch = (adresse, options) => adresse === '/menu/'
        ? Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, text: async () => SOMMAIRE.replace('</body>', extra + '</body>'), json: async () => ({}) })
        : original(adresse, options);
    },
  });
}
const stockageDe = (w) => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const notifsMenu = (w) => JSON.parse(w.localStorage.getItem('kioske_notifs') || '[]').filter(n => n.type === 'menu');

(async () => {
  const t = suite('Nouveau document dans le Menu');
  const nouveau = '<a href="/menu/nouveau-document/">Nouveau document</a>';

  // Sans « changements du site » activé : rien n'est lu ni notifié
  let r = chargerAvec('<a href="/menu/nouveau-document/">Nouveau document</a>', null, false);
  await attendre(300);
  t.verif('désactivé : aucune notification', notifsMenu(r.w).length === 0);
  t.verif('désactivé : le Menu n\'est pas lu', r.w.localStorage.getItem('kioske_menu_vues') === null);
  r.w.close();

  r = chargerAvec('');
  await attendre(300);
  t.verif('première lecture : aucune notification', notifsMenu(r.w).length === 0);
  t.verif('première lecture : documents mémorisés', JSON.parse(r.w.localStorage.getItem('kioske_menu_vues') || '[]').length > 0);
  t.verif('la page Mise à jour n\'est pas comptée', !JSON.parse(r.w.localStorage.getItem('kioske_menu_vues') || '[]').some(h => h.includes('mise-a-jours')));
  const apres1 = stockageDe(r.w);

  r = chargerAvec(nouveau, apres1);
  await attendre(300);
  t.verif('nouveau document : une notification', notifsMenu(r.w).length === 1, '(' + notifsMenu(r.w).length + ')');
  t.verif('nouveau document : titre et texte', notifsMenu(r.w)[0] && notifsMenu(r.w)[0].titre === 'Nouveau dans Menu' && notifsMenu(r.w)[0].texte === 'Nouveau document');
  t.verif('nouveau document : point rouge', r.d.getElementById('btn-notifications').classList.contains('a-notif'));
  const apres2 = stockageDe(r.w);

  // Tout effacer : la notification disparaît et ne revient pas au chargement suivant
  r.w.ouvrirPanneauNotifications();
  await attendre(100);
  r.d.getElementById('notif-tout-effacer').click();
  await attendre(150);
  t.verif('tout effacer : la notification est partie', notifsMenu(r.w).length === 0);
  const apres3 = stockageDe(r.w);
  r = chargerAvec(nouveau, apres3);
  await attendre(300);
  t.verif('effacée : ne revient pas', notifsMenu(r.w).length === 0, '(' + notifsMenu(r.w).length + ')');
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));

  // Navigateur d'avant le renommage : ancienne clé kioske_ressources_vues, adresses /ressources/… : pas « nouveaux »
  const anciens = JSON.parse(apres1.kioske_menu_vues).map(h => h.replace(/^\/menu\//, '/ressources/'));
  const ancienStockage = Object.assign({}, apres1, { kioske_ressources_vues: JSON.stringify(anciens) });
  delete ancienStockage.kioske_menu_vues;
  r = chargerAvec('', ancienStockage);
  await attendre(300);
  t.verif('ancienne clé : aucune notification', notifsMenu(r.w).length === 0, '(' + notifsMenu(r.w).length + ')');
  t.verif('ancienne clé : adresses reprises sous /menu/',
    JSON.parse(r.w.localStorage.getItem('kioske_menu_vues') || '[]').length === anciens.length
    && JSON.parse(r.w.localStorage.getItem('kioske_menu_vues')).every(h => h.startsWith('/menu/')));
  t.verif('ancienne clé : effacée', r.w.localStorage.getItem('kioske_ressources_vues') === null);
  t.fin();
})();
