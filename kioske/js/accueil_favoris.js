// Page « Mes favoris » (/menu/favoris/) : affichage, étiquettes, anciens favoris complétés, import, export, effacement.
// Le stockage et le cœur ♡ sont dans favoris.js.
// Favoris : getFavorites(), saveFavorites(), toggleFavorite() et updateHearts() sont dans favoris.js.

// Adresse venue des favoris enregistrés ou d'un fichier importé : gardée seulement si c'est un chemin
// du site ou une adresse http(s), pour qu'un fichier trafiqué ne puisse pas glisser « javascript: ».
function adresseSure(adresse, defaut = '#') {
  const a = String(adresse || '');
  if (/^\/(?![\/\\])/.test(a) || /^https?:\/\//i.test(a)) return a;
  return defaut;
}

// « Mes favoris » est une page : /menu/favoris/ (écrite par render_page_favoris, kioske/rendu.py ; hors du Menu, sans sommaire). Son repère <div id="page-favoris">
// reçoit le contenu du panneau #favoris (gabarit panneaux_communs.html, présent dans toutes les pages), posé
// dans la page au lieu d'être affiché par-dessus. Le ♡ de la barre est un lien vers cette page.
const PAGE_FAVORIS = '/menu/favoris/';
const pageFavoris = () => document.getElementById('page-favoris');

// Affiche les favoris : sur la page, tout de suite ; ailleurs, en allant sur la page
function openFavoritesPanel() {
  if (!pageFavoris()) { location.href = PAGE_FAVORIS; return; }
  afficherFavoris(getFavorites());
  completerFavoris();
}

// La page est-elle affichée (page « Mes favoris », ou ancien panneau ouvert) ?
function favorisVisibles() {
  if (pageFavoris()) return true;
  const conteneur = document.getElementById('container-favoris');
  return !!conteneur && !conteneur.hidden;
}

(function installerPageFavoris() {
  const place = pageFavoris();
  const panneau = document.getElementById('favoris');
  if (!place || !panneau) return;
  panneau.classList.remove('categorie-panneau');
  panneau.classList.add('favoris-page');
  panneau.querySelector(':scope > .categorie-fermer')?.remove();
  panneau.querySelector(':scope > h2')?.remove();       // le titre de la page suffit
  place.appendChild(panneau);
  // Après le chargement de tout le bundle (fonctions et constantes des étiquettes déclarées plus bas)
  const afficher = () => openFavoritesPanel();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afficher);
  else setTimeout(afficher, 0);
})();

// ----- Étiquettes dans « Mes favoris ». Stockage, règles et saisie : etiquettes.js.
// Au-dessus de la grille : la barre des étiquettes (« Tous », puis chacune avec son nombre de favoris ; clic :
// filtre), puis le bandeau d'outils : « Sélectionner », « Créer une étiquette », « Ranger ».
//   Sélectionner : un clic sur une étiquette l'ajoute à la sélection ou l'en retire ; la grille montre les
//                  favoris qui portent toutes les étiquettes choisies ; « Supprimer » retire la sélection.
//   Ranger       : ◀ ▶ pour l'ordre, × pour supprimer une étiquette, « A → Z ».
// Trois sélecteurs côte à côte dans le bandeau :
//   Trier     : ordre des cartes. « ordre d'ajout » (celui de l'enregistrement), « par média » (nom du média,
//               de A à Z ; à égalité, ordre d'ajout) ou « par étiquettes » (les favoris suivent l'ordre des
//               étiquettes de la barre, ceux sans étiquette à la fin). Gardé dans kioske_tri_favoris (réglage :
//               REGLAGES de theme.js).
//   Média     : n'afficher que les favoris d'un média (« Tous les médias » : pas de filtre).
//   Étiquette : n'afficher que les favoris d'une étiquette (même filtre qu'un clic dans la barre).
// Les filtres s'additionnent : média et étiquettes à la fois.
const CLE_TRI_FAVORIS = 'kioske_tri_favoris';
const TRIS_FAVORIS = [['ajout', 'ordre d\'ajout'], ['media', 'par média'], ['etiquettes', 'par étiquettes']];
function lireTriFavoris() {
  try {
    const tri = localStorage.getItem(CLE_TRI_FAVORIS);
    return TRIS_FAVORIS.some(([v]) => v === tri) ? tri : 'ajout';
  } catch (e) { return 'ajout'; }
}
const SANS_MEDIA = 'Sans média';
// Média d'un favori : la source (nom affiché sur le site), sinon le site d'origine
function nomMedia(data) {
  return String(data.source || data.host || '').replace(/\s+/g, ' ').trim() || SANS_MEDIA;
}
let etiquettesChoisies = [];          // filtre de la grille ([] : tous les favoris)
let sansEtiquette = false;            // filtre : seulement les favoris sans aucune étiquette
let mediaChoisi = '';                 // filtre « Média » ('' : tous les médias)
let modeEtiquettes = '';              // '' | 'selection' | 'rangement' | 'modification'
let edition = null;                   // étiquette ouverte pour modification : { nom, brouillon, couleur, erreur }
// Suppression en attente de confirmation (null : aucune). Le × d'une étiquette de la barre, ou « Supprimer »
// en mode Sélectionner, demande d'abord « Supprimer … ? Oui / Non » dans la page (pas de fenêtre du navigateur).
// Oui : l'étiquette quitte la liste et tous les favoris (les favoris restent). Non, Échap ou toute autre action : rien.
let aSupprimer = null;

