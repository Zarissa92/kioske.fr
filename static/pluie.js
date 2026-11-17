// Pluie matricielle des thèmes qui en ont une (kioske.cfg : pluie = oui). Chargé par theme.js seulement
// pour un tel thème, et hors mode sobre. Les colonnes sont créées ici ; leurs signes sont dans l'attribut
// data-g et affichés par CSS (::before) : la page ne contient donc aucun texte japonais. Les règles CSS
// (#pluie, la chute) sont dans les feuilles de thème.
(function () {
  const SIGNES = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ*+-=<>';
  const COLONNES = 40;
  const hasard = (min, max) => min + Math.random() * (max - min);

  // Couleurs de la pluie, données par le thème dans kioske.cfg (variables --r-* de la feuille de thème)
  function poserCouleurs(theme) {
    const racine = document.documentElement;
    if (theme.pluie_tete) racine.style.setProperty('--r-tete', theme.pluie_tete);
    if (theme.pluie_haut) racine.style.setProperty('--r-haut', theme.pluie_haut);
    if (theme.pluie_moyen) racine.style.setProperty('--r-moyen', theme.pluie_moyen);
    if (theme.pluie_bas) racine.style.setProperty('--r-bas', theme.pluie_bas);
  }

  function fabriquer() {
    if (document.getElementById('pluie') || !document.body) return;
    const pluie = document.createElement('div');
    pluie.id = 'pluie';
    pluie.setAttribute('aria-hidden', 'true');
    pluie.setAttribute('translate', 'no');
    for (let k = 0; k < COLONNES; k++) {
      const colonne = document.createElement('i');
      const longueur = Math.round(hasard(14, 30));
      let texte = '';
      for (let n = 0; n < longueur; n++) {
        texte += (n ? '\n' : '') + SIGNES[Math.floor(Math.random() * SIGNES.length)];
      }
      colonne.dataset.g = texte;
      colonne.style.left = (k * 100 / COLONNES + hasard(-0.8, 0.8)).toFixed(2) + '%';
      colonne.style.animationDuration = hasard(3.6, 9.6).toFixed(1) + 's';
      colonne.style.animationDelay = (-hasard(0, 16)).toFixed(1) + 's';
      pluie.appendChild(colonne);
    }
    document.body.prepend(pluie);
  }

  // Appelé par theme.js. Sans <body> (script dans <head>), la pluie attend la fin du chargement de la page.
  window.KioskePluie = {
    appliquer(theme) {
      poserCouleurs(theme);
      if (document.body) fabriquer();
      else document.addEventListener('DOMContentLoaded', fabriquer, { once: true });
    }
  };
})();
