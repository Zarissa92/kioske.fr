// Carte d'article ouverte en JavaScript : la page statique de l'article est chargée et sa carte
// affichée par-dessus l'accueil. L'adresse devient celle de la page statique (partage, rechargement).
// La page qui inclut ce script inclut aussi favoris.js (updateHearts) et partage.js, et ferme la carte
// sur la touche Échap.
let carteOuverte = null;
const titreAccueil = document.title;

function articleDuSite(href) {
  let u;
  try { u = new URL(href, location.href); } catch (e) { return null; }
  return (u.origin === location.origin && u.pathname.startsWith('/articles/')) ? u : null;
}

function chargerCarte(u) {
  return fetch(u.pathname)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const carte = doc.querySelector('main.panel-article');
      if (!carte) throw new Error('carte absente de la page');
      // Les images de la page sont relatives à son adresse : les rendre absolues
      carte.querySelectorAll('img[src]').forEach(img => {
        const a = new URL(img.getAttribute('src'), u);
        img.setAttribute('src', a.origin === location.origin ? a.pathname + a.search : a.href);
      });
      return { carte: document.importNode(carte, true), titre: doc.title };
    });
}

function afficherCarte(contenu, u) {
  if (!carteOuverte) {
    carteOuverte = document.createElement('div');
    carteOuverte.className = 'carte-ouverte';
    carteOuverte.setAttribute('role', 'dialog');
    carteOuverte.setAttribute('aria-modal', 'true');
    const fond = document.createElement('div');
    fond.className = 'carte-ouverte-fond';
    fond.addEventListener('click', fermerCarte);
    carteOuverte.appendChild(fond);
    document.body.appendChild(carteOuverte);
  }
  // L'accueil est agrandi (réglage « taille du site ») : l'annuler pour garder la taille de la page d'article
  carteOuverte.style.zoom = 1 / (parseFloat(document.documentElement.style.zoom) || 1);
  const ancienne = carteOuverte.querySelector('.panel-article');
  if (ancienne) ancienne.remove();
  carteOuverte.appendChild(contenu.carte);
  carteOuverte.hidden = false;

  const retour = contenu.carte.querySelector('.btn-retour');
  if (retour) retour.addEventListener('click', fermerCarte);
  // Précédent/Suivant gardent le « from » de la carte en cours
  const from = u.searchParams.get('from');
  if (from) {
    contenu.carte.querySelectorAll('a.nav-prev, a.nav-next').forEach(a => {
      a.setAttribute('href', a.getAttribute('href').split('?')[0] + '?from=' + encodeURIComponent(from));
    });
  }
  document.title = contenu.titre || titreAccueil;
  updateHearts();
}

function masquerCarte() {
  if (!carteOuverte) return;
  carteOuverte.hidden = true;
  const carte = carteOuverte.querySelector('.panel-article');
  if (carte) carte.remove();
  document.title = titreAccueil;
}

// mode : 'ajouter' (nouvelle entrée d'historique), 'remplacer' (Précédent/Suivant), 'aucun' (retour/avance du navigateur)
function ouvrirCarte(u, mode) {
  return chargerCarte(u)
    .then(contenu => {
      afficherCarte(contenu, u);
      const adresse = u.pathname + u.search;
      if (mode === 'ajouter') history.pushState({ carte: true }, '', adresse);
      else if (mode === 'remplacer') history.replaceState({ carte: true }, '', adresse);
    })
    .catch(err => {
      // En cas d'échec, la page statique s'ouvre normalement
      console.error('Carte non chargée :', err);
      if (mode !== 'aucun') window.location.href = u.href;
    });
}

function fermerCarte() {
  if (!carteOuverte || carteOuverte.hidden) return;
  // Masquée tout de suite : history.back() n'agit qu'un instant plus tard, et un second appel
  // (double appui) remonterait une entrée de trop
  const empilee = !!(history.state && history.state.carte);
  masquerCarte();
  if (empilee) history.back();
}

window.addEventListener('popstate', (e) => {
  const u = (e.state && e.state.carte) ? articleDuSite(location.href) : null;
  if (u) ouvrirCarte(u, 'aucun');
  else masquerCarte();
});

// Clic simple sur une carte (panneaux, galerie, recherche, favoris) ou sur Précédent/Suivant de la carte ouverte.
// Ctrl/Maj/clic molette gardent le comportement du lien : la page statique.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const lien = e.target.closest('a.carte, a.galerie-carte, .carte-ouverte a.nav-btn');
  if (!lien) return;
  const u = articleDuSite(lien.href);
  if (!u) return;
  e.preventDefault();
  const dejaOuverte = carteOuverte && !carteOuverte.hidden;
  ouvrirCarte(u, dejaOuverte ? 'remplacer' : 'ajouter');
});
