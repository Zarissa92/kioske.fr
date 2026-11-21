// Personnalisation de l'accueil : catégories et panneaux masqués, bouton 👁 sur les titres.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Personnalisation de l\'accueil');
  const preparer = masques =>
    '<script>try{localStorage.setItem("kioske_accueil_masques",' + JSON.stringify(JSON.stringify(masques)) + ');}catch(e){}</script>';
  const sectionDe = (d, nom) => {
    const h = [...d.querySelectorAll('[data-category-name]')].find(e => e.classList.contains('titre-categorie') && e.dataset.categoryName === nom);
    return h ? h.parentElement : null;
  };

  // 1. Catégorie masquée : sa section est cachée ; une autre reste visible
  let r = charger('index.html', '/', { html: h => h.replace('<head>', '<head>' + preparer({ panneaux: [], categories: ['Youtube'] })) });
  await attendre(400);
  const youtube = sectionDe(r.d, 'Youtube');
  const economie = sectionDe(r.d, 'Economie');
  const nuageYoutube = youtube ? youtube.querySelector('.nuage') : null;
  const titreYoutube = youtube ? Array.from(youtube.children).find(e => e.classList.contains('titre-categorie')) : null;
  t.verif('catégorie masquée : son contenu caché', !!nuageYoutube && nuageYoutube.hidden === true);
  t.verif('catégorie masquée : son titre reste (grisé, œil fermé)', !!titreYoutube && !titreYoutube.hidden && titreYoutube.classList.contains('accueil-masque'));
  t.verif('autre catégorie : section visible', !!economie && economie.hidden === false);
  t.verif('masquage : aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  r.w.close();

  // 2. Panneau masqué : toutes ses catégories sont cachées (Youtube est dans « Vidéo et radio »)
  r = charger('index.html', '/', { html: h => h.replace('<head>', '<head>' + preparer({ panneaux: ['Vidéo et radio'], categories: [] })) });
  await attendre(400);
  const panneau = [...r.d.querySelectorAll('section.groupe.panneau')].find(s => {
    const h = s.querySelector('.titre-du-panneau[data-category-name]');
    return h && h.dataset.categoryName === 'Vidéo et radio';
  });
  const enfantsCaches = panneau ? Array.from(panneau.children).filter(e => e.tagName === 'DIV') : [];
  t.verif('panneau masqué : ses catégories sont cachées', enfantsCaches.length > 0 && enfantsCaches.every(d => d.hidden === true));
  const titrePanneau = panneau ? panneau.querySelector('.titre-du-panneau') : null;
  t.verif('panneau masqué : son titre reste', !!titrePanneau && !titrePanneau.hidden);
  r.w.close();

  // 5. Boutons sur les titres de l'accueil : 👁 masque la catégorie et affiche le bandeau
  r = charger('index.html', '/');
  await attendre(400);
  const titreEco = [...r.d.querySelectorAll('.titre-categorie[data-category-name]')].find(h => h.dataset.categoryName === 'Economie');
  const oeilYoutube = [...r.d.querySelectorAll('.accueil-outil[data-action="masquer"]')].find(b => b.dataset.nom === 'Youtube');
  if (oeilYoutube) oeilYoutube.click();
  await attendre(100);
  const titreYt = [...r.d.querySelectorAll('.titre-categorie[data-category-name]')].find(h => h.dataset.categoryName === 'Youtube');
  const nuageYt = titreYt.parentElement.querySelector('.nuage');
  t.verif('clic 👁 : catégorie masquée (contenu caché)', nuageYt.hidden === true);
  t.verif('clic 👁 : bouton passé à l\'œil fermé', oeilYoutube.getAttribute('aria-pressed') === 'true');
  t.verif('clic 👁 : bandeau de réaffichage visible', !r.d.getElementById('accueil-bandeau-masques').hidden);
  oeilYoutube.click();
  await attendre(100);
  t.verif('second clic 👁 : catégorie réaffichée', nuageYt.hidden === false && oeilYoutube.getAttribute('aria-pressed') === 'false');
  t.verif('boutons sur la page d\'accueil : aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  r.w.close();

  // 6. Régression : masquer des titres ne doit pas réafficher les galeries de catégorie que le réglage garde cachées
  r = charger('index.html', '/', { html: h => h.replace('<head>', '<head><script>try{localStorage.setItem("kioske-galeries-blocs","1");localStorage.setItem("kioske-galerie-cat-fr","1");}catch(e){}</script>') });
  await attendre(400);
  const galDivers = r.d.querySelector('.galerie-slider-bloc[data-categorie="divers"]');
  const galFr = r.d.querySelector('.galerie-slider-bloc[data-categorie="fr"]');
  t.verif('galerie non choisie : reste cachée', !!galDivers && galDivers.hidden === true);
  t.verif('galerie choisie : reste affichée', !!galFr && galFr.hidden === false);
  r.w.close();

  t.fin();
})();
