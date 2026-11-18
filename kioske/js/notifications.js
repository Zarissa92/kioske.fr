// Notifications. Désactivées par défaut ; la cloche est toujours là (barre du haut). Deux types :
//  - les nouveaux flux ajoutés au site (si un flux personnalisé est choisi) ;
//  - les changements du site : nouveaux points de la page Mise à jour (ressources/Mises_à_jours.md).
// Le site n'a pas de serveur qui pousse les nouveautés : les notifications arrivent pendant que le site
// est ouvert (dans un onglet ou dans l'app installée). Rien ne passe par un service tiers.
//
// Les notifications d'articles sont gardées dans ce fichier, désactivées : NOTIF_ARTICLES = true les remet en service.

const NOTIF_ARTICLES = false;                        // notifications des nouveaux articles (en pause)

const NOTIF_ACTIVEES_KEY = 'kioske_notifications';   // « 1 » si l'utilisateur veut les nouveaux flux
const NOTIF_SITE_KEY = 'kioske_notif_site';          // « 1 » si l'utilisateur veut les changements du site
const MAJ_URL = '/ressources/mise-a-jours/';         // page Mise à jour, construite par le build
const MAJ_VUES_KEY = 'kioske_maj_vues';              // points de la page Mise à jour déjà connus
const MAJ_EFFACEES_KEY = 'kioske_maj_effacees';      // points effacés avec « Tout effacer » : ils ne reviennent pas
const RESSOURCES_URL = '/ressources/';               // sommaire de la page Ressources (documents et catégories)
const RESSOURCES_VUES_KEY = 'kioske_ressources_vues'; // documents Ressources déjà connus
const NOTIF_VUES_KEY = 'kioske_notifications_vues';  // adresses des articles déjà vus (articles, en pause)
const NOTIF_INTERVALLE = 30 * 60 * 1000;             // ms entre deux vérifications (articles, en pause)
const NOTIF_MAX_VUES = 5000;                         // au-delà, les plus anciennes sont oubliées
let notifTimer = null;

function notificationsActivees() {
  try { return localStorage.getItem(NOTIF_ACTIVEES_KEY) === '1'; } catch (e) { return false; }
}

function setNotificationsActivees(on) {
  try { localStorage.setItem(NOTIF_ACTIVEES_KEY, on ? '1' : '0'); } catch (e) {}
}

function siteNotifActive() {
  try { return localStorage.getItem(NOTIF_SITE_KEY) === '1'; } catch (e) { return false; }
}

function setSiteNotifActive(on) {
  try { localStorage.setItem(NOTIF_SITE_KEY, on ? '1' : '0'); } catch (e) {}
}

function lireTableau(cle) {
  try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch (e) { return []; }
}

function ecrireTableau(cle, valeurs) {
  try { localStorage.setItem(cle, JSON.stringify(valeurs)); } catch (e) {}
}

function lireArticlesVus() {
  return new Set(lireTableau(NOTIF_VUES_KEY));
}

function ecrireArticlesVus(ensemble) {
  ecrireTableau(NOTIF_VUES_KEY, [...ensemble].slice(-NOTIF_MAX_VUES));
}

function permissionNotifications() {
  return ('Notification' in window) ? Notification.permission : 'indisponible';
}

// Noms des sources cochées dans le flux personnalisé (les articles de l'index ne portent que le nom).
function nomsSourcesChoisies() {
  const choix = getCustomFluxSources();
  const noms = new Set();
  Object.keys(choix).forEach(cle => {
    if (choix[cle] && window.sourcesMetadata && window.sourcesMetadata[cle]) {
      noms.add(window.sourcesMetadata[cle].name);
    }
  });
  return noms;
}

