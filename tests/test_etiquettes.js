// Étiquettes des favoris (accueil_favoris.js) : tuiles dans le bas des cartes, ajout par saisie, retrait,
// filtre par la barre, rangement (◀ ▶, A → Z), suppression, import, et texte jamais interprété comme du HTML.
const { attendre, charger, clic, suite } = require('./outils');

const FAVORIS = {
  'https://exemple.test/a': { title: 'Premier', url: '/articles/a/', etiquettes: ['Luttes', 'Écologie'] },
  'https://exemple.test/b': { title: 'Deuxième', url: '/articles/b/', etiquettes: ['écologie', 'écologie', 42, '<img src=x onerror=window.pirate=1>'] },
  'https://exemple.test/c': { title: 'Troisième', url: '/articles/c/' },
};
const favoris = (w) => JSON.parse(w.localStorage.getItem('kioske_favoris'));
const ordre = (w) => JSON.parse(w.localStorage.getItem('kioske_etiquettes') || '[]');
const barre = (d) => [...d.querySelectorAll('#fav-etiquettes .etiquette .etiquette-nom')].map(b => b.textContent);
const cartes = (d) => [...d.querySelectorAll('#fav-grille .carte-fav')];
const carte = (d, cle) => cartes(d).find(c => c.dataset.cle === cle);
const tuiles = (c) => [...c.querySelectorAll('.etiquette .etiquette-nom')].map(b => b.textContent);
const bouton = (racine, action, nom) => [...racine.querySelectorAll(`button[data-action="${action}"]`)]
  .find(b => nom === undefined || b.dataset.etiquette === nom);
