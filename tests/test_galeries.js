// Galeries : celle du panneau d'une catégorie et celle des blocs de catégorie de l'accueil.
// Le build local n'a souvent aucune image : les tests en posent de factices.
const { attendre, charger, clic, panneauOuvert, poserHistorique, surAccueil, suite } = require('./outils');

(async () => {
  // ---------- panneaux ouverts (tuiles, tags, titres) : jamais de galerie ; les galeries restent sur l'accueil
  {
    const t = suite('Panneaux ouverts sans galerie');
    const { w, d, erreurs } = charger('index.html', '/');
    await attendre(300);
    poserHistorique(w);
    const cats = Object.keys(w.categoriesData);
    w.categoriesData[cats[0]].forEach((a, i) => { a.image = '/img/veille/factice' + i + '.jpg'; });
    const bouton = (nom) => [...d.querySelectorAll('.titre-panneau[data-category-name]')].find(b => b.getAttribute('data-category-name') === nom);
    clic(w, bouton(cats[0])); await attendre();
    const cont = panneauOuvert(d);
    t.verif('le panneau de catégorie s’ouvre', !!cont);
    t.verif('aucune galerie dans un panneau ouvert', !!cont && !cont.querySelector('.galerie-slider'));
    t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    w.close();
    t.fin();
  }

  // ---------- galerie d'un bloc de catégorie de l'accueil (écrite par Python : render_galerie_bloc)
  t = suite('Galerie des blocs de catégorie de l\'accueil');
  const factice = (html) => {
    if (html.includes('class="galerie-slider galerie-slider-bloc"')) return html;   // le build a des images : rien à poser
    const adresse = html.match(/"url": "(\/articles\/[^"]+\/)"/)[1];
    const cartes = Array.from({ length: 12 }, (_, i) =>
      '<a href="' + adresse + '" class="galerie-carte" title="Titre ' + i + '"><img src="/img/veille/f' + i + '.jpg" alt="Titre ' + i + '" loading="lazy"></a>').join('');
    const bloc = '<section class="galerie-slider galerie-slider-bloc" aria-label="Derniers articles en images">' +
      '<button class="galerie-arrow-left" type="button" aria-label="Défiler vers la gauche">&lt;</button>' +
      '<div class="galerie galerie-bloc">' + cartes + '</div>' +
      '<button class="galerie-arrow-right" type="button" aria-label="Défiler vers la droite">&gt;</button></section>';
    return html.replace(/(<div class="sous-categorie"><h2[^>]*>.*?<\/h2>)/, '$1' + bloc);
  };
  ({ w, d, erreurs } = charger('index.html', '/', { html: factice }));
  await attendre(300);
  poserHistorique(w);
  const bloc = d.querySelector('.sous-categorie .galerie-slider-bloc');
  t.verif('galerie entre le titre et les étiquettes',
    bloc && bloc.previousElementSibling.tagName === 'H2' && bloc.nextElementSibling.classList.contains('nuage'));
  t.verif('12 vignettes au plus', bloc.querySelectorAll('a.galerie-carte').length > 0 && bloc.querySelectorAll('a.galerie-carte').length <= 12);
  const gal = bloc.querySelector('.galerie');
  clic(w, bloc.querySelector('.galerie-arrow-right')); clic(w, bloc.querySelector('.galerie-arrow-right'));
  t.verif('la flèche > fait défiler', gal.scrollLeft === 500, '(' + gal.scrollLeft + ')');
  clic(w, bloc.querySelector('.galerie-arrow-left'));
  t.verif('la flèche < revient', gal.scrollLeft === 250, '(' + gal.scrollLeft + ')');
  t.verif('la grande galerie n\'a pas bougé', d.querySelector('main > .galerie-slider .galerie').scrollLeft === 0);
  clic(w, bloc.querySelector('a.galerie-carte')); await attendre(300);
  const carte2 = d.querySelector('.carte-ouverte');
  t.verif('un clic sur une vignette ouvre l\'article', carte2 && !carte2.hidden && w.history.state.carte);
  clic(w, carte2.querySelector('.btn-retour')); await attendre();
  t.verif('« ← Retour » ramène à l\'accueil', carte2.hidden && surAccueil(w) && w.location.pathname === '/');
  clic(w, d.querySelector('.groupe .titre-panneau[data-category-name]')); await attendre();
  t.verif('le bouton + du bloc ouvre toujours le panneau', !!w.history.state.panneau);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  // ---------- image qui ne charge pas : la carte garde le titre à la place de l'image
  {
    const { w, d } = charger('index.html', '/');
    await attendre(60);
    d.body.insertAdjacentHTML('beforeend',
      '<section class="galerie-slider galerie-slider-bloc" id="essai-galerie">' +
      '<button class="galerie-arrow-left">&lt;</button><div class="galerie">' +
      '<a class="galerie-carte" id="essai-carte"><img id="essai-img" src="x"></a>' +
      '</div><button class="galerie-arrow-right">&gt;</button></section>');
    w.retirerCarte(d.getElementById('essai-img'));
    const carte = d.getElementById('essai-carte');
    t.verif('galerie : la carte reste', !!carte);
    t.verif('galerie : l’image est remplacée par le titre de l’article', carte && !carte.querySelector('img') && carte.querySelector('.galerie-carte-texte') && carte.classList.contains('galerie-carte-sans-image'));
    w.close();
  }

  t.fin();
})();
