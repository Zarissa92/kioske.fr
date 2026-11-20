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
  let galeriesDefaut = {};   // galeries affichées par défaut, depuis kioske.cfg ([site] galerie_plus_lus…)
  let categoriesGalerie = [];   // catégories de la veille, groupées par panneau : page Paramètres
  try {
    const donnees = JSON.parse(document.getElementById('kioske-themes').textContent);
    themes = donnees.themes;
    defaut = donnees.defaut;
    galeriesDefaut = donnees.galeries || {};
    categoriesGalerie = donnees.categories || [];
  } catch (e) {}
  // Galerie d'une catégorie : masquée par défaut, affichée si le visiteur l'a activée (« 1 »).
  const CLE_GALERIE_CAT = 'kioske-galerie-cat-';
  function galerieCategorieAffichee(slug) {
    try { return localStorage.getItem(CLE_GALERIE_CAT + slug) === '1'; } catch (e) { return false; }
  }
  function appliquerGalerieCategorie(slug, affichee) {
    try { localStorage.setItem(CLE_GALERIE_CAT + slug, affichee ? '1' : '0'); } catch (e) {}
    document.querySelectorAll('.galerie-slider-bloc[data-categorie="' + slug + '"]').forEach(el => { el.hidden = !affichee; });
  }
  const galerieDefaut = (nom, sinon) => (typeof galeriesDefaut[nom] === 'boolean' ? galeriesDefaut[nom] : sinon);

  function lireChoix() {
    try { return localStorage.getItem(CLE); } catch (e) { return null; }
  }

  function lireSobre() {
    try { return localStorage.getItem(CLE_SOBRE) === '1'; } catch (e) { return false; }
  }

  // Galeries de l'accueil, un interrupteur par type. Défaut : kioske.cfg ([site] galerie_plus_lus, grande_galerie,
  // galeries_blocs), sinon « Les plus lus » seule (si la page ne les donne pas). Un choix mémorisé (« 1 » affichée, « 0 » masquée) l'emporte.
  const GALERIES = [
    { id: 'btn-galerie-plus-lus', attribut: 'galeriePlusLus', cle: 'kioske-galerie-plus-lus',
      libelle: 'Les plus lus', etat: ['affichée', 'masquée'], defaut: galerieDefaut('plus_lus', true) },
    { id: 'btn-grande-galerie', attribut: 'grandeGalerie', cle: 'kioske-grande-galerie',
      libelle: 'Grande galerie', etat: ['affichée', 'masquée'], defaut: galerieDefaut('grande', false) },
    { id: 'btn-galeries-blocs', attribut: 'galeriesBlocs', cle: 'kioske-galeries-blocs',
      libelle: 'Galeries des catégories', etat: ['affichées', 'masquées'], defaut: galerieDefaut('blocs', false) },
  ];
  // Réglages remis par défaut par le bouton « Tout remettre par défaut » (page Paramètres). Une clé ajoutée pour
  // un nouveau réglage se déclare ici aussi. Les données (favoris, notifications, vus) n'y sont pas.
  const REGLAGES = [CLE, CLE_SOBRE, ...GALERIES.map(g => g.cle), 'kioske_accueil_masques',
    'kioske_flux_personnalise', 'kioske_flux_connus',   // flux personnalisé (flux_personnalise.js)
    'kioske_notifications', 'kioske_notif_site'];      // interrupteurs des notifications (notifications.js)
  function lireGalerie(g) {
    try {
      const choix = localStorage.getItem(g.cle);
      return choix === null ? g.defaut : choix !== '0';
    } catch (e) { return g.defaut; }
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
      if (document.readyState === 'loading') {
        // Pendant l'analyse de <head> : la feuille est écrite tout de suite, bloquante. Sinon le navigateur
        // affiche d'abord le thème par défaut, puis le thème choisi (flash, surtout sur les pages statiques).
        document.write('<link id="theme-css-link" rel="stylesheet" href="' + theme.css + '">');
        return;
      }
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

    // Galeries de chaque catégorie : masquées selon le choix mémorisé, et un bouton par catégorie (page Paramètres)
    document.querySelectorAll('.galerie-slider-bloc[data-categorie]').forEach(el => {
      el.hidden = !galerieCategorieAffichee(el.dataset.categorie);
    });
    const conteneurCategories = document.getElementById('galeries-categories');
    if (conteneurCategories) {
      // Un groupe par panneau : son titre, puis les boutons de ses catégories
      categoriesGalerie.forEach(groupe => {
        const bloc = document.createElement('details');
        bloc.className = 'galeries-groupe reglages';
        if (groupe.panneau) {
          const resume = document.createElement('summary');
          const titre = document.createElement('h4');
          titre.textContent = groupe.panneau;
          resume.appendChild(titre);
          bloc.appendChild(resume);
        }
        groupe.categories.forEach(c => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'menu-button';
        bouton.id = 'btn-galerie-cat-' + c.slug;
        const maj = () => {
          const affichee = galerieCategorieAffichee(c.slug);
          bouton.setAttribute('aria-pressed', String(affichee));
          bouton.textContent = '🖼️ ' + c.nom + ' : ' + (affichee ? 'affichée' : 'masquée');
        };
        bouton.addEventListener('click', () => {
          const activer = !galerieCategorieAffichee(c.slug);
          appliquerGalerieCategorie(c.slug, activer);
          // Une galerie de catégorie n'apparaît que si l'interrupteur général est allumé : on l'allume avec elle.
          const general = document.getElementById('btn-galeries-blocs');
          if (activer && general && racine.dataset.galeriesBlocs !== 'oui') general.click();
          maj();
        });
        maj();
        bloc.appendChild(bouton);
        });
        conteneurCategories.appendChild(bloc);
      });
    }

    // Boutons des galeries (page Paramètres) : « Les plus lus », « Grande galerie », « Galeries des catégories »
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
    // Boutons « Mode sobre » (menu ⚙️ et page Paramètres) : même effet, repérés par data-reglage
    document.querySelectorAll('[data-reglage="sobre"]').forEach(boutonSobre => {
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
    });

    // Bouton « Tout remettre par défaut » (page Paramètres) : efface les RÉGLAGES enregistrés dans ce navigateur,
    // puis recharge la page. Deux clics : le premier demande confirmation sur le bouton lui-même (pas de fenêtre
    // de dialogue), sans second clic dans les 5 s il revient à son texte. Les DONNÉES restent : favoris,
    // notifications reçues, éléments déjà vus ou effacés, sources déjà annoncées.
    // L'autorisation des notifications donnée au navigateur ne peut pas être retirée par le site.
    document.querySelectorAll('[data-reglage="reinitialiser"]').forEach(bouton => {
      const texte = bouton.textContent;
      let minuterie = null;
      bouton.addEventListener('click', () => {
        if (bouton.dataset.confirmer !== 'oui') {
          bouton.dataset.confirmer = 'oui';
          bouton.textContent = '↺ Confirmer : tout remettre par défaut ?';
          minuterie = setTimeout(() => { delete bouton.dataset.confirmer; bouton.textContent = texte; }, 5000);
          return;
        }
        clearTimeout(minuterie);
        REGLAGES.forEach(cle => { try { localStorage.removeItem(cle); } catch (e) {} });
        try {
          Object.keys(localStorage).filter(cle => cle.startsWith(CLE_GALERIE_CAT))
            .forEach(cle => localStorage.removeItem(cle));
        } catch (e) {}
        location.reload();
      });
    });
  });
})();