// Notification système d'articles (en pause tant que NOTIF_ARTICLES est faux).
function afficherNotification(nouveaux) {
  const titre = nouveaux.length === 1 ? 'Nouvel article dans tes flux'
    : nouveaux.length + ' nouveaux articles dans tes flux';
  const corps = nouveaux.slice(0, 3).map(a => a.title).join('\n');
  const options = { body: corps, tag: 'kioske-flux', icon: '/icon-192.png' };
  try {
    const n = new Notification(titre, options);
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) {
    // Certains navigateurs (téléphones, app installée) n'acceptent que celles du service worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then(r => { if (r) r.showNotification(titre, options); });
    }
  }
}

// Envoie une notification système ; au clic, ouvre le panneau des notifications (où s'affiche la mise à jour).
function envoyerNotification(titre, corps, tag) {
  if (permissionNotifications() !== 'granted') return;
  const options = { body: corps, tag: tag, icon: '/icon-192.png' };
  try {
    const n = new Notification(titre, options);
    n.onclick = () => { window.focus(); n.close(); ouvrirPanneauNotifications(); };
  } catch (e) {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then(r => { if (r) r.showNotification(titre, options); });
    }
  }
}

// Notification système quand une source nouvelle entre dans le site (appelée par flux_personnalise.js).
// Seulement si l'utilisateur a activé les notifications des nouveaux flux ; sinon le bandeau de la page suffit.
function notifierNouvellesSources(noms) {
  if (!notificationsActivees()) return;
  const titre = noms.length === 1 ? 'Nouveau flux ajouté' : noms.length + ' nouveaux flux ajoutés';
  envoyerNotification(titre, noms.slice(0, 3).join('\n'), 'kioske-nouveaux-flux');
}