function afficherFavoris(favorites) {
  const favGrille = document.getElementById('fav-grille');
  const { liste, comptes, canonique } = etiquettesRangees(favorites);
  // Étiquettes venues d'un fichier importé : inscrites dans la liste, elles restent après leur dernier favori
  if (liste.length !== lireOrdreEtiquettes().length) ecrireOrdreEtiquettes(liste);
  etiquettesChoisies = etiquettesChoisies.filter(nom => liste.includes(nom));
  // Médias des favoris, avec leur nombre, de A à Z (« Sans média » à la fin)
  // Majuscules et accents ne comptent pas (« Basta! » = « basta! ») : la première écriture vue est gardée
  const medias = new Map();
  const mediaDe = new Map();          // favori → nom du média tel qu'affiché
  Object.values(favorites).forEach(data => {
    if (!data || typeof data !== 'object') return;
    const nom = [...medias.keys()].find(m => memeNom(m, nomMedia(data))) || nomMedia(data);
    mediaDe.set(data, nom);
    medias.set(nom, (medias.get(nom) || 0) + 1);
  });
  if (mediaChoisi && !medias.has(mediaChoisi)) mediaChoisi = '';
  afficherBarreEtiquettes(liste, comptes, Object.keys(favorites).length, medias);
  const haut = favGrille.scrollTop;   // une étiquette ajoutée ou retirée ne fait pas remonter la grille
  favGrille.replaceChildren();

  if (Object.keys(favorites).length === 0) {
    favGrille.innerHTML = '<p class="grille-vide">Aucun favori pour le moment</p>';
    return;
  }
  const rang = new Map(liste.map((nom, i) => [nom, i]));
  const entrees = Object.entries(favorites)
    .filter(([, data]) => data && typeof data === 'object')
    .map(([favKey, data]) => [favKey, data, etiquettesDe(data).map(canonique).sort((a, b) => rang.get(a) - rang.get(b))]);
  const tri = lireTriFavoris();
  if (tri === 'media') {
    // Tri stable : à égalité de média, l'ordre d'ajout reste
    entrees.sort((a, b) => (mediaDe.get(a[1]) === SANS_MEDIA) - (mediaDe.get(b[1]) === SANS_MEDIA)
      || comparerNoms(mediaDe.get(a[1]), mediaDe.get(b[1])));
  } else if (tri === 'etiquettes') {
    // Comparaison des rangs des étiquettes, une à une ; sans étiquette : à la fin. Tri stable : à égalité,
    // l'ordre d'ajout reste.
    const rangs = (e) => e.length ? e.map(nom => rang.get(nom)) : [Infinity];
    entrees.sort((a, b) => {
      const ra = rangs(a[2]), rb = rangs(b[2]);
      for (let i = 0; i < Math.min(ra.length, rb.length); i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return ra.length - rb.length;
    });
  }
  entrees.forEach(([favKey, data, etiquettes]) => {
    if (sansEtiquette && etiquettes.length) return;
    if (!etiquettesChoisies.every(nom => etiquettes.includes(nom))) return;
    if (mediaChoisi && mediaDe.get(data) !== mediaChoisi) return;
    // Carte faite des données enregistrées, qui peuvent être incomplètes (anciens favoris) ou venir
    // d'un fichier importé : l'adresse n'est suivie que si c'est une page du site ou une adresse web.
    // La carte est un lien : les étiquettes (des boutons) ne peuvent pas être dedans. Elles sont posées
    // à côté, dans la même boîte, dans le coin en haut à droite de la carte, une par ligne (style_favoris.css).
    const boite = document.createElement('div');
    boite.className = 'carte-fav';
    boite.dataset.cle = favKey;
    boite.append(creerCarte({
      adresse: adresseSure(data.url || data.lien),
      image: adresseSure(data.image, ''),
      source: data.source || 'Article',
      meta: [data.date, data.host].filter(x => x).join(' · ') || 'Sans date',
      titre: data.title || data.titre || 'Sans titre',
      extrait: data.summary || '',
      favori: true
    }), zoneEtiquettes(etiquettes));
    // « + » : en bas au centre de la carte, hors de la colonne des étiquettes
    if (etiquettes.length < ETIQUETTES_PAR_FAVORI) {
      boite.appendChild(boutonEtiquette('etiquette-ajout', '+', 'Ajouter une étiquette à ce favori', 'saisir'));
    }
    favGrille.appendChild(boite);
  });
  if (!favGrille.children.length) {
    favGrille.innerHTML = '<p class="grille-vide">Aucun favori pour ces choix</p>';
  }
  favGrille.scrollTop = haut;
}

// Tuiles d'une carte, une par étiquette (clic : filtre ; × : la retirer de ce favori). Le « + » est à part,
// en bas au centre de la carte (afficherFavoris).
function zoneEtiquettes(etiquettes) {
  const zone = document.createElement('div');
  zone.className = 'etiquettes';
  const couleurs = lireCouleurs();
  etiquettes.forEach(nom => {
    const tuile = appliquerCouleur(document.createElement('span'), nom, couleurs);
    tuile.className = etiquettesChoisies.includes(nom) ? 'etiquette choisie' : 'etiquette';
    tuile.append(
      boutonEtiquette('etiquette-nom', nom, '', 'filtrer', nom),
      boutonEtiquette('etiquette-retirer', '×', `Retirer l'étiquette « ${nom} » de ce favori`, 'retirer', nom));
    zone.appendChild(tuile);
  });
  return zone;
}

function afficherBarreEtiquettes(liste, comptes, total, medias = new Map()) {
  const barre = document.getElementById('fav-etiquettes');
  const bandeau = document.getElementById('fav-bandeau');
  if (!barre || !bandeau) return;
  if (liste.length === 0 && modeEtiquettes) modeEtiquettes = '';
  const rangement = modeEtiquettes === 'rangement';
  barre.replaceChildren();
  barre.hidden = liste.length === 0;
  barre.classList.toggle('rangement', rangement);
  barre.classList.toggle('selection', modeEtiquettes === 'selection');
  barre.classList.toggle('modification', modeEtiquettes === 'modification');
  const couleurs = lireCouleurs();
  const tous = boutonEtiquette('etiquette-nom', `Tous (${total})`, '', 'filtrer', '');
  tous.setAttribute('aria-pressed', String(etiquettesChoisies.length === 0 && !sansEtiquette));
  barre.appendChild(tous);
  liste.forEach((nom, i) => {
    const tuile = appliquerCouleur(document.createElement('span'), nom, couleurs);
    tuile.className = 'etiquette';
    // Confirmation de suppression de cette étiquette, à la place de sa tuile
    if (aSupprimer && aSupprimer.length === 1 && aSupprimer[0] === nom && modeEtiquettes !== 'selection') {
      tuile.classList.add('confirmation');
      tuile.setAttribute('role', 'alert');
      const question = document.createElement('span');
      question.className = 'etiquette-texte';
      question.textContent = `Supprimer « ${nom} » de tous les favoris ?`;
      tuile.append(question,
        boutonEtiquette('etiquette-confirmer', 'Oui', `Oui, supprimer l'étiquette « ${nom} »`, 'confirmer-suppression', nom),
        boutonEtiquette('etiquette-annuler', 'Non', 'Non, garder l\'étiquette', 'annuler-suppression', nom));
      barre.appendChild(tuile);
      return;
    }
    if (rangement) {
      const avant = boutonEtiquette('etiquette-deplacer', '◀', `Déplacer « ${nom} » vers la gauche`, 'gauche', nom);
      avant.disabled = i === 0;
      tuile.appendChild(avant);
    }
    // Mode Modifier : un clic ouvre l'éditeur de cette étiquette (dans le bandeau) au lieu de la filtrer
    const modifiable = modeEtiquettes === 'modification';
    const b = boutonEtiquette('etiquette-nom', `${nom} (${comptes.get(nom) || 0})`, '', modifiable ? 'editer' : 'filtrer', nom);
    b.setAttribute('aria-pressed', String(modifiable ? !!edition && edition.nom === nom : etiquettesChoisies.includes(nom)));
    tuile.appendChild(b);
    if (rangement) {
      const apres = boutonEtiquette('etiquette-deplacer', '▶', `Déplacer « ${nom} » vers la droite`, 'droite', nom);
      apres.disabled = i === liste.length - 1;
      tuile.appendChild(apres);
    }
    // × : supprimer l'étiquette (après confirmation). Pas en mode Sélectionner : là, un clic choisit.
    if (modeEtiquettes !== 'selection' && !modifiable) {
      tuile.appendChild(boutonEtiquette('etiquette-retirer', '×', `Supprimer l'étiquette « ${nom} » de tous les favoris`, 'supprimer', nom));
    }
    barre.appendChild(tuile);
  });

  remplirSuggestions(liste);

  // Bandeau : les outils changent avec le mode
  bandeau.replaceChildren();
  const outil = (texte, action, libelle = '') => boutonEtiquette('etiquette-outil', texte, libelle, action);
  if (modeEtiquettes === 'selection' && aSupprimer) {
    const n = aSupprimer.length;
    const question = document.createElement('span');
    question.className = 'bandeau-texte';
    question.setAttribute('role', 'alert');
    question.textContent = `Supprimer ${n > 1 ? n + ' étiquettes' : '« ' + aSupprimer[0] + ' »'} de tous les favoris ? Les favoris restent.`;
    bandeau.append(question, outil('Oui, supprimer', 'confirmer-suppression'), outil('Non', 'annuler-suppression'));
  } else if (modeEtiquettes === 'selection') {
    const n = etiquettesChoisies.length;
    const compte = document.createElement('span');
    compte.className = 'bandeau-texte';
    compte.setAttribute('aria-live', 'polite');
    compte.textContent = n ? `${n} étiquette${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}` : 'Clique sur des étiquettes pour les sélectionner';
    const supprimer = outil('Supprimer', 'supprimer-selection', 'Supprimer les étiquettes sélectionnées de tous les favoris');
    supprimer.disabled = n === 0;
    const vider = outil('Tout désélectionner', 'filtrer');
    vider.dataset.etiquette = '';
    vider.disabled = n === 0;
    bandeau.append(compte, vider, supprimer, outil('Terminé', 'selectionner'));
  } else if (rangement) {
    bandeau.append(outil('A → Z', 'alphabetique', 'Trier les étiquettes par ordre alphabétique'), outil('Terminé', 'ranger'));
  } else if (modeEtiquettes === 'modification') {
    if (edition && liste.includes(edition.nom)) {
      bandeau.append(...editeurEtiquette(edition.nom));
    } else {
      const aide = document.createElement('span');
      aide.className = 'bandeau-texte';
      aide.setAttribute('aria-live', 'polite');
      aide.textContent = liste.length ? 'Clique sur une étiquette pour la modifier' : 'Aucune étiquette à modifier';
      bandeau.append(aide, outil('Terminé', 'modifier'));
    }
  } else {
    const selectionner = outil('Sélectionner', 'selectionner');
    const ranger = outil('Ranger', 'ranger');
    const modifier = outil('Modifier une étiquette', 'modifier', 'Modifier le nom, la couleur ou supprimer une étiquette');
    selectionner.disabled = ranger.disabled = modifier.disabled = liste.length === 0;
    const choix = document.createElement('span');
    choix.className = 'bandeau-choix';
    choix.append(choixTri(), choixMedia(medias), choixEtiquette(liste, comptes));
    // Sauvegarde : dans le bandeau aussi (même quand il n'y a encore aucune étiquette, pour pouvoir charger)
    const fichiers = document.createElement('span');
    fichiers.className = 'bandeau-fichiers';
    fichiers.append(outil('Télécharger mes favoris', 'exporter', 'Télécharger mes favoris (fichier JSON)'),
      outil('Charger des favoris', 'charger', 'Charger des favoris depuis un fichier'),
      outil('Effacer tous les favoris', 'effacer', 'Effacer tous les favoris'));
    bandeau.append(selectionner, outil('+ Créer une étiquette', 'creer'), modifier, fichiers, choix, ranger);
  }
  bandeau.querySelector('[data-action="ranger"], [data-action="selectionner"]:last-child')?.classList.add('outil-droite');
}

// Éditeur d'une étiquette, dans le bandeau : nouveau nom, couleur (palette ou couleur libre), Enregistrer,
// Supprimer (la confirmation se fait dans la barre, comme pour la suppression), Annuler.
const NOM_PALETTE = ['bleu', 'rose', 'violet', 'rouge', 'orange', 'vert', 'jaune', 'blanc'];
function editeurEtiquette(nom) {
  const ouvert = edition;
  const titre = document.createElement('span');
  titre.className = 'bandeau-texte';
  titre.textContent = `Modifier « ${nom} »`;
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.className = 'etiquette-saisie';
  champ.dataset.role = 'nom';
  champ.maxLength = ETIQUETTE_MAX;
  champ.value = ouvert.brouillon;
  champ.size = tailleChamp(champ.value);   // le champ prend la place du nom, sans vide à droite
  champ.setAttribute('aria-label', "Nouveau nom de l'étiquette");
  champ.autocomplete = 'off';
  const palette = document.createElement('span');
  palette.className = 'couleurs';
  palette.setAttribute('role', 'group');
  palette.setAttribute('aria-label', "Couleur de l'étiquette");
  const pastille = (couleur, libelle, classe = '') => {
    const b = boutonEtiquette('couleur-pastille' + (classe ? ' ' + classe : ''), '', libelle, 'choisir-couleur');
    b.dataset.couleur = couleur || '';
    b.setAttribute('aria-pressed', String((ouvert.couleur || '') === (couleur || '')));
    if (couleur) b.style.setProperty('--pastille', couleur);
    return b;
  };
  palette.appendChild(pastille('', 'Couleur du thème', 'couleur-defaut'));
  PALETTE_ETIQUETTES.forEach((c, i) => palette.appendChild(pastille(c, `Couleur ${NOM_PALETTE[i]}`)));
  const libre = document.createElement('input');
  libre.type = 'color';
  libre.className = 'couleur-libre';
  libre.dataset.role = 'couleur-libre';
  libre.value = ouvert.couleur || PALETTE_ETIQUETTES[0];
  libre.setAttribute('aria-label', 'Autre couleur');
  palette.appendChild(libre);
  const enregistrer = boutonEtiquette('etiquette-confirmer', 'Enregistrer', '', 'enregistrer-edition');
  const supprimer = boutonEtiquette('etiquette-retirer-texte', 'Supprimer', `Supprimer l'étiquette « ${nom} » de tous les favoris`, 'supprimer', nom);
  const annuler = boutonEtiquette('etiquette-annuler', 'Annuler', '', 'fermer-edition');
  const elements = [titre, champ, palette, enregistrer, supprimer, annuler];
  if (ouvert.erreur) {
    const erreur = document.createElement('span');
    erreur.className = 'bandeau-texte erreur';
    erreur.setAttribute('role', 'alert');
    erreur.textContent = ouvert.erreur;
    elements.push(erreur);
  }
  return elements;
}

// Largeur d'un champ d'après son texte (en caractères), au moins six
const tailleChamp = (texte) => Math.max(6, texte.length + 2);

// Ce que l'utilisateur a tapé dans le champ de l'éditeur est gardé avant tout nouvel affichage
function synchroniserEdition() {
  if (!edition) return;
  const champ = document.querySelector('#fav-bandeau [data-role="nom"]');
  if (champ) edition.brouillon = champ.value;
}

// Sélecteur du bandeau : <label> (texte + <select>). Au changement : change(valeur), réaffichage du panneau,
// puis le focus revient sur le même sélecteur (clavier : on peut continuer).
function menuBandeau(id, texte, options, valeur, change) {
  const etiquette = document.createElement('label');
  etiquette.className = 'bandeau-tri';
  etiquette.append(texte + ' : ');
  const menu = document.createElement('select');
  menu.id = id;
  options.forEach(([v, t, desactivee]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    if (desactivee) o.disabled = true;
    menu.appendChild(o);
  });
  menu.value = valeur;
  menu.addEventListener('change', () => {
    change(menu.value);
    afficherFavoris(getFavorites());
    document.getElementById(id)?.focus();
  });
  etiquette.appendChild(menu);
  return etiquette;
}

function choixTri() {
  return menuBandeau('fav-tri', 'Trier', TRIS_FAVORIS, lireTriFavoris(), (v) => {
    try { localStorage.setItem(CLE_TRI_FAVORIS, v); } catch (e) {}
  });
}

function choixMedia(medias) {
  const noms = [...medias.keys()].sort((a, b) => (a === SANS_MEDIA) - (b === SANS_MEDIA) || comparerNoms(a, b));
  const menu = menuBandeau('fav-media', 'Média', [['', 'Tous les médias'], ...noms.map(nom => [nom, `${nom} (${medias.get(nom)})`])],
    mediaChoisi, (v) => { mediaChoisi = v; });
  menu.querySelector('select').disabled = noms.length === 0;
  return menu;
}

// Plusieurs étiquettes choisies (mode Sélectionner) : le menu l'indique ; en choisir une remplace la sélection
function choixEtiquette(liste, comptes) {
  const n = etiquettesChoisies.length;
  const options = [['', 'Toutes les étiquettes'], ['sans', 'Sans étiquette'], ...liste.map(nom => [nom, `${nom} (${comptes.get(nom) || 0})`])];
  if (n > 1) options.push(['*', `${n} étiquettes sélectionnées`, true]);
  const valeur = sansEtiquette ? 'sans' : n > 1 ? '*' : (etiquettesChoisies[0] || '');
  const menu = menuBandeau('fav-etiquette', 'Étiquette', options, valeur, (v) => {
    sansEtiquette = v === 'sans';
    etiquettesChoisies = v && v !== 'sans' ? [v] : [];
  });
  menu.querySelector('select').disabled = liste.length === 0;
  return menu;
}

// Réaffiche le panneau, puis remet le focus sur le bouton équivalent (clavier : on peut continuer)
function rafraichirFavoris(focus) {
  afficherFavoris(getFavorites());
  if (!focus) return;
  const panneau = document.getElementById('favoris');
  const cible = [...panneau.querySelectorAll('button[data-action]')].find(b =>
    b.dataset.action === focus.action && (focus.etiquette === undefined || b.dataset.etiquette === focus.etiquette)
    && (focus.cle === undefined || b.closest('.carte-fav')?.dataset.cle === focus.cle)) || null;
  (cible && !cible.disabled ? cible : panneau.querySelector('#fav-bandeau button:not(:disabled)'))?.focus();
}

function deplacerEtiquette(nom, sens) {
  const liste = etiquettesRangees().liste;
  const i = liste.indexOf(nom), j = i + sens;
  if (i < 0 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  ecrireOrdreEtiquettes(liste);
}

// Clic sur une étiquette (barre ou carte) : en mode Sélectionner, l'ajoute à la sélection ou l'en retire ;
// sinon, n'affiche que ses favoris (un second clic revient à tous). '' : tous les favoris.
function choisirEtiquette(nom) {
  sansEtiquette = false;
  if (!nom) etiquettesChoisies = [];
  else if (modeEtiquettes === 'selection') {
    etiquettesChoisies = etiquettesChoisies.includes(nom)
      ? etiquettesChoisies.filter(e => e !== nom) : etiquettesChoisies.concat(nom);
  } else etiquettesChoisies = (etiquettesChoisies.length === 1 && etiquettesChoisies[0] === nom) ? [] : [nom];
}

// Favoris modifiés ailleurs pendant que le panneau est ouvert (carte d'article ouverte par-dessus : 🏷, ♡) :
// le panneau se met à jour tout de suite, sans devoir le fermer et le rouvrir. saveFavorites (favoris.js)
// envoie l'évènement à chaque écriture. Pas pendant une saisie dans le panneau : elle serait effacée.
document.addEventListener('kioske-favoris', () => {
  if (!favorisVisibles() || document.querySelector('#favoris .etiquette-saisie')) return;
  afficherFavoris(getFavorites());
});

// Dans l'éditeur : Entrée enregistre, Échap annule (sans fermer le panneau). La couleur libre se prend au changement.
document.getElementById('fav-bandeau')?.addEventListener('keydown', e => {
  if (!edition || !e.target.matches('[data-role="nom"]')) return;
  if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#fav-bandeau [data-action="enregistrer-edition"]')?.click(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); document.querySelector('#fav-bandeau [data-action="fermer-edition"]')?.click(); }
});
document.getElementById('fav-bandeau')?.addEventListener('input', e => {
  if (edition && e.target.matches('[data-role="nom"]')) e.target.size = tailleChamp(e.target.value);
});
document.getElementById('fav-bandeau')?.addEventListener('change', e => {
  if (!edition || !e.target.matches('[data-role="couleur-libre"]')) return;
  synchroniserEdition();
  edition.couleur = e.target.value.toLowerCase();
  edition.erreur = '';
  rafraichirFavoris({ action: 'choisir-couleur' });
});

// Échap pendant une confirmation de suppression : annule (sans fermer le panneau)
document.getElementById('favoris')?.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !aSupprimer) return;
  e.stopPropagation();
  const nom = aSupprimer.length === 1 && modeEtiquettes !== 'selection' ? aSupprimer[0] : undefined;
  aSupprimer = null;
  rafraichirFavoris(nom !== undefined ? { action: 'supprimer', etiquette: nom } : { action: 'supprimer-selection' });
});

