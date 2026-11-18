// « Tout effacer » sur la vraie page construite (pas de fetch simulé) : même sans notification non lue,
// il efface la mise à jour affichée, qui ne revient pas à la réouverture.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Tout effacer : bloc Mises à jour sans notification non lue');
  const { w, d, erreurs } = charger('index.html', '/', {
    avant: (f) => {
      f.localStorage.setItem('kioske_notif_site', '1');
      f.Notification = class { static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
    },
  });
  await attendre(400);
  w.ouvrirPanneauNotifications();
  await attendre(300);
  t.verif('panneau : la mise à jour est affichée', d.querySelectorAll('#notif-maj-contenu li').length > 0);
  t.verif('bouton « Tout effacer » actif', !d.getElementById('notif-tout-effacer').disabled);
  d.getElementById('notif-tout-effacer').click();
  await attendre(300);
  t.verif('après « Tout effacer » : bloc masqué', d.getElementById('notif-maj').hidden === true);
  t.verif('après « Tout effacer » : aucun point affiché', d.querySelectorAll('#notif-maj-contenu li').length === 0);
  w.closePopover();
  await attendre(100);
  w.ouvrirPanneauNotifications();
  await attendre(300);
  t.verif('réouverture : le bloc reste masqué', d.getElementById('notif-maj').hidden === true);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
