// Favoris, partage, données et recherche, sur les quatre types de page : accueil, article, catégorie, RSS.
const { attendre, charger, clic, touche, panneauOuvert, nbFavoris, premierArticle, premiereCategorie, suite } = require('./outils');

(async () => {
  // ---------- accueil
  let t = suite('Accueil');
  let { w, d, erreurs } = charger('index.html', '/');
  await attendre(300);
  t.verif('données lues depuis le JSON de la page',
    Object.keys(w.sourcesData).length > 0 && Object.keys(w.categoriesData).length > 0 && w.conductCode.length > 0);
  const onclicks = [...d.querySelectorAll('[onclick]')];
  t.verif('aucun onclick hors du bloc immuable', onclicks.every(e => e.closest('#bloc-infos')), '(' + onclicks.length + ' dans le bloc)');
  let ouvertures = 0; d.getElementById('fav-file-input').click = () => { ouvertures++; };
  clic(w, d.querySelector('.btn-favs')); await attendre();
  clic(w, d.getElementById('fav-import-btn'));
  t.verif('« Charger des favoris » ouvre le choix de fichier', ouvertures === 1);
  clic(w, d.querySelector('#favoris .categorie-fermer')); await attendre();

  clic(w, d.querySelector('.tag-categorie')); await attendre();
  clic(w, panneauOuvert(d).querySelector('a.carte')); await attendre(300);
  const carte = d.querySelector('.carte-ouverte');
  const coeur = carte.querySelector('.fav-heart');
  clic(w, coeur); await attendre();
  t.verif('♡ de la carte ajoute le favori, une seule fois', nbFavoris(w) === 1 && coeur.classList.contains('active'), '(' + nbFavoris(w) + ')');
  clic(w, coeur); await attendre();
  t.verif('♡ de nouveau le retire', nbFavoris(w) === 0 && !coeur.classList.contains('active'));
  let partages = []; w.navigator.share = (p) => { partages.push(p); return Promise.resolve(); };
  clic(w, carte.querySelector('.share-btn')); await attendre();
  t.verif('📤 de la carte partage, une seule fois', partages.length === 1);
  t.verif('l\'adresse partagée est celle de l\'article, sans « from »', partages[0] && /\/articles\/[^?]+\/$/.test(partages[0].url), partages[0] && partages[0].url);
  t.verif('la carte reste ouverte après ♡ et 📤', !carte.hidden);
  touche(w, 'Escape'); await attendre();
  clic(w, d.getElementById('btn-open-conduite')); await attendre();
  t.verif('le code de conduite s\'affiche', panneauOuvert(d) && panneauOuvert(d).id === 'container-conduct' && panneauOuvert(d).textContent.includes('Code de conduite'));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();

  // ---------- accueil : la recherche
  t = suite('Accueil : recherche');
  ({ w, d, erreurs } = charger('index.html', '/'));
  await attendre(300);
  const mot = Object.values(w.categoriesData)[0][0].title.split(/\s+/).find(m => m.length > 4) || 'a';
  const champ = d.getElementById('recherche');
  champ.value = mot;
  champ.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await attendre(300);
  t.verif('Entrée ouvre le panneau des résultats', panneauOuvert(d) && panneauOuvert(d).id === 'container-search-results', '« ' + mot + ' »');
  t.verif('des cartes de résultats', d.querySelectorAll('#search-results-grille a.carte').length > 0);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();

  // ---------- page d'article
  t = suite('Page d\'article');
  const art = premierArticle();
  ({ w, d, erreurs } = charger('articles/' + art + '/index.html', '/articles/' + art + '/?from=%2F%23cat%3Dx%26p%3D1'));
  await attendre(300);
  const coeur2 = d.querySelector('.fav-heart');
  clic(w, coeur2); await attendre();
  t.verif('♡ ajoute le favori, une seule fois', nbFavoris(w) === 1 && coeur2.classList.contains('active'), '(' + nbFavoris(w) + ')');
  const favori = Object.values(JSON.parse(w.localStorage.getItem('kioske_favoris')))[0];
  t.verif('le favori pointe vers la page de l\'article', favori.url === '/articles/' + art + '/', favori.url);
  partages = []; w.navigator.share = (p) => { partages.push(p); return Promise.resolve(); };
  clic(w, d.querySelector('.share-btn')); await attendre();
  t.verif('📤 partage l\'adresse sans « from »', partages.length === 1 && partages[0].url === 'https://kioske.test/articles/' + art + '/');
  t.verif('aucun onclick, aucun script à part', !d.querySelector('[onclick]') && !d.querySelector('script[src="/app.js"]'));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();

  // ---------- page de catégorie
  t = suite('Page de catégorie');
  const cat = premiereCategorie();
  ({ w, d, erreurs } = charger('categories/' + cat + '/index.html', '/categories/' + cat + '/'));
  await attendre(300);
  clic(w, d.querySelector('a.carte')); await attendre(300);
  const carte3 = d.querySelector('.carte-ouverte');
  t.verif('un clic sur une carte ouvre l\'article', carte3 && !carte3.hidden);
  clic(w, carte3.querySelector('.fav-heart')); await attendre();
  t.verif('♡ de la carte ajoute le favori, une seule fois', nbFavoris(w) === 1, '(' + nbFavoris(w) + ')');
  touche(w, 'Escape'); await attendre();
  t.verif('Échap ferme la carte', carte3.hidden);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();

  // ---------- page des flux RSS
  t = suite('Page des flux RSS');
  ({ w, d, erreurs } = charger('rss.html', '/rss.html'));
  await attendre(200);
  t.verif('des liens de flux', d.querySelectorAll('a.rss-lien').length > 1);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();
})();
