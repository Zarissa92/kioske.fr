// App installée : le bouton précédent du téléphone ne ferme pas l'app.
// Quand la page est la première de l'historique, on glisse dessous une entrée « socle ». Y revenir
// (précédent) ramène à l'accueil ; sur l'accueil, on y reste. Le paramètre « from » n'est pas lu ici : il
// ne sert qu'au bouton « ← Retour » des pages. Dans un navigateur ordinaire, rien ne change : le bouton
// précédent suit l'historique du navigateur.
(function () {
  const installee = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
  if (!installee) return;

  // Page où ramène le socle, calculée au chargement (null = on est sur l'accueil)
  const parente = (location.pathname === '/' || location.pathname === '/index.html') ? null : '/';

  // Première page de l'app : rien derrière dans l'historique, ou page ouverte par le socle
  let premiere = history.length <= 1;
  try {
    if (sessionStorage.getItem('kioske-premiere')) premiere = true;
    sessionStorage.removeItem('kioske-premiere');
  } catch (e) {}

  // Le socle est posé au premier geste : une entrée ajoutée sans geste est sautée par le navigateur
  function poserSocle() {
    ['pointerup', 'keydown', 'click'].forEach(t => window.removeEventListener(t, poserSocle, true));
    if (history.state && history.state.socle) return;
    const etat = history.state;
    try {
      history.replaceState({ socle: true }, '');
      history.pushState(etat, '');
    } catch (e) {}
  }
  if (premiere && !(history.state && history.state.socle)) {
    ['pointerup', 'keydown', 'click'].forEach(t => window.addEventListener(t, poserSocle, true));
  }

  window.addEventListener('popstate', (e) => {
    if (!(e.state && e.state.socle)) return;
    if (parente === null) {
      // Accueil : les panneaux et la carte viennent d'être refermés, on reste sur l'accueil
      try { history.pushState(null, '', '/'); } catch (err) {}
    } else {
      try { sessionStorage.setItem('kioske-premiere', '1'); } catch (err) {}
      location.replace(parente);
    }
  });
})();
