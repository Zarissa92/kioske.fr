// Thème du site : fond, opacité du grand panneau, pluie matricielle.
// Les thèmes viennent de kioske.cfg ; le build les écrit dans la page (<script id="kioske-themes">) et
// pose le thème par défaut sur <html>. Ce script applique le thème choisi par le visiteur (gardé dans
// localStorage) et fabrique la pluie. Chargé dans <head>, avant l'affichage : pas de changement visible
// de thème au chargement. Les règles CSS sont dans kioske/style.css (section « Thèmes »).
//
// La pluie n'est jamais écrite dans le HTML : ses caractères sont dans un attribut (data-g) et affichés
// par CSS (::before). Les navigateurs n'y voient donc pas de texte, et ne prennent plus la page pour du
// japonais.
(function () {
  const CLE = 'kioske-theme';
  const racine = document.documentElement;

  let themes = [];
  let defaut = racine.dataset.theme || '';
  try {
    const donnees = JSON.parse(document.getElementById('kioske-themes').textContent);
    themes = donnees.themes;
    defaut = donnees.defaut;
  } catch (e) {}

  function lireChoix() {
    try { return localStorage.getItem(CLE); } catch (e) { return null; }
  }

  function fabriquerPluie() {
    if (document.getElementById('pluie') || !document.body) return;
    const signes = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ*+-=<>';
    const hasard = (min, max) => min + Math.random() * (max - min);
    const colonnes = 40;
    const pluie = document.createElement('div');
    pluie.id = 'pluie';
    pluie.setAttribute('aria-hidden', 'true');
    pluie.setAttribute('translate', 'no');
    for (let k = 0; k < colonnes; k++) {
      const colonne = document.createElement('i');
      const longueur = Math.round(hasard(14, 30));
      let texte = '';
      for (let n = 0; n < longueur; n++) {
        texte += (n ? '\n' : '') + signes[Math.floor(Math.random() * signes.length)];
      }
      colonne.dataset.g = texte;
      colonne.style.left = (k * 100 / colonnes + hasard(-0.8, 0.8)).toFixed(2) + '%';
      colonne.style.animationDuration = hasard(3.6, 9.6).toFixed(1) + 's';
      colonne.style.animationDelay = (-hasard(0, 16)).toFixed(1) + 's';
      pluie.appendChild(colonne);
    }
    document.body.prepend(pluie);
  }

  function marquerBoutons(id) {
    document.querySelectorAll('.theme-bouton').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.themeId === id));
    });
  }

  function chargerCss(id) {
    // Charger le CSS du thème selon les données JSON
    const theme = themes.find(t => t.id === id);
    if (!theme || !theme.css) return; // Pas de CSS personnalisé pour ce thème

    // Remplacer la balise <link> existante ou en créer une
    let lien = document.getElementById('theme-css-link');
    if (!lien) {
      lien = document.createElement('link');
      lien.id = 'theme-css-link';
      lien.rel = 'stylesheet';
      document.head.appendChild(lien);
    }
    lien.href = theme.css;
  }

  function appliquer(id) {
    const theme = themes.find(t => t.id === id) || themes.find(t => t.id === defaut);
    if (!theme) return;
    racine.dataset.theme = theme.id;
    racine.dataset.fond = theme.fond;
    racine.dataset.pluie = theme.pluie ? 'oui' : 'non';
    racine.style.setProperty('--panneau-opacite', theme.opacite / 100);

    // Appliquer les couleurs de pluie depuis la config du thème
    if (theme.pluie_tete) racine.style.setProperty('--r-tete', theme.pluie_tete);
    if (theme.pluie_haut) racine.style.setProperty('--r-haut', theme.pluie_haut);
    if (theme.pluie_moyen) racine.style.setProperty('--r-moyen', theme.pluie_moyen);
    if (theme.pluie_bas) racine.style.setProperty('--r-bas', theme.pluie_bas);

    if (theme.pluie) fabriquerPluie();
    chargerCss(theme.id);
    marquerBoutons(theme.id);
  }

  appliquer(lireChoix() || defaut);

  // La page n'est pas encore lue en entier : la pluie et les boutons attendent <body>
  document.addEventListener('DOMContentLoaded', () => {
    appliquer(racine.dataset.theme);
    document.querySelectorAll('.theme-bouton').forEach(b => {
      b.addEventListener('click', () => {
        try { localStorage.setItem(CLE, b.dataset.themeId); } catch (e) {}
        appliquer(b.dataset.themeId);
      });
    });
  });
})();