// Un seul écouteur pour la barre, le bandeau et les tuiles des cartes (recréés à chaque affichage)
document.getElementById('favoris')?.addEventListener('click', e => {
  const bouton = e.target.closest('button[data-action]');
  if (!bouton || !bouton.closest('#fav-etiquettes, #fav-bandeau, .carte-fav')) return;
  const nom = bouton.dataset.etiquette;
  const cle = bouton.closest('.carte-fav')?.dataset.cle;
  const action = bouton.dataset.action;
  // Toute autre action abandonne une suppression en attente de confirmation
  if (action !== 'confirmer-suppression') aSupprimer = null;
  switch (action) {
    case 'filtrer':
      choisirEtiquette(nom);
      rafraichirFavoris(cle === undefined ? { action, etiquette: nom } : null);
      document.getElementById('fav-grille').scrollTop = 0;
      break;
    case 'retirer':
      retirerEtiquette(cle, nom);
      rafraichirFavoris({ action: 'saisir', cle });
      break;
    case 'saisir':
      saisirEtiquette(bouton, {
        libelle: 'Nouvelle étiquette pour ce favori',
        ancre: bouton.closest('.carte-fav'),
        exclure: etiquettesDe(getFavorites()[cle]),
        valider: (texte) => { ajouterEtiquettes(cle, texte); rafraichirFavoris({ action: 'saisir', cle }); },
        annuler: () => rafraichirFavoris({ action: 'saisir', cle }),
      });
      break;
    case 'exporter':
      exportFavorites();
      break;
    case 'charger':
      document.getElementById('fav-file-input')?.click();
      break;
    case 'effacer':
      clearFavorites();
      break;
    case 'modifier':
      modeEtiquettes = modeEtiquettes === 'modification' ? '' : 'modification';
      edition = null;
      rafraichirFavoris({ action });
      break;
    case 'editer':
      synchroniserEdition();
      edition = { nom, brouillon: nom, couleur: couleurDe(nom), erreur: '' };
      rafraichirFavoris({ action: 'modifier' });
      document.querySelector('#fav-bandeau [data-role="nom"]')?.select();
      break;
    case 'choisir-couleur':
      synchroniserEdition();
      edition.couleur = bouton.dataset.couleur || null;
      edition.erreur = '';
      rafraichirFavoris({ action: 'choisir-couleur' });
      document.querySelector(`#fav-bandeau .couleur-pastille[data-couleur="${edition.couleur || ''}"]`)?.focus();
      break;
    case 'enregistrer-edition': {
      if (!edition) break;
      const ancien = edition.nom;
      const nouveau = document.querySelector('#fav-bandeau [data-role="nom"]')?.value ?? edition.brouillon;
      const erreur = modifierEtiquette(ancien, nouveau, edition.couleur);
      if (erreur) {
        edition.brouillon = nouveau;
        edition.erreur = erreur;
        rafraichirFavoris({ action: 'choisir-couleur' });
        document.querySelector('#fav-bandeau [data-role="nom"]')?.focus();
        break;
      }
      const propre = nettoyerEtiquette(nouveau);
      etiquettesChoisies = etiquettesChoisies.map(e => memeNom(e, ancien) ? propre : e);
      edition = null;
      rafraichirFavoris({ action: 'modifier' });
      document.querySelector(`#fav-etiquettes [data-etiquette="${propre}"]`)?.focus();
      break;
    }
    case 'fermer-edition':
      edition = null;
      rafraichirFavoris({ action: 'modifier' });
      break;
    case 'creer':
      saisirEtiquette(bouton, {
        libelle: 'Nom de la nouvelle étiquette',
        valider: (texte) => { creerEtiquettes(nomsSaisis(texte)); rafraichirFavoris({ action: 'creer' }); },
        annuler: () => rafraichirFavoris({ action: 'creer' }),
      });
      break;
    case 'gauche':
    case 'droite':
      deplacerEtiquette(nom, action === 'gauche' ? -1 : 1);
      rafraichirFavoris({ action, etiquette: nom });
      break;
    case 'supprimer':
      edition = null;
      aSupprimer = [nom];
      rafraichirFavoris({ action: 'annuler-suppression' });   // focus sur « Non » : rien ne se perd par erreur
      break;
    case 'supprimer-selection':
      aSupprimer = etiquettesChoisies.slice();
      rafraichirFavoris({ action: 'annuler-suppression' });
      break;
    case 'confirmer-suppression': {
      const noms = aSupprimer || [];
      aSupprimer = null;
      supprimerEtiquettes(noms);
      etiquettesChoisies = etiquettesChoisies.filter(e => !noms.includes(e));
      if (edition && noms.some(n => memeNom(n, edition.nom))) edition = null;
      rafraichirFavoris({ action: modeEtiquettes === 'selection' ? 'selectionner' : modeEtiquettes === 'modification' ? 'modifier' : 'creer' });
      break;
    }
    case 'annuler-suppression':
      rafraichirFavoris(nom !== undefined ? { action: 'supprimer', etiquette: nom } : { action: 'supprimer-selection' });
      break;
    case 'alphabetique':
      ecrireOrdreEtiquettes(etiquettesRangees().liste.sort(comparerNoms));
      rafraichirFavoris({ action });
      break;
    case 'selectionner':
    case 'ranger': {
      const mode = action === 'selectionner' ? 'selection' : 'rangement';
      modeEtiquettes = modeEtiquettes === mode ? '' : mode;
      edition = null;
      rafraichirFavoris({ action });
      break;
    }
  }
});

