// Les textes des articles viennent des flux RSS et d'autres sites : un titre ou un résumé qui contient
// du HTML doit s'afficher tel quel, jamais être interprété. De même pour un fichier de favoris trafiqué.
const { attendre, charger, clic, panneauOuvert, suite } = require('./outils');

const PIEGE = '<img src=x onerror="window.pirate=1"><b>gras</b>';
// Aucune balise venue du piège dans l'élément, et le texte du piège affiché tel quel
const sain = (el) => !el.querySelector('b, img[onerror], script') && el.textContent.includes('<b>gras</b>');

(async () => {
  const t = suite('Sécurité : textes des articles et favoris importés');

  // ---------- panneaux de catégorie et de source
  let { w, d, erreurs } = charger('index.html', '/');
  await attendre(300);
  const cat = Object.keys(w.categoriesData)[0];
  const a = w.categoriesData[cat][0];
  Object.assign(a, { title: PIEGE, summary: PIEGE, host: PIEGE, date: PIEGE, source: PIEGE, image: '' });
  clic(w, [...d.querySelectorAll('.tag-categorie')].find(b => b.getAttribute('data-category-name') === cat)); await attendre();
  let carte = panneauOuvert(d).querySelector('a.carte');
  t.verif('panneau de catégorie : titre, résumé, date et site restent du texte', sain(carte) && carte.querySelector('.carte-titre').textContent === PIEGE);
  clic(w, panneauOuvert(d).querySelector('.categorie-fermer')); await attendre();
  const cle = Object.keys(w.sourcesData)[0];
  Object.assign(w.sourcesData[cle][0], { title: PIEGE, summary: PIEGE, host: PIEGE, date: PIEGE, source: PIEGE, image: '' });
  clic(w, [...d.querySelectorAll('.nuage .tag')].find(b => b.getAttribute('data-source-key') === cle)); await attendre();
  t.verif('panneau de source : idem', sain(panneauOuvert(d).querySelector('a.carte')));
  t.verif('aucun code du piège exécuté', w.pirate === undefined);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  // ---------- recherche : index trafiqué
  ({ w, d, erreurs } = charger('index.html', '/', {
    index: (articles) => [{ title: 'zzpiege ' + PIEGE, summary: PIEGE, source: PIEGE, host: PIEGE, date: '', image: '', url: '/', link: 'https://exemple.test/' }].concat(articles)
  }));
  await attendre(300);
  const champ = d.getElementById('recherche');
  champ.value = 'zzpiege';
  champ.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await attendre(300);
  carte = d.querySelector('#search-results-grille a.carte');
  t.verif('recherche : le résultat reste du texte', carte && sain(carte));
  t.verif('aucun code du piège exécuté', w.pirate === undefined);

  // ---------- favoris : données enregistrées ou importées trafiquées
  ({ w, d, erreurs } = charger('index.html', '/', {
    avant: (fenetre) => fenetre.localStorage.setItem('kioske_favoris', JSON.stringify({
      'https://exemple.test/a': { title: PIEGE, summary: PIEGE, host: PIEGE, source: PIEGE, url: 'javascript:window.pirate=1', image: 'javascript:window.pirate=1' },
      'https://exemple.test/b': { title: 'Favori ordinaire', url: '/articles/abc-def/', image: '/img/veille/x.jpg' },
      'https://exemple.test/c': { title: 'Double barre', url: '//exemple.test/ailleurs' }
    }))
  }));
  await attendre(300);
  clic(w, d.querySelector('.btn-favs')); await attendre();
  const cartes = [...d.querySelectorAll('#fav-grille a.carte')];
  t.verif('favoris : trois cartes', cartes.length === 3, '(' + cartes.length + ')');
  t.verif('favoris : le texte reste du texte', cartes[0] && sain(cartes[0]));
  t.verif('favoris : une adresse « javascript: » est neutralisée', cartes[0] && cartes[0].getAttribute('href') === '#' && !cartes[0].querySelector('img'));
  t.verif('favoris : une page du site est gardée', cartes[1] && cartes[1].getAttribute('href') === '/articles/abc-def/' && cartes[1].querySelector('img').getAttribute('src') === '/img/veille/x.jpg');
  t.verif('favoris : une adresse « //autre-site » est neutralisée', cartes[2] && cartes[2].getAttribute('href') === '#');
  t.verif('aucun code du piège exécuté', w.pirate === undefined);
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();
})();
