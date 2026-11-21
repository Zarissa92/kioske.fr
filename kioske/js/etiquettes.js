// Étiquettes des favoris : stockage, règles et saisie, communs au panneau « Mes favoris » (accueil_favoris.js)
// et à la carte d'article (ouverte par-dessus la page, ou page d'article) : bouton 🏷 à côté de 📤.
// Le stockage des favoris est dans favoris.js (getFavorites, saveFavorites).
//
// Chaque favori garde ses étiquettes dans favorites[clé].etiquettes (liste de textes) : elles partent avec
// « Télécharger mes favoris » et reviennent avec « Charger des favoris ». La liste des étiquettes, dans l'ordre
// choisi, est à part dans kioske_etiquettes : une étiquette créée existe même sans favori, jusqu'à sa suppression.
// Une étiquette d'un favori qui n'y est pas encore (fichier importé) vient à la fin, par ordre alphabétique.
// « Tout remettre par défaut » (Paramètres) ne touche à rien de tout cela : ce sont des données, pas des réglages.
const CLE_ORDRE_ETIQUETTES = 'kioske_etiquettes';
const CLE_COULEURS_ETIQUETTES = 'kioske_couleurs_etiquettes';   // { nom: '#rrggbb' } : seulement les couleurs choisies
// Palette proposée pour une étiquette (sans choix : la couleur du thème, --color-fav-heart)
const PALETTE_ETIQUETTES = ['#7fe5ff', '#ffd0dd', '#b57bff', '#ff0054', '#ffb347', '#c6f35a', '#ffe066', '#ffffff'];
const ETIQUETTE_MAX = 30;             // caractères d'une étiquette
const ETIQUETTES_PAR_FAVORI = 12;

// Majuscules et accents ne comptent pas : « écologie » et « Écologie » sont la même étiquette
const comparerNoms = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' });
const memeNom = (a, b) => comparerNoms(a, b) === 0;

function nettoyerEtiquette(texte) {
  return String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, ETIQUETTE_MAX);
}

// Étiquettes d'un favori, nettoyées et sans doublon : un fichier importé peut contenir n'importe quoi
function etiquettesDe(data) {
  const resultat = [];
  (Array.isArray(data && data.etiquettes) ? data.etiquettes : []).forEach(e => {
    const nom = typeof e === 'string' ? nettoyerEtiquette(e) : '';
    if (nom && !resultat.some(x => memeNom(x, nom))) resultat.push(nom);
  });
  return resultat.slice(0, ETIQUETTES_PAR_FAVORI);
}

function lireOrdreEtiquettes() {
  try {
    const ordre = JSON.parse(localStorage.getItem(CLE_ORDRE_ETIQUETTES) || '[]');
    if (!Array.isArray(ordre)) return [];
    const resultat = [];
    ordre.forEach(e => {
      const nom = typeof e === 'string' ? nettoyerEtiquette(e) : '';
      if (nom && !resultat.some(x => memeNom(x, nom))) resultat.push(nom);
    });
    return resultat;
  } catch (e) {
    return [];
  }
}

function ecrireOrdreEtiquettes(ordre) {
  try { localStorage.setItem(CLE_ORDRE_ETIQUETTES, JSON.stringify(ordre)); } catch (e) {}
}

// Couleurs choisies, par nom d'étiquette. Une étiquette absente de la liste garde la couleur du thème.
function lireCouleurs() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_COULEURS_ETIQUETTES) || '{}');
    const couleurs = {};
    if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
      Object.entries(brut).forEach(([nom, couleur]) => {
        const propre = nettoyerEtiquette(nom);
        if (propre && typeof couleur === 'string' && /^#[0-9a-f]{6}$/i.test(couleur)) couleurs[propre] = couleur.toLowerCase();
      });
    }
    return couleurs;
  } catch (e) {
    return {};
  }
}

function ecrireCouleurs(couleurs) {
  try { localStorage.setItem(CLE_COULEURS_ETIQUETTES, JSON.stringify(couleurs)); } catch (e) {}
}

function couleurDe(nom, couleurs = lireCouleurs()) {
  const cle = Object.keys(couleurs).find(e => memeNom(e, nom));
  return cle ? couleurs[cle] : null;
}

// Pose la couleur choisie sur une tuile (la tuile et ses enfants lisent --couleur-etiquette) ; sans couleur
// choisie, la tuile garde celle du thème.
function appliquerCouleur(tuile, nom, couleurs = lireCouleurs()) {
  const couleur = couleurDe(nom, couleurs);
  if (couleur) tuile.style.setProperty('--couleur-etiquette', couleur);
  else tuile.style.removeProperty('--couleur-etiquette');
  return tuile;
}

// Sans doublon (majuscules et accents ne comptent pas), dans l'ordre
const sansDoublon = (noms) => noms.filter((nom, i) => noms.findIndex(x => memeNom(x, nom)) === i);

