// Thème du site : fond, opacité du grand panneau, pluie matricielle.
// Les thèmes viennent de kioske.cfg ; le build les écrit dans la page (<script id="kioske-themes">) et
// pose le thème par défaut sur <html>. Ce script applique le thème choisi par le visiteur (gardé dans
// localStorage). Chargé dans <head>, avant l'affichage : pas de changement visible de thème au chargement.
// Le CSS du thème par défaut est dans la page ; chaque autre thème est une surcouche (kioske/style_<thème>.css,
// variables et exceptions) chargée par-dessus. La pluie (thèmes avec pluie = oui) est dans
// static/pluie.js, chargé seulement pour ces thèmes.
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

  // Galeries de l'accueil, un interrupteur par type : affichées par défaut, masquées si « 0 » (mémorisé)
  const GALERIES = [
    { id: 'btn-grande-galerie', attribut: 'grandeGalerie', cle: 'kioske-grande-galerie',
      libelle: 'Grande galerie', etat: ['affichée', 'masquée'] },
    { id: 'btn-galeries-blocs', attribut: 'galeriesBlocs', cle: 'kioske-galeries-blocs',
      libelle: 'Galeries des catégories', etat: ['affichées', 'masquées'] },
  ];
  function lireGalerie(g) {
    try { return localStorage.getItem(g.cle) !== '0'; } catch (e) { return true; }
  }
  function appliquerGalerie(g, affichee) { racine.dataset[g.attribut] = affichee ? 'oui' : 'non'; }

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
    if (actif && pluie) pluie.remove();  // mode sobre : pas de pluie
  }

  // Pluie : pluie.js n'est chargé qu'au premier besoin, puis ses fonctions sont appelées
  let pluieChargee = null;
  function avecPluie(quand) {
    if (window.KioskePluie) return quand();
    if (!pluieChargee) {
      pluieChargee = new Promise((ok, ko) => {
        const script = document.createElement('script');
        script.src = '/pluie.js';
        script.onload = ok;
        script.onerror = ko;
        document.head.appendChild(script);
      });
    }
    pluieChargee.then(quand, () => {});
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

    if (theme.pluie && racine.dataset.sobre !== 'oui') avecPluie(() => window.KioskePluie.appliquer(theme));
    chargerCss(theme.id);
    marquerBoutons(theme.id);
  }

  appliquerSobre(lireSobre());
  GALERIES.forEach(g => appliquerGalerie(g, lireGalerie(g)));
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

    // Boutons « Grande galerie » et « Galeries des blocs » du menu ⚙️ (accueil seulement)
    GALERIES.forEach(g => {
      const bouton = document.getElementById(g.id);
      if (!bouton) return;
      const maj = () => {
        const affichee = racine.dataset[g.attribut] !== 'non';
        bouton.setAttribute('aria-pressed', String(affichee));
        bouton.textContent = '🖼️ ' + g.libelle + ' : ' + (affichee ? g.etat[0] : g.etat[1]);
      };
      maj();
      bouton.addEventListener('click', () => {
        const affichee = racine.dataset[g.attribut] === 'non';
        try { localStorage.setItem(g.cle, affichee ? '1' : '0'); } catch (e) {}
        appliquerGalerie(g, affichee);
        maj();
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
