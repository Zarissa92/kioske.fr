// Ressources et code de conduite : pages statiques (build/), vérifiées sans JavaScript de page.
// Le sommaire, le document et la barre du haut viennent du build ; ces tests vérifient ce qui est écrit.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Ressources et code de conduite (pages statiques)');

  // ---------- index des ressources : sommaire et texte d'accueil
  {
    const { w, d, erreurs } = charger('ressources/index.html', '/ressources/');
    await attendre(60);
    t.verif('index : titre « Menu »', d.querySelector('main h1') && d.querySelector('main h1').textContent === 'Menu');
    t.verif('index : sommaire présent', !!d.querySelector('.ressources-sommaire'));
    t.verif('index : aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    const premier = d.querySelector('.ressources-sommaire a[href^="/ressources/"]:not([href="/ressources/"])');
    t.verif('index : au moins un document dans le sommaire (si ressources/ n’est pas vide)',
      !!premier || d.querySelectorAll('.ressources-sommaire a').length === 1, premier ? premier.getAttribute('href') : '');
    w.close();

    // ---------- un document : titre, sommaire avec le document actif, retour
    if (premier) {
      const chemin = premier.getAttribute('href');
      const doc = charger(chemin.slice(1) + 'index.html', chemin);
      await attendre(60);
      t.verif('document : titre dans le contenu', !!doc.d.querySelector('main h1'));
      t.verif('document : document actif marqué dans le sommaire',
        !!doc.d.querySelector('.ressources-sommaire a[aria-current="page"][href="' + chemin + '"]'));
      t.verif('document : aucun lien « Toutes les ressources »',
        !doc.d.querySelector('main a[href="/ressources/"]'));
      t.verif('document : aucune erreur JavaScript', doc.erreurs.length === 0, doc.erreurs.join(' | '));
      doc.w.close();
    }
  }

  // ---------- code de conduite : page statique avec le texte
  {
    const { w, d, erreurs } = charger('code-de-conduite.html', '/code-de-conduite.html');
    await attendre(60);
    t.verif('code de conduite : titre', d.querySelector('main h1') && d.querySelector('main h1').textContent === 'Code de conduite');
    t.verif('code de conduite : texte présent', d.querySelector('main .ressources-texte').textContent.trim().length > 100);
    t.verif('code de conduite : aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    w.close();
  }

  // ---------- menu : Ressources et Code de conduite sont des liens vers les pages
  {
    const { w, d } = charger('index.html', '/');
    await attendre(60);
    t.verif('barre : bouton + vers les ressources', !!d.querySelector('.kioske-navbar a.btn-settings[href="/ressources/"]'));
    t.verif('menu ⚙️ : pas de lien vers le code de conduite', !d.querySelector('#navbar-menu a[href="/code-de-conduite.html"]'));
    w.close();
  }

  // ---------- barre du haut identique sur l'accueil et sur une page statique
  {
    const accueil = charger('index.html', '/');
    const statique = charger('code-de-conduite.html', '/code-de-conduite.html');
    await attendre(120);
    // le bouton « Galeries » n'existe que sur l'accueil : on le retire de la comparaison
    const texte = (d) => d.querySelector('nav.kioske-navbar').textContent.replace(/🖼️ (Grande galerie|Galeries des catégories) : (affichées?|masquées?)/g, '').replace(/\s+/g, ' ').trim();
    t.verif('barre : même texte que l’accueil', texte(accueil.d) === texte(statique.d), texte(statique.d));
    accueil.w.close(); statique.w.close();
  }

  t.fin();
})();