// Modifie une étiquette : nouveau nom (mêmes règles que la saisie) et couleur (null : couleur du thème).
// Le renommage suit partout : la liste, chaque favori qui la porte, la couleur. Un nom déjà pris par une autre
// étiquette est refusé (rien n'est fusionné en silence). Renvoie '' ou le message d'erreur à afficher.
function modifierEtiquette(ancien, nouveau, couleur) {
  const propre = nettoyerEtiquette(nouveau);
  if (!propre) return 'Donne un nom à l\'étiquette.';
  const liste = etiquettesRangees().liste;
  if (liste.some(e => memeNom(e, propre) && !memeNom(e, ancien))) return 'Une étiquette porte déjà ce nom.';
  const couleurs = lireCouleurs();
  Object.keys(couleurs).forEach(e => { if (memeNom(e, ancien)) delete couleurs[e]; });
  if (couleur) couleurs[propre] = couleur;
  ecrireCouleurs(couleurs);
  const favorites = getFavorites();
  Object.values(favorites).forEach(data => {
    if (!data || typeof data !== 'object' || !Array.isArray(data.etiquettes)) return;
    if (!etiquettesDe(data).some(e => memeNom(e, ancien))) return;
    data.etiquettes = sansDoublon(etiquettesDe(data).map(e => memeNom(e, ancien) ? propre : e));
  });
  ecrireOrdreEtiquettes(sansDoublon(liste.map(e => memeNom(e, ancien) ? propre : e)));
  saveFavorites(favorites);
  return '';
}

// Toutes les étiquettes, dans l'ordre choisi, avec le nombre de favoris de chacune (0 pour une étiquette créée
// et pas encore posée). canonique(nom) donne l'écriture gardée : celle de la liste, sinon la première vue.
function etiquettesRangees(favorites = getFavorites()) {
  const ordre = lireOrdreEtiquettes();
  const comptes = new Map(ordre.map(nom => [nom, 0]));
  const trouver = (nom) => [...comptes.keys()].find(e => memeNom(e, nom));
  Object.values(favorites).forEach(data => etiquettesDe(data).forEach(nom => {
    const c = trouver(nom) || nom;
    comptes.set(c, (comptes.get(c) || 0) + 1);
  }));
  const nouvelles = [...comptes.keys()].filter(nom => !ordre.includes(nom)).sort(comparerNoms);
  const liste = ordre.concat(nouvelles);
  return { liste, comptes, canonique: (nom) => liste.find(e => memeNom(e, nom)) || nom };
}

// Texte saisi : une ou plusieurs étiquettes séparées par des virgules. Une étiquette qui existe déjà avec
// d'autres majuscules ou accents prend l'écriture existante.
function nomsSaisis(texte) {
  const { canonique } = etiquettesRangees();
  const noms = [];
  String(texte).split(',').map(nettoyerEtiquette).filter(Boolean).map(canonique)
    .forEach(nom => { if (!noms.some(x => memeNom(x, nom))) noms.push(nom); });
  return noms;
}

// Ajoute des étiquettes à la liste (à la fin) : elles existent désormais, même sans favori
function creerEtiquettes(noms) {
  const liste = etiquettesRangees().liste;
  noms.forEach(nom => { if (!liste.some(e => memeNom(e, nom))) liste.push(nom); });
  ecrireOrdreEtiquettes(liste);
}

function modifierEtiquettesFavori(cle, modifier) {
  const favorites = getFavorites();
  const data = favorites[cle];
  if (!data || typeof data !== 'object') return;
  const etiquettes = modifier(etiquettesDe(data)).slice(0, ETIQUETTES_PAR_FAVORI);
  if (etiquettes.length) data.etiquettes = etiquettes;
  else delete data.etiquettes;
  saveFavorites(favorites);
}

function ajouterEtiquettes(cle, texte) {
  const noms = nomsSaisis(texte);
  if (!noms.length) return;
  creerEtiquettes(noms);
  modifierEtiquettesFavori(cle, liste => {
    noms.forEach(nom => { if (!liste.some(e => memeNom(e, nom))) liste.push(nom); });
    return liste;
  });
}

function retirerEtiquette(cle, nom) {
  modifierEtiquettesFavori(cle, liste => liste.filter(x => !memeNom(x, nom)));
}

// Supprime des étiquettes : de la liste et de tous les favoris (les favoris restent). Sans confirmation ici :
// elle est demandée avant, dans la page (« Supprimer … ? Oui / Non », accueil_favoris.js).
function supprimerEtiquettes(noms) {
  if (!noms.length) return false;
  const garder = (e) => !noms.some(nom => memeNom(e, nom));
  const favorites = getFavorites();
  Object.values(favorites).forEach(data => {
    if (!data || typeof data !== 'object' || !Array.isArray(data.etiquettes)) return;
    const reste = etiquettesDe(data).filter(garder);
    if (reste.length) data.etiquettes = reste;
    else delete data.etiquettes;
  });
  ecrireOrdreEtiquettes(etiquettesRangees(favorites).liste.filter(garder));
  saveFavorites(favorites);
  return true;
}

