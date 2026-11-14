// Galeries : celle du panneau d'une catégorie et celle des blocs de catégorie de l'accueil.
// Le build local n'a souvent aucune image : les tests en posent de factices.
const { attendre, charger, clic, panneauOuvert, poserHistorique, surAccueil, suite } = require('./outils');

(async () => {
  // ---------- galerie du panneau de catégorie
  let t = suite('Galerie du panneau de catégorie');
  let { w, d, erreurs } = charger('index.html', '/');
  await attendre(300);
  poserHistorique(w);
  const cats = Object.keys(w.categoriesData);
  w.categoriesData[cats[0]].forEach(a => { a.image = ''; });
  w.categoriesData[cats[0]].slice(2, 17).forEach((a, i) => { a.image = '/img/veille/factice' + i + '.jpg'; });
  w.categoriesData[cats[0]][2].title = 'Titre "piégé" <b>x</b>';
  w.categoriesData[cats[1]].forEach(a => { a.image = ''; });
  const bouton = (nom) => [...d.querySelectorAll('.tag-categorie')].find(b => b.getAttribute('data-category-name') === nom);

  clic(w, bouton(cats[0])); await attendre();
  const cont = panneauOuvert(d);
  const slider = cont.querySelector('.galerie-slider.galerie-panneau');
  t.verif('la galerie est dans le panneau', !!slider);
  const vignettes = [...slider.querySelectorAll('a.galerie-carte')];
  t.verif('12 images au plus', vignettes.length === 12, '(' + vignettes.length + ')');
  t.verif('placée avant la grille, dans la zone qui défile',
    slider.parentElement.classList.contains('panneau-defilant') && slider.nextElementSibling.classList.contains('grille'));
  t.verif('un titre contenant du HTML reste du texte', vignettes[0].title === 'Titre "piégé" <b>x</b>' && !vignettes[0].querySelector('b'));
  const retour1 = encodeURIComponent('/#cat=' + encodeURIComponent(cats[0]) + '&p=1');
  t.verif('le lien porte le retour vers la page 1', vignettes[0].getAttribute('href') === w.categoriesData[cats[0]][2].url + '?from=' + retour1);
  const g = slider.querySelector('.galerie');
  clic(w, slider.querySelector('.galerie-arrow-right'));
  t.verif('la flèche > fait défiler', g.scrollLeft === 250, '(' + g.scrollLeft + ')');
  clic(w, [...cont.querySelectorAll('.pagination-btn')][1]); await attendre();
  t.verif('le retour suit la page 2', vignettes[0].getAttribute('href').endsWith(encodeURIComponent('&p=2')));
  clic(w, vignettes[1]); await attendre(300);
  const carte = d.querySelector('.carte-ouverte');
  t.verif('un clic sur une image ouvre l\'article', carte && !carte.hidden && w.history.state.carte);
  clic(w, carte.querySelector('.btn-retour')); await attendre();
  t.verif('« ← Retour » ramène au panneau, page 2', carte.hidden && !cont.hidden && w.location.hash.endsWith('p=2'));
  clic(w, cont.querySelector('.categorie-fermer')); await attendre();
  t.verif('× ramène à l\'accueil', cont.hidden && surAccueil(w));
  clic(w, bouton(cats[1])); await attendre();
  t.verif('catégorie sans image : pas de galerie, mais des cartes',
    !panneauOuvert(d).querySelector('.galerie-slider') && panneauOuvert(d).querySelectorAll('a.carte').length > 0);
  clic(w, panneauOuvert(d).querySelector('.categorie-fermer')); await attendre();
  clic(w, d.querySelector('.nuage .tag')); await attendre();
  t.verif('panneau de source : pas de galerie', !panneauOuvert(d).querySelector('.galerie-slider'));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();

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
    return html.replace(/(<section class="groupe"><h2>.*?<\/h2>)/, '$1' + bloc);
  };
  ({ w, d, erreurs } = charger('index.html', '/', { html: factice }));
  await attendre(300);
  poserHistorique(w);
  const bloc = d.querySelector('.groupe .galerie-slider-bloc');
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
  clic(w, d.querySelector('.groupe .tag-categorie')); await attendre();
  t.verif('le bouton + du bloc ouvre toujours le panneau', !!w.history.state.panneau);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();
})();
