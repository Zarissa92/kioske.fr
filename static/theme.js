// Thème du site : fond, opacité du grand panneau, pluie matricielle.
// Les thèmes viennent de kioske.cfg ; le build les écrit dans la page (<script id="kioske-themes">) et
// pose le thème par défaut sur <html>. Ce script applique le thème choisi par le visiteur (gardé dans
// localStorage) et fabrique la pluie. Chargé dans <head>, avant l'affichage : pas de changement visible
// de thème au chargement. Le CSS de chaque thème est dans kioske/style_<thème>.css.
//
// La pluie n'est jamais écrite dans le HTML : ses caractères sont dans un attribut (data-g) et affichés
// par CSS (::before). Les navigateurs n'y voient donc pas de texte, et ne prennent plus la page pour du
// japonais.
(function () {
  const CLE = 'kioske-theme';
  const CLE_SOBRE = 'kioske-sobre';
  const FEUILLE_SOBRE = '/style_sobre.css';
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

  function lireSobre() {
    try { return localStorage.getItem(CLE_SOBRE) === '1'; } catch (e) { return false; }
  }

  // Mode sobre : feuille à part (static/style_sobre.css), ajoutée seulement quand le mode est activé
  function appliquerSobre(actif) {
    racine.dataset.sobre = actif ? 'oui' : 'non';
    let lien = document.getElementById('sobre-css');
    if (actif && !lien) {
      lien = document.createElement('link');
      lien.id = 'sobre-css';
      lien.rel = 'stylesheet';
      lien.href = FEUILLE_SOBRE;
      document.head.appendChild(lien);
    }
    if (lien) lien.disabled = !actif;
    const pluie = document.getElementById('pluie');
    if (actif && pluie) pluie.remove();
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

  // Feuille du thème choisi. Le thème par défaut est déjà dans la page (CSS inline) : sa feuille est
  // retirée, et les autres sont ajoutées par-dessus.
  function chargerCss(id) {
    const theme = themes.find(t => t.id === id);
    if (!theme) return;
    let lien = document.getElementById('theme-css-link');
    if (id === defaut || !theme.css) {
      if (lien) lien.remove();
      return;
    }
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

    if (theme.pluie && racine.dataset.sobre !== 'oui') fabriquerPluie();
    chargerCss(theme.id);
    marquerBoutons(theme.id);
  }

  appliquerSobre(lireSobre());
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

    // Bouton « Mode sobre » du menu ≡ (accueil seulement) : l'effet vaut pour toutes les pages
    const boutonSobre = document.getElementById('btn-sobre');
    if (boutonSobre) {
      const majSobre = () => {
        const actif = racine.dataset.sobre === 'oui';
        boutonSobre.setAttribute('aria-pressed', String(actif));
        boutonSobre.textContent = actif ? '✨ Mode sobre : activé' : '✨ Mode sobre : désactivé';
      };
      majSobre();
      boutonSobre.addEventListener('click', () => {
        const actif = racine.dataset.sobre !== 'oui';
        try { localStorage.setItem(CLE_SOBRE, actif ? '1' : '0'); } catch (e) {}
        appliquerSobre(actif);
        if (!actif) appliquer(racine.dataset.theme); // remet la pluie du thème, s'il en a une
        majSobre();
      });
    }
  });
})();
