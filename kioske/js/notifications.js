// Notifications des flux personnalisés. Désactivées par défaut ; la cloche n'apparaît que si un flux
// personnalisé est choisi. Le site n'a pas de serveur qui pousse les nouveautés : les notifications arrivent
// pendant que le site est ouvert (dans un onglet ou dans l'app installée), avec une vérification à l'ouverture
// puis toutes les 30 minutes. Rien ne passe par un service tiers : tout reste dans le navigateur.

const NOTIF_ACTIVEES_KEY = 'kioske_notifications';   // « 1 » si l'utilisateur les a activées
const NOTIF_VUES_KEY = 'kioske_notifications_vues';  // adresses des articles déjà vus
const NOTIF_INTERVALLE = 30 * 60 * 1000;             // ms entre deux vérifications
const NOTIF_MAX_VUES = 5000;                         // au-delà, les plus anciennes sont oubliées
let notifTimer = null;

function notificationsActivees() {
  try { return localStorage.getItem(NOTIF_ACTIVEES_KEY) === '1'; } catch (e) { return false; }
}

function setNotificationsActivees(on) {
  try { localStorage.setItem(NOTIF_ACTIVEES_KEY, on ? '1' : '0'); } catch (e) {}
}

function lireArticlesVus() {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIF_VUES_KEY) || '[]')); } catch (e) { return new Set(); }
}

function ecrireArticlesVus(ensemble) {
  try { localStorage.setItem(NOTIF_VUES_KEY, JSON.stringify([...ensemble].slice(-NOTIF_MAX_VUES))); } catch (e) {}
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

// Vérifie l'index des articles. « baseline » : marque tout comme vu, sans notifier (à l'activation).
// Une première vérification sans mémoire ne notifie rien non plus, pour ne pas inonder l'utilisateur.
async function verifierNouveautes(baseline = false) {
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
  if (nouveaux.length) afficherNotification(nouveaux);
}

function demarrerVerification() {
  arreterVerification();
  notifTimer = setInterval(() => verifierNouveautes(), NOTIF_INTERVALLE);
}

function arreterVerification() {
  if (notifTimer !== null) clearInterval(notifTimer);
  notifTimer = null;
}

// Appelée par la case à cocher (geste de l'utilisateur, nécessaire pour demander l'autorisation).
// Renvoie « granted », « denied », « default » ou « indisponible ».
async function activerNotifications() {
  if (!('Notification' in window)) return 'indisponible';
  let autorisation = Notification.permission;
  if (autorisation === 'default') autorisation = await Notification.requestPermission();
  if (autorisation !== 'granted') return autorisation;
  setNotificationsActivees(true);
  await verifierNouveautes(true);   // tout ce qui existe déjà est considéré comme vu
  demarrerVerification();
  return 'granted';
}

function desactiverNotifications() {
  setNotificationsActivees(false);
  arreterVerification();
}

// La cloche n'est visible que si un flux personnalisé existe. Sans flux, rien n'est vérifié.
function majCloche() {
  const cloche = document.getElementById('btn-notifications');
  const actif = isFluxPersonnalise();
  if (cloche) cloche.hidden = !actif;
  if (!actif) arreterVerification();
}

function createNotificationsPanel() {
  if (document.getElementById('container-notifications')) return;

  const container = document.createElement('div');
  container.id = 'container-notifications';
  container.className = 'categorie-container';
  container.hidden = true;

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

  const explication = document.createElement('div');
  explication.className = 'notif-explication';
  explication.innerHTML =
    '<p>Quand tu as choisi tes flux, tu peux être prévenu·e des <strong>nouveaux articles</strong> de ces sources.</p>' +
    '<ul>' +
    '<li><strong>Désactivées par défaut</strong> : rien n\'est envoyé tant que tu ne les actives pas.</li>' +
    '<li><strong>Pas de serveur qui pousse les nouveautés</strong> (aucun service tiers) : les notifications arrivent ' +
    'pendant que le site est ouvert, dans un onglet ou dans l\'app installée. Vérification à l\'ouverture, puis toutes ' +
    'les 30 minutes. Site fermé, il ne peut rien t\'envoyer.</li>' +
    '<li>Seuls les articles des <strong>sources cochées</strong> dans ton flux déclenchent une notification.</li>' +
    '<li>Ton navigateur demande l\'autorisation la première fois.</li>' +
    '</ul>';

  const ligne = document.createElement('label');
  ligne.className = 'notif-activation';
  const caseActiver = document.createElement('input');
  caseActiver.type = 'checkbox';
  caseActiver.id = 'notif-activer';
  const libelle = document.createElement('span');
  libelle.textContent = 'Recevoir des notifications pour mes flux personnalisés';
  ligne.append(caseActiver, libelle);

  const etat = document.createElement('p');
  etat.id = 'notif-etat';
  etat.className = 'notif-etat';
  etat.setAttribute('aria-live', 'polite');

  caseActiver.addEventListener('change', async () => {
    if (caseActiver.checked) {
      const resultat = await activerNotifications();
      if (resultat !== 'granted') caseActiver.checked = false;
    } else {
      desactiverNotifications();
    }
    majPanneauNotifications();
  });

  corps.append(explication, ligne, etat);
  panneau.append(header, corps);
  container.append(backdrop, panneau);
  document.body.appendChild(container);
}

// Met la case et le message à jour selon l'état réel (activé, refusé, indisponible).
function majPanneauNotifications() {
  const caseActiver = document.getElementById('notif-activer');
  const etat = document.getElementById('notif-etat');
  if (!caseActiver || !etat) return;
  const permission = permissionNotifications();
  caseActiver.checked = notificationsActivees() && permission === 'granted';
  if (permission === 'indisponible') {
    etat.textContent = 'Ce navigateur ne permet pas les notifications.';
  } else if (permission === 'denied') {
    etat.textContent = 'Les notifications sont refusées pour ce site : à autoriser dans les réglages du navigateur.';
  } else if (caseActiver.checked) {
    etat.textContent = 'Notifications activées.';
  } else {
    etat.textContent = 'Notifications désactivées.';
  }
}

// Au chargement : la cloche selon le flux, et la vérification si elle était activée.
(function initNotifications() {
  const cloche = document.getElementById('btn-notifications');
  if (cloche) {
    cloche.addEventListener('click', () => {
      createNotificationsPanel();
      majPanneauNotifications();
      showPopover('notifications');
    });
  }
  majCloche();
  if (isFluxPersonnalise() && notificationsActivees() && permissionNotifications() === 'granted') {
    verifierNouveautes();
    demarrerVerification();
  }
})();