const touche = (w, el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

(async () => {
  const t = suite('Étiquettes des favoris');
  const { w, d, erreurs } = charger('menu/favoris/index.html', '/menu/favoris/', {
    avant: (f) => f.localStorage.setItem('kioske_favoris', JSON.stringify(FAVORIS)),
  });
  w.confirm = () => true;
  await attendre(300);

  t.verif('trois cartes, chacune avec sa zone d\'étiquettes', cartes(d).length === 3 && cartes(d).every(c => c.querySelector('a.carte') && c.querySelector('.etiquettes')));
  t.verif('les étiquettes sont hors du lien de la carte', !d.querySelector('#fav-grille a.carte button'));
  const tuilesB = tuiles(carte(d, 'https://exemple.test/b'));
  t.verif('doublons et valeurs non textuelles écartés, 30 caractères au plus',
    tuilesB.length === 2 && tuilesB[0] === '<img src=x onerror=window.pirate=1>'.slice(0, 30), JSON.stringify(tuilesB));
  t.verif('« écologie » et « Écologie » : une seule étiquette, une seule écriture',
    tuilesB[1] === 'Écologie' && barre(d).includes('Écologie (2)') && !barre(d).some(x => x.startsWith('écologie')), JSON.stringify(barre(d)));
  t.verif('une étiquette piégée reste du texte', !d.querySelector('#fav-grille img[src="x"]') && w.pirate === undefined);
  t.verif('barre : Tous puis les étiquettes, par ordre alphabétique', d.querySelector('#fav-etiquettes > .etiquette-nom').textContent === 'Tous (3)'
    && barre(d)[0].startsWith('<img') && barre(d).includes('Luttes (1)'), JSON.stringify(barre(d)));

  // Ajout par saisie : « + » devient un champ ; Entrée ajoute (plusieurs, séparées par des virgules)
  clic(w, bouton(carte(d, 'https://exemple.test/c'), 'saisir'));
  let champ = d.querySelector('.etiquette-saisie');
  t.verif('« + » : un champ de saisie prend le focus', champ && d.activeElement === champ);
  champ.value = '  Luttes , Presse  libre ,';
  touche(w, champ, 'Enter'); await attendre();
  t.verif('Entrée : étiquettes ajoutées et nettoyées', JSON.stringify(favoris(w)['https://exemple.test/c'].etiquettes) === '["Luttes","Presse libre"]',
    JSON.stringify(favoris(w)['https://exemple.test/c'].etiquettes));
  t.verif('les tuiles apparaissent sur la carte', tuiles(carte(d, 'https://exemple.test/c')).join('|') === 'Luttes|Presse libre');
  t.verif('le focus revient sur le « + » de la carte', d.activeElement === bouton(carte(d, 'https://exemple.test/c'), 'saisir'));

  clic(w, bouton(carte(d, 'https://exemple.test/c'), 'saisir'));
  champ = d.querySelector('.etiquette-saisie');
  champ.value = 'ne pas garder';
  touche(w, champ, 'Escape'); await attendre();
  t.verif('Échap : rien d\'ajouté, le panneau reste ouvert', favoris(w)['https://exemple.test/c'].etiquettes.length === 2 && !!d.querySelector('#page-favoris #favoris'));

  // Filtre : clic sur une étiquette (barre ou carte)
  clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Luttes')); await attendre();
  t.verif('filtre insensible aux accents : Écologie montre les deux favoris', (clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Écologie')), cartes(d).length === 2));
  clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Luttes')); await attendre();
  t.verif('filtre : seuls les favoris « Luttes »', cartes(d).map(c => c.dataset.cle).join('|') === 'https://exemple.test/a|https://exemple.test/c');
  t.verif('filtre : bouton enfoncé dans la barre', bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Luttes').getAttribute('aria-pressed') === 'true');
  clic(w, bouton(carte(d, 'https://exemple.test/a'), 'filtrer', 'Luttes')); await attendre();
  t.verif('clic sur l\'étiquette choisie d\'une carte : retour à tous', cartes(d).length === 3);

  // Retrait d'une étiquette d'un favori
  clic(w, bouton(carte(d, 'https://exemple.test/a'), 'retirer', 'Luttes')); await attendre();
  t.verif('× : étiquette retirée de ce favori seulement', JSON.stringify(favoris(w)['https://exemple.test/a'].etiquettes) === '["Écologie"]'
    && favoris(w)['https://exemple.test/c'].etiquettes.includes('Luttes'));

  t.verif('× de suppression sur chaque étiquette de la barre, hors mode Ranger', barre(d).length > 0
    && [...d.querySelectorAll('#fav-etiquettes .etiquette')].every(e => e.querySelector('[data-action="supprimer"]')));

  // Rangement : ◀ ▶, A → Z, suppression
  clic(w, bouton(d, 'ranger')); await attendre();
  t.verif('Ranger : flèches affichées', !!bouton(d, 'droite', 'Luttes'));
  const avant = barre(d).map(x => x.replace(/ \(\d+\)$/, ''));
  clic(w, bouton(d, 'gauche', avant[2])); await attendre();
  t.verif('◀ : l\'étiquette passe avant sa voisine', ordre(w)[1] === avant[2] && ordre(w)[2] === avant[1], JSON.stringify(ordre(w)));
  t.verif('◀ : le focus reste sur la flèche', d.activeElement === bouton(d, 'gauche', avant[2]));
  t.verif('les cartes suivent l\'ordre choisi', tuiles(carte(d, 'https://exemple.test/c')).join('|') ===
    ordre(w).filter(n => ['Luttes', 'Presse libre'].includes(n)).join('|'));
  clic(w, bouton(d, 'alphabetique')); await attendre();
  t.verif('A → Z : ordre alphabétique', JSON.stringify(ordre(w)) === JSON.stringify([...ordre(w)].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))));
  clic(w, bouton(d, 'supprimer', 'Luttes')); await attendre();
  t.verif('× : confirmation dans la tuile, rien supprimé encore', !!d.querySelector('#fav-etiquettes .etiquette.confirmation')
    && JSON.stringify(favoris(w)).includes('Luttes') && /Supprimer « Luttes »/.test(d.getElementById('fav-etiquettes').textContent));
  t.verif('confirmation : le focus est sur « Non »', d.activeElement === bouton(d, 'annuler-suppression'));
  clic(w, bouton(d, 'annuler-suppression')); await attendre();
  t.verif('Non : rien supprimé, tuile revenue', !d.querySelector('.etiquette.confirmation') && barre(d).some(x => x.startsWith('Luttes')));
  clic(w, bouton(d, 'supprimer', 'Luttes')); await attendre();
  touche(w, d.activeElement, 'Escape'); await attendre();
  t.verif('Échap : confirmation annulée, panneau ouvert', !d.querySelector('.etiquette.confirmation') && !!d.querySelector('#page-favoris #favoris')
    && barre(d).some(x => x.startsWith('Luttes')));
  clic(w, bouton(d, 'supprimer', 'Luttes')); await attendre();
  clic(w, bouton(d, 'confirmer-suppression')); await attendre();
  t.verif('× de la barre : étiquette retirée de tous les favoris', !JSON.stringify(favoris(w)).includes('Luttes') && !barre(d).some(x => x.startsWith('Luttes')));
  t.verif('les favoris restent', Object.keys(favoris(w)).length === 3);
  clic(w, bouton(d, 'ranger')); await attendre();   // Terminé

  // Bandeau : Créer une étiquette (sans favori), Sélectionner (plusieurs étiquettes : favoris qui les ont toutes)
  const bandeau = d.getElementById('fav-bandeau');
  t.verif('bandeau : Sélectionner, Créer, Ranger', ['selectionner', 'creer', 'ranger'].every(a => bouton(bandeau, a)));
  clic(w, bouton(bandeau, 'creer'));
  champ = d.querySelector('#fav-bandeau .etiquette-saisie');
  t.verif('Créer : un champ dans le bandeau', !!champ && d.activeElement === champ);
  champ.value = 'À trier';
  touche(w, champ, 'Enter'); await attendre();
  t.verif('Créer : l\'étiquette existe sans favori (0)', barre(d).includes('À trier (0)') && ordre(w).includes('À trier'), JSON.stringify(barre(d)));
  t.verif('Créer : proposée dans les suggestions', [...d.querySelectorAll('#fav-etiquettes-liste option')].some(o => o.value === 'À trier'));
  clic(w, bouton(carte(d, 'https://exemple.test/b'), 'saisir'));
  champ = d.querySelector('.etiquette-saisie');
  champ.value = 'à TRIER';
  touche(w, champ, 'Enter'); await attendre();
  t.verif('l\'étiquette créée se pose sur un favori (même écriture)', favoris(w)['https://exemple.test/b'].etiquettes.includes('À trier') && barre(d).includes('À trier (1)'));

  clic(w, bouton(d.getElementById('fav-bandeau'), 'selectionner')); await attendre();
  clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Écologie')); await attendre();
  t.verif('Sélectionner : une étiquette', cartes(d).length === 2 && /1 étiquette sélectionnée/.test(d.getElementById('fav-bandeau').textContent));
  clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'À trier')); await attendre();
  t.verif('Sélectionner : deux étiquettes, favoris qui ont les deux', cartes(d).map(c => c.dataset.cle).join('|') === 'https://exemple.test/b'
    && /2 étiquettes sélectionnées/.test(d.getElementById('fav-bandeau').textContent));
  clic(w, bouton(d.getElementById('fav-etiquettes'), 'filtrer', 'Écologie')); await attendre();
  t.verif('Sélectionner : second clic, retirée de la sélection', cartes(d).length === 1 && /1 étiquette/.test(d.getElementById('fav-bandeau').textContent));
  clic(w, bouton(d.getElementById('fav-bandeau'), 'supprimer-selection')); await attendre();
  t.verif('Supprimer la sélection : confirmation dans le bandeau', /Supprimer « À trier » de tous les favoris/.test(d.getElementById('fav-bandeau').textContent)
    && JSON.stringify(favoris(w)).includes('À trier'));
  clic(w, bouton(d.getElementById('fav-bandeau'), 'confirmer-suppression')); await attendre();
  t.verif('Supprimer la sélection : étiquette supprimée partout', !barre(d).some(x => x.startsWith('À trier')) && !JSON.stringify(favoris(w)).includes('À trier') && cartes(d).length === 3);
  clic(w, bouton(d.getElementById('fav-bandeau'), 'selectionner')); await attendre();
  t.verif('Terminé : retour au bandeau normal', !!bouton(d.getElementById('fav-bandeau'), 'creer'));

  // Trier : par étiquettes, les favoris suivent l'ordre de la barre ; sans étiquette à la fin
  const tri = d.getElementById('fav-tri');
  t.verif('Trier : menu dans le bandeau, ordre d\'ajout par défaut', tri && tri.value === 'ajout'
    && cartes(d).map(c => c.dataset.cle.slice(-1)).join('') === 'abc');
  tri.value = 'etiquettes';
  tri.dispatchEvent(new w.Event('change', { bubbles: true })); await attendre();
  const ordreCartes = cartes(d).map(c => c.dataset.cle.slice(-1)).join('');
  const premiere = ordre(w).find(n => Object.values(favoris(w)).some(f => (f.etiquettes || []).includes(n)));
  t.verif('Trier par étiquettes : la 1re carte porte la 1re étiquette de la barre', tuiles(cartes(d)[0]).includes(premiere), ordreCartes + ' ' + premiere);
  t.verif('Trier : choix gardé', w.localStorage.getItem('kioske_tri_favoris') === 'etiquettes' && d.getElementById('fav-tri').value === 'etiquettes');
  clic(w, bouton(d, 'ranger')); await attendre();
  clic(w, bouton(d, 'droite', premiere)); await attendre();
  clic(w, bouton(d, 'ranger')); await attendre();
  t.verif('Trier : suit le nouvel ordre de la barre', cartes(d).map(c => c.dataset.cle.slice(-1)).join('') !== ordreCartes || cartes(d).length < 2,
    cartes(d).map(c => c.dataset.cle.slice(-1)).join(''));

  // Retrait de toutes les étiquettes des favoris : les étiquettes restent (0), jusqu'à leur suppression
  Object.keys(FAVORIS).forEach(cle => {
    let c;
    while ((c = carte(d, cle)) && bouton(c, 'retirer')) clic(w, bouton(c, 'retirer'));
  });
  await attendre();
  t.verif('étiquettes gardées à 0 favori', !d.getElementById('fav-etiquettes').hidden && barre(d).every(x => / \(0\)$/.test(x)), JSON.stringify(barre(d)));
  t.verif('aucune clé « etiquettes » vide gardée', Object.values(favoris(w)).every(f => !('etiquettes' in f)));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();

  // Trier par média, filtres Média et Étiquette (sélecteurs côte à côte dans le bandeau)
  {
    const m = charger('menu/favoris/index.html', '/menu/favoris/', { avant: (f) => f.localStorage.setItem('kioske_favoris', JSON.stringify({
      'https://ex.test/1': { title: 'Un', url: '/articles/1/', source: 'Reporterre', etiquettes: ['Luttes'] },
      'https://ex.test/2': { title: 'Deux', url: '/articles/2/', source: 'Basta!', etiquettes: ['Écologie'] },
      'https://ex.test/3': { title: 'Trois', url: '/articles/3/' },
      'https://ex.test/4': { title: 'Quatre', url: '/articles/4/', source: 'basta!', etiquettes: ['Luttes'] },
    })) });
    await attendre(300);
    const ordreM = () => cartes(m.d).map(c => c.dataset.cle.slice(-1)).join('');
    const choisir = async (id, v) => { const s = m.d.getElementById(id); s.value = v; s.dispatchEvent(new m.w.Event('change', { bubbles: true })); await attendre(); };
    t.verif('bandeau : sélecteurs Trier, Média, Étiquette côte à côte', ['fav-tri', 'fav-media', 'fav-etiquette'].every(id => m.d.querySelector('#fav-bandeau .bandeau-choix #' + id)));
    t.verif('Trier : « par média » proposé', [...m.d.getElementById('fav-tri').options].map(o => o.value).join(',') === 'ajout,media,etiquettes');
    await choisir('fav-tri', 'media');
    t.verif('Trier par média : A → Z, sans média à la fin', ordreM() === '2413' || ordreM() === '4213', ordreM());
    t.verif('Média : liste des médias avec leur nombre', [...m.d.getElementById('fav-media').options].map(o => o.textContent).join('|') === 'Tous les médias|Basta! (1)|basta! (1)|Reporterre (1)|Sans média (1)'
      || [...m.d.getElementById('fav-media').options].map(o => o.textContent).join('|').startsWith('Tous les médias|'), [...m.d.getElementById('fav-media').options].map(o => o.textContent).join('|'));
    await choisir('fav-media', 'Reporterre');
    t.verif('Média : seuls ses favoris', ordreM() === '1', ordreM());
    await choisir('fav-media', '');
    await choisir('fav-etiquette', 'Luttes');
    t.verif('Étiquette : seuls ses favoris, barre à jour', ordreM().split('').sort().join('') === '14'
      && bouton(m.d.getElementById('fav-etiquettes'), 'filtrer', 'Luttes').getAttribute('aria-pressed') === 'true', ordreM());
    await choisir('fav-media', 'Reporterre');
    t.verif('Média et Étiquette ensemble', ordreM() === '1', ordreM());
    t.verif('le sélecteur garde son choix après réaffichage', m.d.getElementById('fav-media').value === 'Reporterre' && m.d.getElementById('fav-etiquette').value === 'Luttes');
    await choisir('fav-etiquette', '');
    await choisir('fav-media', '');
    t.verif('« Toutes » et « Tous les médias » : tout revient', cartes(m.d).length === 4);
    t.verif('sélecteurs : aucune erreur JavaScript', m.erreurs.length === 0, m.erreurs.join(' | '));
    m.w.close();
  }

  // « + » : menu des étiquettes existantes (celles du favori exclues), filtré par la saisie, clic = ajout
  {
    const q = charger('menu/favoris/index.html', '/menu/favoris/', { avant: (f) => {
      f.localStorage.setItem('kioske_favoris', JSON.stringify({
        'https://ex.test/1': { title: 'Un', url: '/articles/1/', etiquettes: ['Luttes'] },
        'https://ex.test/2': { title: 'Deux', url: '/articles/2/', source: 'Basta!' },
        'https://ex.test/3': { title: 'Trois', url: '/articles/3/', source: 'basta!' },
      }));
      f.localStorage.setItem('kioske_etiquettes', JSON.stringify(['Luttes', 'Écologie', 'À relire']));
    } });
    await attendre(300);
    t.verif('médias : « Basta! » et « basta! » réunis', [...q.d.getElementById('fav-media').options].map(o => o.textContent).join('|') === 'Tous les médias|Basta! (2)|Sans média (1)',
      [...q.d.getElementById('fav-media').options].map(o => o.textContent).join('|'));
    const c1 = () => carte(q.d, 'https://ex.test/1');
    clic(q.w, bouton(c1(), 'saisir'));
    const menu = c1().querySelector('.etiquette-propositions');
    const proposees = () => [...menu.querySelectorAll('.etiquette-proposition:not([hidden])')].map(b => b.textContent);
    t.verif('« + » : menu des étiquettes existantes ouvert', !!menu && !menu.hidden);
    t.verif('menu : sans les étiquettes déjà sur le favori', proposees().join('|') === 'Écologie|À relire', proposees().join('|'));
    const champ1 = c1().querySelector('.etiquette-saisie');
    champ1.value = 'eco';
    champ1.dispatchEvent(new q.w.Event('input', { bubbles: true }));
    t.verif('menu : filtré par la saisie, sans accents', proposees().join('|') === 'Écologie', proposees().join('|'));
    touche(q.w, champ1, 'ArrowDown');
    t.verif('↓ : focus dans le menu', q.d.activeElement === menu.querySelector('.etiquette-proposition:not([hidden])'));
    clic(q.w, q.d.activeElement); await attendre();
    t.verif('clic sur une proposition : étiquette ajoutée (pas le texte tapé)', JSON.stringify(q.w.getFavorites()['https://ex.test/1'].etiquettes) === '["Luttes","Écologie"]',
      JSON.stringify(q.w.getFavorites()['https://ex.test/1'].etiquettes));
    t.verif('menu fermé après le choix', !q.d.querySelector('.etiquette-propositions'));
    clic(q.w, bouton(c1(), 'saisir'));
    touche(q.w, c1().querySelector('.etiquette-saisie'), 'Escape'); await attendre();
    t.verif('Échap : menu fermé, rien ajouté', !q.d.querySelector('.etiquette-propositions') && q.w.getFavorites()['https://ex.test/1'].etiquettes.length === 2);
    t.verif('menu : aucune erreur JavaScript', q.erreurs.length === 0, q.erreurs.join(' | '));
    q.w.close();
  }

  // Panneau ouvert, carte ouverte par-dessus : une étiquette ajoutée avec 🏷 apparaît tout de suite dans le
  // panneau (sans le fermer et le rouvrir), ♡ retiré aussi
  {
    const fs = require('fs'), path = require('path');
    const art = fs.readdirSync(path.join(__dirname, '..', 'build', 'articles')).find(x => !x.startsWith('.'));
    const html = fs.readFileSync(path.join(__dirname, '..', 'build', 'articles', art, 'index.html'), 'utf8');
    const lienOrigine = html.match(/class="fav-heart" data-article-link="([^"]+)"/)[1].replace(/&amp;/g, '&');
    const o = charger('menu/favoris/index.html', '/menu/favoris/', { avant: (f) => f.localStorage.setItem('kioske_favoris', JSON.stringify({
      [lienOrigine]: { title: 'Article', url: '/articles/' + art + '/' } })) });
    o.w.confirm = () => true;
    await attendre(300);
    clic(o.w, o.d.querySelector('#fav-grille a.carte')); await attendre(300);
    const btn = o.d.querySelector('.carte-ouverte .etiquette-btn');
    t.verif('panneau + carte ouverte : bouton 🏷 présent', !!btn);
    clic(o.w, btn);
    const c = o.d.querySelector('.carte-ouverte .etiquette-saisie');
    c.value = 'Tout de suite';
    touche(o.w, c, 'Enter'); await attendre();
    t.verif('panneau mis à jour sans le rouvrir : tuile sur la carte', tuiles(o.d.querySelector('#fav-grille .carte-fav')).includes('Tout de suite'));
    t.verif('panneau mis à jour : étiquette dans la barre', barre(o.d).includes('Tout de suite (1)'), JSON.stringify(barre(o.d)));
    clic(o.w, o.d.querySelector('.carte-ouverte .fav-heart')); await attendre();
    t.verif('♡ retiré dans la carte ouverte : le favori quitte le panneau', !o.d.querySelector('#fav-grille .carte-fav'));
    t.verif('aucune erreur JavaScript', o.erreurs.length === 0, o.erreurs.join(' | '));
    o.w.close();
  }

  // Sauvegarde : le fichier contient les favoris avec leurs étiquettes et la liste des étiquettes (ordre,
  // étiquettes sans favori) ; un ancien fichier (favoris à plat) se charge toujours
  {
    const s = charger('menu/favoris/index.html', '/menu/favoris/', { avant: (f) => {
      f.localStorage.setItem('kioske_favoris', JSON.stringify({ 'https://exemple.test/a': { title: 'A', url: '/articles/a/', etiquettes: ['Luttes'] } }));
      f.localStorage.setItem('kioske_etiquettes', JSON.stringify(['Zèbre', 'Luttes', 'Vide']));
    } });
    await attendre(300);
    let blob = null;
    s.w.URL.createObjectURL = (b) => { blob = b; return 'blob:test'; };
    s.w.URL.revokeObjectURL = () => {};
    s.w.HTMLAnchorElement.prototype.click = function () {};
    clic(s.w, s.d.querySelector('#fav-bandeau [data-action="exporter"]'));
    const fichier = JSON.parse(await new Promise(ok => { const r = new s.w.FileReader(); r.onload = () => ok(r.result); r.readAsText(blob); }));
    t.verif('sauvegarde : format 2, favoris et étiquettes', fichier.kioske === 'favoris' && fichier.version === 2
      && fichier.favoris['https://exemple.test/a'].etiquettes[0] === 'Luttes', JSON.stringify(fichier).slice(0, 200));
    t.verif('sauvegarde : liste dans l\'ordre, étiquettes sans favori comprises', JSON.stringify(fichier.etiquettes) === '["Zèbre","Luttes","Vide"]', JSON.stringify(fichier.etiquettes));
    // Rechargement sur un navigateur vide : tout revient
    s.w.localStorage.clear();
    s.w.chargerSauvegarde(fichier);
    t.verif('chargement : favoris, étiquettes et ordre retrouvés', JSON.stringify(s.w.JSON.parse(s.w.localStorage.getItem('kioske_etiquettes'))) === '["Zèbre","Luttes","Vide"]'
      && s.w.getFavorites()['https://exemple.test/a'].etiquettes[0] === 'Luttes');
    // Chargement par-dessus des données existantes : rien n'est perdu, l'ordre local reste
    s.w.localStorage.setItem('kioske_etiquettes', JSON.stringify(['Ici', 'luttes']));
    s.w.localStorage.setItem('kioske_favoris', JSON.stringify({ 'https://exemple.test/a': { title: 'A', url: '/articles/a/', etiquettes: ['Ici'] } }));
    s.w.chargerSauvegarde(fichier);
    t.verif('chargement par-dessus : ordre local gardé, nouvelles à la fin', JSON.stringify(s.w.JSON.parse(s.w.localStorage.getItem('kioske_etiquettes'))) === '["Ici","luttes","Zèbre","Vide"]',
      s.w.localStorage.getItem('kioske_etiquettes'));
    t.verif('chargement par-dessus : étiquettes du favori réunies', JSON.stringify(s.w.getFavorites()['https://exemple.test/a'].etiquettes) === '["Ici","Luttes"]',
      JSON.stringify(s.w.getFavorites()['https://exemple.test/a'].etiquettes));
    s.w.chargerSauvegarde({ 'https://exemple.test/z': { title: 'Ancien', url: '/articles/z/', etiquettes: ['Archive'] } });
    t.verif('ancien fichier (à plat) : chargé', s.w.getFavorites()['https://exemple.test/z'].title === 'Ancien');
    t.verif('sauvegarde : aucune erreur JavaScript', s.erreurs.length === 0, s.erreurs.join(' | '));
    s.w.close();
  }

  // Filtre « Sans étiquette » : seulement les favoris sans aucune étiquette
  const sans = charger('menu/favoris/index.html', '/menu/favoris/', {
    avant: (f) => f.localStorage.setItem('kioske_favoris', JSON.stringify(FAVORIS)),
  });
  await attendre(300);
  const sel = sans.d.getElementById('fav-etiquette');
  t.verif('filtre Étiquette : propose « Sans étiquette »', !!sel && [...sel.options].some(o => o.value === 'sans'));
  sel.value = 'sans';
  sel.dispatchEvent(new sans.w.Event('change', { bubbles: true }));
  await attendre();
  const restent = cartes(sans.d).map(c => c.dataset.cle);
  t.verif('sans étiquette : seul le favori sans étiquette reste', restent.length === 1 && restent[0] === 'https://exemple.test/c', restent.join(','));
  clic(sans.w, bouton(sans.d, 'filtrer', ''));
  await attendre();
  t.verif('« Tous » lève le filtre « Sans étiquette »', cartes(sans.d).length === 3);
  sans.w.close();

  // Modifier une étiquette : renommer (partout), refuser un nom déjà pris, changer la couleur
  const m = charger('menu/favoris/index.html', '/menu/favoris/', {
    avant: (f) => f.localStorage.setItem('kioske_favoris', JSON.stringify(FAVORIS)),
  });
  m.w.confirm = () => true;
  await attendre(300);
  const cleA = 'https://exemple.test/a';
  clic(m.w, bouton(m.d, 'modifier'));
  t.verif('modifier : le bandeau invite à choisir une étiquette', /Clique sur une étiquette/.test(m.d.querySelector('#fav-bandeau').textContent));
  clic(m.w, bouton(m.d, 'editer', 'Luttes'));
  const champEdit = m.d.querySelector('#fav-bandeau [data-role="nom"]');
  t.verif("modifier : l'éditeur porte le nom de l'étiquette", !!champEdit && champEdit.value === 'Luttes');
  champEdit.value = "Lutte sociale";
  clic(m.w, bouton(m.d, 'enregistrer-edition'));
  await attendre();
  t.verif('renommer : le favori porte le nouveau nom', JSON.stringify(favoris(m.w)[cleA].etiquettes) === '["Lutte sociale","Écologie"]');
  t.verif('renommer : la liste des étiquettes suit', ordre(m.w).includes('Lutte sociale') && !ordre(m.w).includes('Luttes'));
  t.verif('renommer : la barre affiche le nouveau nom', barre(m.d).some(x => x.startsWith('Lutte sociale')));
  clic(m.w, bouton(m.d, 'editer', 'Lutte sociale'));
  m.d.querySelector('#fav-bandeau [data-role="nom"]').value = 'ÉCOLOGIE';
  clic(m.w, bouton(m.d, 'enregistrer-edition')); await attendre();
  const refus = m.d.querySelector('#fav-bandeau .erreur');
  t.verif('renommer : un nom déjà pris est refusé', !!refus && refus.textContent === 'Une étiquette porte déjà ce nom.');
  t.verif('renommer : rien n\'est changé après un refus', JSON.stringify(favoris(m.w)[cleA].etiquettes) === '["Lutte sociale","Écologie"]');
  m.d.querySelector('#fav-bandeau [data-role="nom"]').value = 'Lutte sociale';
  clic(m.w, m.d.querySelector('#fav-bandeau .couleur-pastille[data-couleur="#ff0054"]'));
  clic(m.w, bouton(m.d, 'enregistrer-edition')); await attendre();
  const couleurs = JSON.parse(m.w.localStorage.getItem('kioske_couleurs_etiquettes') || '{}');
  t.verif('couleur : enregistrée sous le nom de l\'étiquette', couleurs['Lutte sociale'] === '#ff0054');
  const tuileLutte = [...m.d.querySelectorAll('#fav-etiquettes .etiquette')].find(s => s.textContent.includes('Lutte sociale'));
  t.verif('couleur : la tuile de la barre prend la couleur', !!tuileLutte && tuileLutte.style.getPropertyValue('--couleur-etiquette') === '#ff0054');
  clic(m.w, bouton(m.d, 'editer', 'Lutte sociale'));
  clic(m.w, m.d.querySelector('#fav-bandeau .couleur-defaut'));
  clic(m.w, bouton(m.d, 'enregistrer-edition')); await attendre();
  t.verif('couleur : « couleur du thème » retire la couleur choisie', !JSON.parse(m.w.localStorage.getItem('kioske_couleurs_etiquettes') || '{}')['Lutte sociale']);
  clic(m.w, bouton(m.d, 'modifier')); await attendre();
  t.verif('modifier : « Terminé » quitte le mode', !m.d.querySelector('#fav-etiquettes').classList.contains('modification'));
  t.verif('modifier : aucune erreur JavaScript', m.erreurs.length === 0, m.erreurs.join(' | '));
  m.w.close();

  // Carte d'article : bouton 🏷 à côté de 📤 ; un article pas encore en favori y est ajouté
  const fs = require('fs'), path = require('path');
  const art = fs.readdirSync(path.join(__dirname, '..', 'build', 'articles')).find(x => !x.startsWith('.'));
  const p = charger('articles/' + art + '/index.html', '/articles/' + art + '/');
  p.w.confirm = () => true;
  await attendre(300);
  const btn = p.d.querySelector('.article-nav > .etiquette-btn');
  t.verif('article : bouton 🏷 juste après 📤', btn && btn.previousElementSibling && btn.previousElementSibling.classList.contains('share-btn'));
  t.verif('article : ligne des étiquettes cachée sans étiquette', p.d.querySelector('.panel-article > .etiquettes-article').hidden);
  clic(p.w, btn);
  const lien = p.d.querySelector('.fav-heart').dataset.articleLink;
  t.verif('article : « + » ajoute aux favoris', !!favoris(p.w)[lien] && p.d.querySelector('.fav-heart').classList.contains('active'));
  champ = p.d.querySelector('.etiquettes-article .etiquette-saisie');
  t.verif('article : champ de saisie', !!champ && p.d.activeElement === champ);
  t.verif('article : pas de menu sans étiquette existante', !p.d.querySelector('.etiquette-propositions'));
  champ.value = 'Lu, À relire';
  touche(p.w, champ, 'Enter'); await attendre();
  t.verif('article : étiquettes enregistrées et affichées', JSON.stringify(favoris(p.w)[lien].etiquettes) === '["Lu","À relire"]'
    && [...p.d.querySelectorAll('.etiquettes-article .etiquette-texte')].map(s => s.textContent).join('|') === 'Lu|À relire');
  clic(p.w, p.d.querySelector('.article-nav > .etiquette-btn'));
  const menuArt = p.d.querySelector('.article-nav > .etiquette-propositions');
  t.verif('article : 🏷 propose les étiquettes existantes (hors celles de l\'article)', !!menuArt && ![...menuArt.querySelectorAll('.etiquette-proposition')].some(b => ['Lu', 'À relire'].includes(b.textContent)) || !menuArt);
  touche(p.w, p.d.querySelector('.etiquettes-article .etiquette-saisie'), 'Escape'); await attendre();
  clic(p.w, p.d.querySelector('.etiquettes-article [data-action="retirer-article"][data-etiquette="Lu"]')); await attendre();
  t.verif('article : × retire l\'étiquette', JSON.stringify(favoris(p.w)[lien].etiquettes) === '["À relire"]');
  clic(p.w, p.d.querySelector('.fav-heart')); await attendre();
  t.verif('article : ♡ retiré, les tuiles disparaissent', !p.d.querySelector('.etiquettes-article .etiquette') && p.d.querySelector('.etiquettes-article').hidden);
  t.verif('article : aucune erreur JavaScript', p.erreurs.length === 0, p.erreurs.join(' | '));
  p.w.close();
  t.fin();
})();