// Page Mise à jour : les points (éléments de liste sans sous-élément) et le contenu HTML de la zone de texte.
async function chargerMisesAJour() {
  const html = await fetch(MAJ_URL, { cache: 'no-cache' }).then(r => r.text());
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const zone = doc.querySelector('.ressources-texte');
  if (!zone) return null;
  const points = [...zone.querySelectorAll('li')]
    .filter(li => !li.querySelector('li'))
    .map(li => li.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { html: zone.innerHTML, points };
}

// Vérifie la page Mise à jour. « baseline » : tout ce qui existe est considéré comme connu, sans notifier
// (à l'activation). Un point nouveau : point rouge sur la cloche et notification système.
async function verifierMisesAJour(baseline = false) {
  if (!siteNotifActive() || permissionNotifications() !== 'granted') return;
  let maj;
  try { maj = await chargerMisesAJour(); } catch (e) { return; }
  if (!maj) return;
  const connus = lireTableau(MAJ_VUES_KEY);
  const nouveaux = (baseline || connus.length === 0) ? [] : maj.points.filter(p => !connus.includes(p));
  ecrireTableau(MAJ_VUES_KEY, maj.points);
  nouveaux.forEach(p => ajouterNotif('maj:' + p, 'maj', 'Mise à jour du site', p, MAJ_URL));
  if (nouveaux.length) {
    envoyerNotification('Mise à jour du site', nouveaux.slice(0, 3).join('\n'), 'kioske-maj');
  }
}

// Affiche la page Mise à jour dans le panneau, sans les points effacés (« Tout effacer »).
async function afficherMisesAJour() {
  const zone = document.getElementById('notif-maj-contenu');
  const bloc = document.getElementById('notif-maj');
  if (!zone || !bloc) return;
  let maj;
  try {
    maj = await chargerMisesAJour();
  } catch (e) {
    bloc.hidden = false;
    zone.textContent = 'Impossible de charger les mises à jour pour le moment.';
    return;
  }
  if (!maj) {
    bloc.hidden = true;   // rien à montrer : le bloc entier (titre compris) disparaît
    zone.textContent = '';
    return;
  }
  const effacees = lireTableau(MAJ_EFFACEES_KEY);
  const contenu = document.createElement('div');
  contenu.innerHTML = maj.html;
  const parents = [...contenu.querySelectorAll('li')].filter(li => li.querySelector('li'));
  contenu.querySelectorAll('li').forEach(li => {
    if (!li.querySelector('li') && effacees.includes(li.textContent.replace(/\s+/g, ' ').trim())) li.remove();
  });
  // Un groupe (date) dont tous les points sont effacés disparaît avec eux
  parents.forEach(li => { if (!li.querySelector('li')) li.remove(); });
  zone.textContent = '';
  // Tout effacé : le bloc entier (titre compris) disparaît, et revient avec le premier point nouveau.
  bloc.hidden = !contenu.querySelector('li');
  zone.append(...contenu.childNodes);
}

// Nouveaux documents dans Ressources : une notification (effaçable avec « Tout effacer »). Première lecture
// silencieuse. La page Mise à jour est exclue (ses points sont déjà notifiés) ; les catégories aussi, car un lien
// qui sert de préfixe à un autre lien est une catégorie.
async function verifierRessources() {
  let html;
  try { html = await fetch(RESSOURCES_URL, { cache: 'no-cache' }).then(r => r.text()); } catch (e) { return; }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const liens = new Map();
  doc.querySelectorAll('a[href^="/ressources/"]').forEach(a => {
    const href = a.getAttribute('href');
    if (href === RESSOURCES_URL || href.startsWith('/ressources/mise-a-jours/') || liens.has(href)) return;
    liens.set(href, a.textContent.replace(/\s+/g, ' ').trim());
  });
  const cles = [...liens.keys()];
  const documents = cles.filter(h => !cles.some(autre => autre !== h && autre.startsWith(h)));
  const connus = lireTableau(RESSOURCES_VUES_KEY);
  if (connus.length > 0) {
    documents.filter(h => !connus.includes(h))
      .forEach(h => ajouterNotif('ressource:' + h, 'ressource', 'Nouveau dans Menu', liens.get(h) || h, h));
  }
  ecrireTableau(RESSOURCES_VUES_KEY, [...new Set([...connus, ...documents])]);
}

// Vérifie l'index des articles (en pause tant que NOTIF_ARTICLES est faux).
// « baseline » : marque tout comme vu, sans notifier (à l'activation).
// Une première vérification sans mémoire ne notifie rien non plus, pour ne pas inonder l'utilisateur.
async function verifierNouveautes(baseline = false) {
  if (!NOTIF_ARTICLES) return;
  if (!notificationsActivees() || permissionNotifications() !== 'granted' || !isFluxPersonnalise()) return;
  let index;
  try {
    index = await fetch('/articles-index.json', { cache: 'no-cache' }).then(r => r.json());
  } catch (e) { return; }
  const vus = lireArticlesVus();
  const noms = nomsSourcesChoisies();
  const nouveaux = (baseline || vus.size === 0) ? [] : index.filter(a => noms.has(a.source) && !vus.has(a.link));
  index.forEach(a => vus.add(a.link));
  ecrireArticlesVus(vus);
  nouveaux.forEach(a => ajouterNotif('article:' + a.link, 'article', a.title, a.source, a.link));
  if (nouveaux.length) afficherNotification(nouveaux);
}

function demarrerVerification() {
  if (!NOTIF_ARTICLES) return;
  arreterVerification();
  notifTimer = setInterval(() => verifierNouveautes(), NOTIF_INTERVALLE);
}

function arreterVerification() {
  if (notifTimer !== null) clearInterval(notifTimer);
  notifTimer = null;
}

// Demande l'autorisation (geste de l'utilisateur, nécessaire). Renvoie « granted », « denied », « default »
// ou « indisponible ».
async function demanderAutorisation() {
  if (!('Notification' in window)) return 'indisponible';
  let autorisation = Notification.permission;
  if (autorisation === 'default') autorisation = await Notification.requestPermission();
  return autorisation;
}

// Case « nouveaux flux ». Renvoie « granted » si activé.
async function activerNotifications() {
  const autorisation = await demanderAutorisation();
  if (autorisation !== 'granted') return autorisation;
  setNotificationsActivees(true);
  await verifierNouveautes(true);   // articles (en pause : ne fait rien) ; tout ce qui existe est considéré comme vu
  demarrerVerification();           // articles (en pause : ne fait rien)
  return 'granted';
}

function desactiverNotifications() {
  setNotificationsActivees(false);
  arreterVerification();
}

// Case « changements du site ». Renvoie « granted » si activé. À l'activation, les points existants sont connus.
async function activerNotifSite() {
  const autorisation = await demanderAutorisation();
  if (autorisation !== 'granted') return autorisation;
  setSiteNotifActive(true);
  await verifierMisesAJour(true);
  await verifierRessources();   // documents déjà présents : mémorisés sans notification s'ils sont inconnus
  return 'granted';
}

function desactiverNotifSite() {
  setSiteNotifActive(false);
}

// Liste des notifications (cloche) : elles restent jusqu'à « Tout effacer ». Ouvrir le panneau les marque
// comme lues : le point rouge s'éteint, mais la notification reste dans la liste jusqu'à « Tout effacer ».
const NOTIFS_KEY = 'kioske_notifs';                   // liste des notifications
const NOTIFS_EFFACEES_KEY = 'kioske_notifs_effacees'; // identifiants effacés : ils ne reviennent pas
const NOTIFS_MAX = 100;

function lireNotifs() { return lireTableau(NOTIFS_KEY); }

function ecrireNotifs(liste) { ecrireTableau(NOTIFS_KEY, liste.slice(-NOTIFS_MAX)); }

function notifsNonLues() { return lireNotifs().filter(n => !n.lue).length; }

// Ajoute une notification, une seule fois par identifiant (sauf si elle a été effacée).
function ajouterNotif(id, type, titre, texte, lien = '') {
  if (lireTableau(NOTIFS_EFFACEES_KEY).includes(id)) return;
  const liste = lireNotifs();
  if (liste.some(n => n.id === id)) return;
  liste.push({ id, type, titre, texte, lien, date: new Date().toISOString(), lue: false });
  ecrireNotifs(liste);
  majCloche();
  // Panneau ouvert : la nouvelle notification s'affiche tout de suite
  const panneau = document.getElementById('container-notifications');
  if (panneau && !panneau.hidden) majListeNotifs();
}

// Notifications affichées dans le panneau ouvert : seules celles-ci passent en « lues » à la fermeture
// (une notification arrivée pendant que le panneau est ouvert, et jamais affichée, reste non lue).
let notifsAffichees = [];

function marquerNotifsLues() {
  const affichees = new Set(notifsAffichees);
  ecrireNotifs(lireNotifs().map(n => affichees.has(n.id) ? Object.assign({}, n, { lue: true }) : n));
  majCloche();
}

// « Tout effacer » : ne touche qu'aux notifications (ni flux, ni réglages, ni page Mise à jour).
function toutEffacerNotifs() {
  const ids = lireNotifs().map(n => n.id);
  ecrireTableau(NOTIFS_EFFACEES_KEY, [...lireTableau(NOTIFS_EFFACEES_KEY), ...ids].slice(-1000));
  ecrireNotifs([]);
  majCloche();
  majListeNotifs();
  // La mise à jour affichée est effacée aussi : ses points actuels ne reviennent pas (les nouveaux, si).
  chargerMisesAJour()
    .then(maj => {
      const points = maj ? maj.points : [];
      ecrireTableau(MAJ_EFFACEES_KEY, [...lireTableau(MAJ_EFFACEES_KEY), ...points].slice(-1000));
    })
    .catch(() => {})
    .then(() => afficherMisesAJour());
}

// Affiche la liste dans le panneau (seulement les notifications non lues).
function majListeNotifs() {
  const zone = document.getElementById('notif-liste');
  if (!zone) return;
  // Seules les non lues s'affichent : une notification lue (panneau fermé) disparaît de la liste.
  const liste = lireNotifs().filter(n => !n.lue).reverse();
  notifsAffichees = liste.map(n => n.id);
  zone.textContent = '';
  if (liste.length === 0) {
    const vide = document.createElement('p');
    vide.textContent = 'Aucune notification non lue.';
    zone.appendChild(vide);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'notif-liste-items';
    liste.forEach(n => {
      const li = document.createElement('li');
      const titre = document.createElement('strong');
      titre.textContent = n.titre;
      let texte;
      if (n.lien) {
        // Lien vers le sujet de la notification (pas de lien pour les flux)
        texte = document.createElement('a');
        texte.href = n.lien;
        if (/^https?:\/\//.test(n.lien)) { texte.target = '_blank'; texte.rel = 'noopener noreferrer'; }
      } else {
        texte = document.createElement('span');
      }
      texte.textContent = ' ' + n.texte;
      li.append(titre, texte);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
  }
}

// La cloche est toujours visible ; le point rouge signale une notification en attente.
function majCloche() {
  const cloche = document.getElementById('btn-notifications');
  if (cloche) {
    cloche.hidden = false;
    const attente = notifsNonLues() > 0;
    cloche.classList.toggle('a-notif', attente);
    cloche.setAttribute('aria-label', attente ? 'Notifications (une notification en attente)' : 'Notifications');
  }
  if (!isFluxPersonnalise()) arreterVerification();
}

function createNotificationsPanel() {
  if (document.getElementById('container-notifications')) return;

  const container = document.createElement('div');
  container.id = 'container-notifications';
  container.className = 'categorie-container';
  container.hidden = true;
  // Fermer le panneau vaut lecture : les notifications affichées passent en « lues » et disparaissent de la liste.
  // (Observe l'attribut hidden : vaut pour la croix, le fond, la touche Échap et le retour arrière.)
  new MutationObserver(() => {
    if (container.hidden) { marquerNotifsLues(); majListeNotifs(); }
  }).observe(container, { attributes: true, attributeFilter: ['hidden'] });

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopover(); });

  const panneau = document.createElement('div');
  panneau.id = 'notifications-panneau';
  panneau.className = 'categorie-panneau';

  const header = document.createElement('div');
  header.className = 'panneau-entete panneau-entete-ligne';

  const titre = document.createElement('h2');
  titre.textContent = '🔔 Notifications';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer fermer-entete';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.addEventListener('click', () => closePopover());

  header.append(titre, fermer);

  const corps = document.createElement('div');
  corps.className = 'panneau-defilant';

  // Explication générale
  const explication = document.createElement('div');
  explication.className = 'notif-explication';
  explication.innerHTML =
    '<ul>' +
    '<li><strong>Désactivées par défaut</strong> : rien n\'est envoyé tant que tu ne les actives pas. Ton navigateur demande l\'autorisation la première fois.</li>' +
    '<li><strong>Pas de serveur qui pousse les nouveautés</strong> (aucun service tiers) : les notifications arrivent ' +
    'pendant que le site est ouvert, dans un onglet ou dans l\'app installée. Site fermé, il ne peut rien t\'envoyer.</li>' +
    '</ul>';

  // Case « changements du site »
  const ligneSite = document.createElement('label');
  ligneSite.className = 'notif-activation';
  const caseSite = document.createElement('input');
  caseSite.type = 'checkbox';
  caseSite.id = 'notif-site';
  const libelleSite = document.createElement('span');
  libelleSite.textContent = 'Me prévenir des changements du site';
  ligneSite.append(caseSite, libelleSite);

  // Case « nouveaux flux » (utile seulement avec un flux personnalisé)
  const ligne = document.createElement('label');
  ligne.className = 'notif-activation';
  const caseActiver = document.createElement('input');
  caseActiver.type = 'checkbox';
  caseActiver.id = 'notif-activer';
  const libelle = document.createElement('span');
  libelle.textContent = 'Me prévenir des nouveaux flux de mon flux personnalisé';
  ligne.append(caseActiver, libelle);

  const etat = document.createElement('p');
  etat.id = 'notif-etat';
  etat.className = 'notif-etat';
  etat.setAttribute('aria-live', 'polite');

  caseSite.addEventListener('change', async () => {
    if (caseSite.checked) {
      const resultat = await activerNotifSite();
      if (resultat !== 'granted') caseSite.checked = false;
    } else {
      desactiverNotifSite();
    }
    majPanneauNotifications();
  });

  caseActiver.addEventListener('change', async () => {
    if (caseActiver.checked) {
      const resultat = await activerNotifications();
      if (resultat !== 'granted') caseActiver.checked = false;
    } else {
      desactiverNotifications();
    }
    majPanneauNotifications();
  });

  // Liste des notifications, avec « Tout effacer » (efface seulement cette liste)
  const notifs = document.createElement('section');
  notifs.className = 'notif-liste';
  const titreNotifs = document.createElement('h3');
  titreNotifs.textContent = 'Mes notifications';
  const liste = document.createElement('div');
  liste.id = 'notif-liste';
  const toutEffacer = document.createElement('button');
  toutEffacer.type = 'button';
  toutEffacer.id = 'notif-tout-effacer';
  toutEffacer.className = 'panneau-bouton';
  toutEffacer.textContent = 'Tout effacer';
  toutEffacer.addEventListener('click', toutEffacerNotifs);
  notifs.append(titreNotifs, liste, toutEffacer);

  // Mise à jour du site, affichée ici (chargée par le script depuis la page Mise à jour)
  const maj = document.createElement('section');
  maj.className = 'notif-maj';
  maj.id = 'notif-maj';
  const titreMaj = document.createElement('h3');
  titreMaj.textContent = 'Mises à jour du site';
  const contenuMaj = document.createElement('div');
  contenuMaj.id = 'notif-maj-contenu';
  contenuMaj.className = 'ressources-texte';
  contenuMaj.textContent = 'Chargement…';
  maj.append(titreMaj, contenuMaj);

  corps.append(explication, ligneSite, ligne, etat, notifs, maj);
  panneau.append(header, corps);
  container.append(backdrop, panneau);
  document.body.appendChild(container);
}

// Met les cases et le message à jour selon l'état réel (activé, refusé, indisponible).
function majPanneauNotifications() {
  const caseActiver = document.getElementById('notif-activer');
  const caseSite = document.getElementById('notif-site');
  const etat = document.getElementById('notif-etat');
  if (!caseActiver || !caseSite || !etat) return;
  const permission = permissionNotifications();
  caseActiver.checked = notificationsActivees() && permission === 'granted';
  caseSite.checked = siteNotifActive() && permission === 'granted';
  if (permission === 'indisponible') {
    etat.textContent = 'Ce navigateur ne permet pas les notifications.';
  } else if (permission === 'denied') {
    etat.textContent = 'Les notifications sont refusées pour ce site : à autoriser dans les réglages du navigateur.';
  } else if (caseActiver.checked || caseSite.checked) {
    etat.textContent = 'Notifications activées.';
  } else {
    etat.textContent = 'Notifications désactivées.';
  }
}

// Ouvre le panneau : la mise à jour s'affiche, le point rouge disparaît.
function ouvrirPanneauNotifications() {
  createNotificationsPanel();
  majPanneauNotifications();
  majListeNotifs();           // les non lues s'affichent ; elles deviennent lues à la fermeture du panneau
  showPopover('notifications');
  afficherMisesAJour();
}

// Au chargement : la cloche, et les vérifications des types activés.
(function initNotifications() {
  const cloche = document.getElementById('btn-notifications');
  if (cloche) cloche.addEventListener('click', ouvrirPanneauNotifications);
  majCloche();
  if (siteNotifActive() && permissionNotifications() === 'granted') {
    verifierMisesAJour();
  }
  // Nouveaux documents de Ressources : seulement si « changements du site » est activé (désactivé par défaut)
  if (siteNotifActive()) verifierRessources();
  if (NOTIF_ARTICLES && isFluxPersonnalise() && notificationsActivees() && permissionNotifications() === 'granted') {
    verifierNouveautes();
    demarrerVerification();
  }
})();
