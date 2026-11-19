// Changements du site : la page Mise à jour est relue au chargement. Une première lecture ne notifie rien
// (points connus) ; un point nouveau déclenche une notification et le point rouge ; le panneau affiche la
// mise à jour ; une notification est lue à la fermeture du panneau et disparaît de la liste ; « Tout effacer »
// ne vide que les notifications et les effacées ne reviennent pas. La page est remplacée par une version de test.
const { attendre, charger, suite } = require('./outils');

const page = (points) => '<div class="menu-texte"><ul><li>18/11/2026 :<ul>'
  + points.map(p => '<li>' + p + '</li>').join('') + '</ul></li></ul></div>';

class FauxNotification {
  static get permission() { return 'granted'; }
  static requestPermission() { return Promise.resolve('granted'); }
}

(async () => {
  const t = suite('Changements du site (page Mise à jour)');
  const envoyees = [];

  function chargerAvec(points, stockage) {
    return charger('index.html', '/', {
      avant: (f) => {
        if (stockage) for (const [k, v] of Object.entries(stockage)) f.localStorage.setItem(k, v);
        f.localStorage.setItem('kioske_notif_site', '1');
        f.Notification = class extends FauxNotification {
          constructor(titre, options) { super(); envoyees.push({ titre, corps: options && options.body }); this.close = () => {}; }
        };
        const original = f.fetch;
        f.fetch = (adresse, options) => adresse.includes('mise-a-jours')
          ? Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, text: async () => page(points), json: async () => ({}) })
          : original(adresse, options);
      },
    });
  }
  const stockageDe = (w) => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
  const listeNonLues = (w) => JSON.parse(w.localStorage.getItem('kioske_notifs') || '[]').filter(n => !n.lue);

  // 1. Première lecture : points connus, aucune notification. La cloche reste visible sans flux personnalisé.
  let r = chargerAvec(['Premier point', 'Second point']);
  await attendre(300);
  t.verif('cloche visible sans flux personnalisé', r.d.getElementById('btn-notifications').hidden === false);
  t.verif('première lecture : rien notifié', envoyees.length === 0, '(' + envoyees.length + ')');
  t.verif('première lecture : points mémorisés', JSON.parse(r.w.localStorage.getItem('kioske_maj_vues') || '[]').length === 2);
  const apres1 = stockageDe(r.w);

  // 2. Un point nouveau : une notification, point rouge sur la cloche.
  r = chargerAvec(['Premier point', 'Second point', 'Point ajouté'], apres1);
  await attendre(300);
  t.verif('point nouveau : une notification', envoyees.length === 1 && envoyees[0].titre === 'Mise à jour du site', '(' + envoyees.length + ')');
  t.verif('point nouveau : corps avec le point', !!envoyees[0] && envoyees[0].corps.includes('Point ajouté'));
  t.verif('point nouveau : point rouge sur la cloche', r.d.getElementById('btn-notifications').classList.contains('a-notif'));
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  const apres2 = stockageDe(r.w);

  // 3. Même page au chargement suivant : rien de nouveau, pas de notification de plus.
  r = chargerAvec(['Premier point', 'Second point', 'Point ajouté'], apres2);
  await attendre(300);
  t.verif('page inchangée : pas de nouvelle notification', envoyees.length === 1, '(' + envoyees.length + ')');

  // 4. Ouvrir le panneau : la mise à jour s'affiche, la notification non lue est listée, le point rouge reste.
  r.w.ouvrirPanneauNotifications();
  await attendre(300);
  const contenu = r.d.getElementById('notif-maj-contenu');
  t.verif('panneau : la mise à jour est affichée', !!contenu && contenu.textContent.includes('Point ajouté'));
  t.verif('panneau : la notification non lue est listée', r.d.getElementById('notif-liste').textContent.includes('Point ajouté'));
  t.verif('panneau : case « changements du site » présente', !!r.d.getElementById('notif-site'));

  // 5. Fermer le panneau : la notification est lue, elle disparaît de la liste, le point rouge s'éteint.
  r.w.closePopover();
  await attendre(100);
  t.verif('fermé : la notification est marquée lue', listeNonLues(r.w).length === 0);
  t.verif('fermé : point rouge éteint', !r.d.getElementById('btn-notifications').classList.contains('a-notif'));
  r.w.ouvrirPanneauNotifications();
  await attendre(100);
  t.verif('réouverture : le texte lu n\'est plus affiché', !r.d.getElementById('notif-liste').textContent.includes('Point ajouté') && r.d.getElementById('notif-liste').textContent.includes('Aucune notification non lue'));
  t.verif('réouverture : la mise à jour reste affichée', r.d.getElementById('notif-maj-contenu').textContent.includes('Point ajouté'));
  r.w.closePopover();
  await attendre(50);

  // 6. Un nouveau point, non lu : « Tout effacer » vide la liste, et seulement elle (le flux reste).
  r.w.localStorage.setItem('kioske_flux_personnalise', JSON.stringify({ 'Source garde': true }));
  const apres5 = stockageDe(r.w);
  r = chargerAvec(['Premier point', 'Second point', 'Point ajouté', 'Autre point'], apres5);
  await attendre(300);
  r.w.ouvrirPanneauNotifications();
  await attendre(100);
  t.verif('nouveau point : listé', r.d.getElementById('notif-liste').textContent.includes('Autre point'));
  r.d.getElementById('notif-tout-effacer').click();
  await attendre(150);
  t.verif('tout effacer : liste vide', r.d.getElementById('notif-liste').textContent.includes('Aucune notification non lue'));
  t.verif('tout effacer : le bloc Mises à jour disparaît entièrement', r.d.getElementById('notif-maj').hidden === true);
  t.verif('tout effacer : la mise à jour affichée est effacée aussi', !r.d.getElementById('notif-maj-contenu').textContent.includes('Point ajouté') && !r.d.getElementById('notif-maj-contenu').textContent.includes('Autre point'));
  t.verif('tout effacer : le flux personnalisé est conservé', !!r.w.localStorage.getItem('kioske_flux_personnalise'));
  t.verif('tout effacer : les réglages de notification sont conservés', r.w.localStorage.getItem('kioske_notif_site') === '1');

  // 7. Au chargement suivant, les points effacés ne reviennent pas (ni la notification, ni la mise à jour).
  //    Un point réellement nouveau, lui, s'affiche.
  const apres6 = stockageDe(r.w);
  r = chargerAvec(['Premier point', 'Second point', 'Point ajouté', 'Autre point', 'Dernier point'], apres6);
  await attendre(300);
  t.verif('effacée : notification ne revient pas', listeNonLues(r.w).length === 1 && listeNonLues(r.w)[0].titre === 'Mise à jour du site' && listeNonLues(r.w)[0].texte === 'Dernier point');
  r.w.ouvrirPanneauNotifications();
  await attendre(150);
  const maj = r.d.getElementById('notif-maj-contenu').textContent;
  t.verif('effacée : la mise à jour ne revient pas', !maj.includes('Point ajouté') && !maj.includes('Autre point'));
  t.verif('nouveau point : la mise à jour l\'affiche', maj.includes('Dernier point'));
  t.verif('nouveau point : le bloc redevient visible', r.d.getElementById('notif-maj').hidden === false);

  t.fin();
})();