function boutonEtiquette(classe, texte, libelle, action, nom) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  if (libelle) { b.setAttribute('aria-label', libelle); b.title = libelle; }
  b.dataset.action = action;
  if (nom !== undefined) b.dataset.etiquette = nom;
  return b;
}

// Suggestions des champs de saisie (<datalist id="fav-etiquettes-liste">, panneaux_communs.html)
function remplirSuggestions(liste = etiquettesRangees().liste) {
  const suggestions = document.getElementById('fav-etiquettes-liste');
  if (!suggestions) return;
  suggestions.replaceChildren(...liste.map(nom => {
    const o = document.createElement('option');
    o.value = nom;
    return o;
  }));
}

// Remplace un bouton par un champ de saisie. Entrée ou sortie du champ : valider(texte) ; Échap : annuler().
// Échap ne remonte pas : il ne ferme ni le panneau ni la carte ouverte.
// ancre (facultatif) : élément où poser le menu des étiquettes existantes (style_favoris.css le place). Le menu
// s'ouvre avec le champ : chaque étiquette qui n'est pas dans exclure est une tuile ; un clic l'ajoute tout de
// suite. Le texte tapé filtre le menu (sans majuscules ni accents). Clavier : ↓ entre dans le menu, ↑ ↓ s'y
// déplacent, Échap annule.
function saisirEtiquette(bouton, { libelle, valider, annuler, ancre = null, exclure = [] }) {
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.className = 'etiquette-saisie';
  champ.maxLength = 200;
  champ.setAttribute('aria-label', libelle + ' (plusieurs : séparées par des virgules)');
  champ.placeholder = 'étiquette…';
  champ.autocomplete = 'off';
  remplirSuggestions();

  const existantes = ancre ? etiquettesRangees().liste.filter(nom => !exclure.some(e => memeNom(e, nom))) : [];
  let menu = null;
  if (existantes.length) {
    menu = document.createElement('div');
    menu.className = 'etiquette-propositions';
    menu.id = 'etiquette-propositions';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Étiquettes existantes');
    const titre = document.createElement('p');
    titre.className = 'propositions-titre';
    titre.textContent = 'Étiquettes existantes';
    menu.appendChild(titre);
    existantes.forEach(nom => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'etiquette-proposition';
      b.textContent = nom;
      b.dataset.etiquette = nom;
      b.addEventListener('mousedown', e => e.preventDefault());   // le champ garde le focus : pas de fermeture
      b.addEventListener('click', () => terminer(true, nom));
      menu.appendChild(b);
    });
    champ.setAttribute('aria-controls', menu.id);
  }
  const propositions = () => menu ? [...menu.querySelectorAll('.etiquette-proposition:not([hidden])')] : [];
  // Filtre : le dernier morceau tapé (après la dernière virgule)
  const filtrer = () => {
    if (!menu) return;
    const tape = nettoyerEtiquette(champ.value.split(',').pop()).toLocaleLowerCase('fr');
    const sansAccent = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    menu.querySelectorAll('.etiquette-proposition').forEach(b => {
      b.hidden = !!tape && !sansAccent(b.dataset.etiquette.toLocaleLowerCase('fr')).includes(sansAccent(tape));
    });
    menu.hidden = propositions().length === 0;
  };

  let fini = false;
  function terminer(garder, nom) {
    if (fini) return;
    fini = true;
    menu?.remove();
    if (nom) valider(nom);
    else if (garder && champ.value.trim()) valider(champ.value);
    else annuler();
  }
  // Le focus quitte le champ et le menu : la saisie se termine (comme Entrée)
  const sortie = (e) => {
    const vers = e.relatedTarget;
    if (vers && (vers === champ || (menu && menu.contains(vers)))) return;
    setTimeout(() => {
      const actif = document.activeElement;
      if (actif === champ || (menu && menu.contains(actif))) return;
      terminer(true);
    }, 0);
  };
  champ.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); terminer(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminer(false); }
    else if (e.key === 'ArrowDown' && propositions().length) { e.preventDefault(); propositions()[0].focus(); }
  });
  champ.addEventListener('input', filtrer);
  champ.addEventListener('blur', sortie);
  if (menu) {
    menu.addEventListener('focusout', sortie);
    menu.addEventListener('keydown', e => {
      const liste = propositions(), i = liste.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminer(false); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (liste[i + 1] || liste[i])?.focus(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (i > 0 ? liste[i - 1] : champ).focus(); }
    });
  }
  bouton.replaceWith(champ);
  if (menu) ancre.appendChild(menu);
  champ.focus();
  return champ;
}