// Anciens favoris : seul le lien du site d'origine était enregistré. L'index des articles
// donne la page du KiosKe correspondante (et l'image, la date, le résumé).
function completerFavoris() {
  const favorites = getFavorites();
  const incomplets = Object.entries(favorites)
    .filter(([cle, data]) => !String(data.url || '').startsWith('/articles/'));
  if (incomplets.length === 0) return;
  fetch('/articles-index.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(articles => {
      const parLien = new Map(articles.map(a => [a.link, a]));
      let change = false;
      incomplets.forEach(([cle, data]) => {
        const a = parLien.get(data.lien) || parLien.get(cle);
        if (!a) return;
        favorites[cle] = Object.assign({}, data, {
          title: a.title, titre: a.title, lien: a.link, url: a.url, image: a.image,
          summary: a.summary, date: a.date, host: a.host, source: a.source
        });
        change = true;
      });
      if (!change) return;
      saveFavorites(favorites);
      if (favorisVisibles()) afficherFavoris(favorites);
    })
    .catch(err => console.error('Favoris non complétés :', err));
}

// Fichier de sauvegarde (version 2) : { kioske: "favoris", version: 2, favoris: {…}, etiquettes: [...] }.
// favoris : les favoris, chacun avec ses étiquettes ; etiquettes : toutes les étiquettes dans l'ordre choisi,
// y compris celles créées sans favori. Un ancien fichier (les favoris seuls, à plat) se charge toujours.
const VERSION_SAUVEGARDE = 2;

