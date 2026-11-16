// Actualisation automatique de l'accueil : quand une nouvelle version est publiée, la page se recharge toute seule
// si rien n'est ouvert (panneau, carte d'article, menu d'infos). Sinon une bannière propose de l'actualiser, et la
// page se rechargera à la vérification suivante, dès que tout est refermé. Une requête HEAD suffit (pas de contenu).
const ACTU_INTERVALLE = 5 * 60 * 1000;   // ms entre deux vérifications
let versionAffichee = null;              // Last-Modified de la page chargée (référence)

function rechargerPage() {
  location.reload();
}

function quelqueChoseOuvert() {
  const panneau = [...document.querySelectorAll('.categorie-container')].some(c => !c.hidden);
  const carte = document.querySelector('.carte-ouverte');
  const infos = document.getElementById('bloc-infos-container');
  return panneau || (!!carte && !carte.hidden) || (!!infos && !infos.hidden);
}

function afficherBandeauNouveautes() {
  if (document.getElementById('bandeau-nouveautes')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.id = 'bandeau-nouveautes';
  bouton.textContent = 'Nouveaux articles : actualiser la page';
  bouton.style.cssText = 'position:fixed;top:.5rem;left:50%;transform:translateX(-50%);z-index:20000;' +
    'padding:.5rem 1rem;background:#000;color:#fff;border:2px solid var(--neon-coeur);border-radius:12px;' +
    'font:inherit;font-size:.85rem;cursor:pointer;';
  bouton.addEventListener('click', () => rechargerPage());
  document.body.appendChild(bouton);
}

async function verifierNouvelleVersion() {
  let reponse;
  try {
    reponse = await fetch('/index.html', { method: 'HEAD', cache: 'no-cache' });
  } catch (e) { return; }            // hors ligne : on réessaiera
  if (!reponse.ok) return;
  const version = reponse.headers.get('Last-Modified');
  if (!version) return;
  if (versionAffichee === null) {    // premier passage : c'est la version affichée
    versionAffichee = version;
    return;
  }
  if (version === versionAffichee) return;
  if (!quelqueChoseOuvert()) {
    rechargerPage();
  } else {
    afficherBandeauNouveautes();
  }
}

(function initRafraichissement() {
  verifierNouvelleVersion();
  setInterval(verifierNouvelleVersion, ACTU_INTERVALLE);
  // Un onglet remis au premier plan vérifie tout de suite
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verifierNouvelleVersion();
  });
})();