// ----- Carte d'article (ouverte ou page d'article). Bouton 🏷 dans la barre du bas, à côté de 📤, même style que
// ♡ et 📤 : il ouvre la saisie ; un article qui n'est pas en favori y est ajouté d'abord (comme un clic sur ♡).
// Les étiquettes de l'article sont sur leur ligne, au-dessus de la barre (cachée s'il n'y en a pas).
// Les étiquettes d'un article sont une colonne dans le coin en haut à droite du panneau de l'article
// (et non dans la barre des boutons, qui est collante) : la zone est posée dans le panneau.
function panneauDe(nav) {
  return nav.closest('.panel-article') || nav;
}

function zoneEtiquettesArticle(nav, cle, favorites, canonique) {
  if (!nav.querySelector(':scope > .etiquette-btn')) {
    const bouton = boutonEtiquette('etiquette-btn', '🏷️', 'Ajouter une étiquette', 'saisir-article');
    const partage = nav.querySelector(':scope > .share-btn');
    if (partage) partage.after(bouton);
    else nav.querySelector(':scope > .fav-heart')?.after(bouton);
  }
  let zone = panneauDe(nav).querySelector(':scope > .etiquettes-article');
  if (!zone) {
    zone = document.createElement('div');
    zone.className = 'etiquettes etiquettes-article';
    zone.setAttribute('role', 'group');
    zone.setAttribute('aria-label', 'Étiquettes de cet article');
    panneauDe(nav).prepend(zone);
  }
  const etiquettes = etiquettesDe(favorites[cle]).map(canonique);
  zone.replaceChildren();
  zone.hidden = etiquettes.length === 0;
  const couleurs = lireCouleurs();
  etiquettes.forEach(nom => {
    const tuile = appliquerCouleur(document.createElement('span'), nom, couleurs);
    tuile.className = 'etiquette';
    const texte = document.createElement('span');
    texte.className = 'etiquette-texte';
    texte.textContent = nom;
    tuile.append(texte, boutonEtiquette('etiquette-retirer', '×', `Retirer l'étiquette « ${nom} » de cet article`, 'retirer-article', nom));
    zone.appendChild(tuile);
  });
  nav.querySelector(':scope > .etiquette-btn').disabled = etiquettes.length >= ETIQUETTES_PAR_FAVORI;
}

function rafraichirEtiquettesArticles() {
  const favorites = getFavorites();
  const { canonique } = etiquettesRangees(favorites);
  document.querySelectorAll('.panel-article .fav-heart[data-article-link]').forEach(coeur => {
    const nav = coeur.closest('.article-nav');
    if (nav) zoneEtiquettesArticle(nav, coeur.dataset.articleLink, favorites, canonique);
  });
}

document.addEventListener('click', e => {
  const bouton = e.target.closest('.article-nav button[data-action="saisir-article"], .etiquettes-article button[data-action]');
  if (!bouton) return;
  const hote = bouton.closest('.panel-article') || bouton.closest('.article-nav')?.parentElement;
  const nav = hote && hote.querySelector('.article-nav');
  const coeur = nav && nav.querySelector('.fav-heart[data-article-link]');
  if (!coeur) return;
  const cle = coeur.dataset.articleLink;
  const btn = () => nav.querySelector(':scope > .etiquette-btn');
  if (bouton.dataset.action === 'retirer-article') {
    retirerEtiquette(cle, bouton.dataset.etiquette);
    btn()?.focus();
  } else if (bouton.dataset.action === 'saisir-article') {
    if (!getFavorites()[cle]) coeur.click();   // ajoute aux favoris (♡, avec son animation)
    const zone = panneauDe(nav).querySelector(':scope > .etiquettes-article');
    if (!zone || !getFavorites()[cle] || zone.querySelector('.etiquette-saisie')) return;
    // Le champ s'ouvre au début de la ligne des étiquettes
    const place = document.createElement('span');
    zone.prepend(place);
    zone.hidden = false;
    const fin = () => { rafraichirEtiquettesArticles(); btn()?.focus(); };
    saisirEtiquette(place, {
      libelle: 'Nouvelle étiquette pour cet article',
      ancre: nav,
      exclure: etiquettesDe(getFavorites()[cle]),
      valider: (texte) => { ajouterEtiquettes(cle, texte); fin(); },
      annuler: fin,
    });
  }
});

// Favoris modifiés (♡, étiquettes, import…) : saveFavorites (favoris.js) prévient, les cartes suivent
document.addEventListener('kioske-favoris', rafraichirEtiquettesArticles);
rafraichirEtiquettesArticles();   // page d'article ; la carte ouverte appelle la fonction à l'affichage