function exportFavorites() {
  const favorites = getFavorites();
  const etiquettes = etiquettesRangees(favorites).liste;
  if (Object.keys(favorites).length === 0 && etiquettes.length === 0) {
    alert('Aucun favori à exporter');
    return;
  }
  const sauvegarde = { kioske: 'favoris', version: VERSION_SAUVEGARDE, favoris: favorites, etiquettes, couleurs: lireCouleurs() };
  const data = JSON.stringify(sauvegarde, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kioske-favoris.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Contenu d'un fichier de sauvegarde, quel que soit son format : { favoris, etiquettes }
function lireSauvegarde(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('format');
  if (data.kioske === 'favoris' && data.favoris && typeof data.favoris === 'object') {
    const couleurs = data.couleurs && typeof data.couleurs === 'object' && !Array.isArray(data.couleurs) ? data.couleurs : {};
    return { favoris: data.favoris, etiquettes: Array.isArray(data.etiquettes) ? data.etiquettes : [], couleurs };
  }
  return { favoris: data, etiquettes: [], couleurs: {} };   // ancien format : les favoris seuls
}

// Charge les favoris d'un fichier sans rien perdre : un favori déjà présent garde ses étiquettes, réunies
// avec celles du fichier ; les étiquettes du fichier qui manquent sont ajoutées à la fin de la liste, dans
// l'ordre du fichier (l'ordre déjà choisi ici reste).
function chargerSauvegarde(data) {
  const { favoris, etiquettes, couleurs } = lireSauvegarde(data);
  const favorites = getFavorites();
  Object.entries(favoris).forEach(([cle, importe]) => {
    const local = favorites[cle];
    if (!local || typeof local !== 'object' || !importe || typeof importe !== 'object') return;
    const union = etiquettesDe({ etiquettes: etiquettesDe(local).concat(etiquettesDe(importe)) });
    if (union.length) importe.etiquettes = union;
  });
  Object.assign(favorites, favoris);
  // Les noms passent par les mêmes règles que la saisie (nettoyés, sans doublon, écriture existante gardée)
  creerEtiquettes(nomsSaisis(etiquettes.filter(e => typeof e === 'string').map(e => e.replace(/,/g, ' ')).join(',')));
  // Couleurs du fichier : seulement pour les étiquettes qui n'en ont pas encore ici (une couleur locale est gardée)
  const locales = lireCouleurs();
  Object.entries(couleurs).forEach(([nom, c]) => {
    const propre = nettoyerEtiquette(nom);
    if (propre && typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && !couleurDe(propre, locales)) locales[propre] = c.toLowerCase();
  });
  ecrireCouleurs(locales);
  saveFavorites(favorites);
}

function importFavorites() {
  const input = document.getElementById('fav-file-input');
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      chargerSauvegarde(JSON.parse(e.target.result));
      openFavoritesPanel();
      alert('Favoris importés avec succès !');
    } catch (err) {
      alert('Erreur lors de l\'import : format JSON invalide');
    }
    input.value = '';   // le même fichier pourra être rechargé
  };
  reader.readAsText(file);
}

function clearFavorites() {
  if (confirm('Êtes-vous sûr de vouloir effacer tous vos favoris ?')) {
    try {
      localStorage.removeItem('kioske_favoris');
      localStorage.removeItem(CLE_ORDRE_ETIQUETTES);
      localStorage.removeItem(CLE_COULEURS_ETIQUETTES);
    } catch (e) {}
    etiquettesChoisies = [];
    sansEtiquette = false;
    updateHearts();
    openFavoritesPanel();
  }
}

// Boutons
document.getElementById('fav-file-input')?.addEventListener('change', importFavorites);
// Le ♡ de la barre est un lien vers la page « Mes favoris ». Les boutons Télécharger / Charger / Effacer sont
// dans le bandeau (clics traités dans le gestionnaire du panneau, case 'exporter', 'charger', 'effacer').
