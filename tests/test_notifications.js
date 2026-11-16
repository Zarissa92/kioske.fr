// Notifications des flux personnalisés : cloche selon le flux, désactivées par défaut, activation sans
// inondation, notification seulement pour les sources cochées, arrêt à la désactivation.
// L'API Notification du navigateur est remplacée par un faux (jsdom ne l'a pas).
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Notifications des flux personnalisés');
  const envoyees = [];
  let permission = 'default';
  let demandes = 0;
  class FauxNotification {
    constructor(titre, options) { envoyees.push({ titre, corps: options && options.body }); this.close = () => {}; }
    static get permission() { return permission; }
    static requestPermission() { demandes++; permission = 'granted'; return Promise.resolve('granted'); }
  }

  let index = [];
  const { w, d, erreurs } = charger('index.html', '/', {
    avant: (f) => { f.Notification = FauxNotification; },
    index: () => index,
  });
  await attendre(300);

  // Clé d'une source d'après le début de son nom (certains noms de flux sont longs)
  const nomDe = (debut) => Object.keys(w.sourcesMetadata).find(k => w.sourcesMetadata[k].name.startsWith(debut));
  const nomDefer = w.sourcesMetadata[nomDe('La Déferlante')].name;
  const nomProb = w.sourcesMetadata[nomDe('Problematik')].name;
  const nomPink = w.sourcesMetadata[nomDe('PinkNews')].name;
  const cloche = d.getElementById('btn-notifications');

  t.verif('sans flux personnalisé : cloche masquée', cloche.hidden === true);

  w.saveCustomFluxSources({ [nomDe('La Déferlante')]: true, [nomDe('Problematik')]: true });
  t.verif('flux personnalisé choisi : cloche visible', cloche.hidden === false);
  t.verif('désactivées par défaut', w.localStorage.getItem('kioske_notifications') !== '1');

  index = [
    { link: 'a1', title: 'Ancien article', source: nomDefer },
    { link: 'p1', title: 'Ancien Problematik', source: nomProb },
    { link: 'k1', title: 'Ancien PinkNews', source: nomPink },
  ];
  const resultat = await w.activerNotifications();
  t.verif('activation : autorisation accordée', resultat === 'granted' && demandes === 1);
  t.verif('activation : rien d\'envoyé pour l\'existant', envoyees.length === 0, '(' + envoyees.length + ')');

  index = index.concat([{ link: 'a2', title: 'Nouvel article déférlante', source: nomDefer }]);
  await w.verifierNouveautes();
  t.verif('nouvel article d\'une source cochée : une notification', envoyees.length === 1 && envoyees[0].corps.includes('Nouvel article déférlante'), '(' + envoyees.length + ')');

  index = index.concat([{ link: 'k2', title: 'Nouvel article PinkNews', source: nomPink }]);
  await w.verifierNouveautes();
  t.verif('source non cochée : aucune notification', envoyees.length === 1);

  w.desactiverNotifications();
  index = index.concat([{ link: 'a3', title: 'Après désactivation', source: nomDefer }]);
  await w.verifierNouveautes();
  t.verif('désactivées : plus rien n\'est envoyé', envoyees.length === 1);

  // Clic sur la cloche : le panneau s'ouvre, avec l'explication et la case (décochée, désactivé)
  cloche.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await attendre(50);
  const panneau = d.getElementById('container-notifications');
  t.verif('clic sur la cloche : panneau ouvert', !!panneau && !panneau.hidden);
  t.verif('panneau : explication « désactivées par défaut »', !!panneau && panneau.textContent.includes('Désactivées par défaut'));
  t.verif('panneau : case décochée', d.getElementById('notif-activer').checked === false);

  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();   // arrête les minuteries de la page
  t.fin();
})();
