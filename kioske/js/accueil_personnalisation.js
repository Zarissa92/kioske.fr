// Personnalisation de l'accueil : masquer des panneaux ou des catégories (leurs articles sortent des galeries,
// qui se remplissent avec le reste).
// Réglages choisis dans Paramètres, mémorisés dans le navigateur. Appliqués à chaque chargement de l'accueil.

const CLE_MASQUES_ACCUEIL = 'kioske_accueil_masques';   // { panneaux: [noms], categories: [noms] }

function lireJsonLocal(cle, defaut) {
  try {
    const valeur = localStorage.getItem(cle);
    return valeur ? JSON.parse(valeur) : defaut;
  } catch (e) {
    return defaut;
  }
}

// Lecture brute du stockage : null si la clé manque ou si le stockage est bloqué (cookies refusés, mode privé).
function lireTexteLocal(cle) {
  try {
    return localStorage.getItem(cle);
  } catch (e) {
    return null;
  }
}

// Clé d'une source (window.sourcesMetadata) à partir de son nom affiché (attribut data-source des cartes).
// Table construite une fois, partagée avec flux_personnalise.js (même bundle).
let tableNomsSources = null;
function cleDeNomSource(nom) {
  if (!nom) return null;
  if (!tableNomsSources) {
    tableNomsSources = new Map();
    const meta = window.sourcesMetadata || {};
    Object.keys(meta).forEach(cle => {
      if (meta[cle] && !tableNomsSources.has(meta[cle].name)) tableNomsSources.set(meta[cle].name, cle);
    });
  }
  return tableNomsSources.get(nom) || null;
}

function masquesAccueil() {
  const m = lireJsonLocal(CLE_MASQUES_ACCUEIL, {});
  return { panneaux: Array.isArray(m.panneaux) ? m.panneaux : [], categories: Array.isArray(m.categories) ? m.categories : [] };
}

// Pour chaque catégorie de l'accueil : sa section et le nom de son panneau (vide si aucun).
function sectionsDeCategories() {
  const sections = new Map();
  // Le titre de catégorie est dans sa boîte : section.groupe (hors panneau) ou div.sous-categorie (dans un panneau)
  document.querySelectorAll('.titre-categorie[data-category-name]').forEach(titre => {
    const nom = titre.dataset.categoryName;
    if (sections.has(nom)) return;   // premier titre du nom : le titre visuel masqué d'une galerie vient après
    const section = titre.parentElement;
    const parentPanneau = section.parentElement ? section.parentElement.closest('section.groupe.panneau') : null;
    const titrePanneau = parentPanneau ? parentPanneau.querySelector('.titre-du-panneau[data-category-name]') : null;
    sections.set(nom, { section, panneau: titrePanneau ? titrePanneau.dataset.categoryName : '' });
  });
  return sections;
}

// Un bloc masqué garde son titre (classe accueil-masque, grisé) et perd le reste de son contenu.
// Ne touche qu'aux éléments qu'elle a cachés elle-même (marque data-masque-accueil) : une galerie de catégorie
// cachée par son propre réglage (Paramètres) garde son état.
function reduireBloc(bloc, titre, cacher) {
  if (titre) titre.classList.toggle('accueil-masque', cacher);
  Array.from(bloc.children).forEach(enfant => {
    if (enfant === titre || enfant.classList.contains('accueil-outils')) return;
    if (cacher) {
      enfant.hidden = true;
      enfant.dataset.masqueAccueil = '1';
    } else if (enfant.dataset.masqueAccueil === '1') {
      delete enfant.dataset.masqueAccueil;
      // Une galerie de catégorie revient selon son réglage ; le reste revient affiché
      enfant.hidden = enfant.dataset.categorie ? lireTexteLocal('kioske-galerie-cat-' + enfant.dataset.categorie) !== '1' : false;
    }
  });
}

// Appliqué à l'accueil : blocs masqués, galeries filtrées.
// visible(carte) : filtre éventuel du flux personnalisé (les cartes qu'il cache restent cachées).
function appliquerMasquesAccueil(visible = () => true) {
  if (document.body.dataset.page !== 'accueil') return;
  const masques = masquesAccueil();
  const categories = sectionsDeCategories();

  const categorieMasquee = nom => {
    if (masques.categories.includes(nom)) return true;
    const info = categories.get(nom);
    return !!info && !!info.panneau && masques.panneaux.includes(info.panneau);
  };

  // Panneaux masqués : leur titre reste (grisé, avec 👁 fermé pour le réactiver) ; leur contenu est caché
  document.querySelectorAll('section.groupe.panneau').forEach(panneau => {
    const titre = panneau.querySelector('.titre-du-panneau[data-category-name]');
    reduireBloc(panneau, titre, !!titre && masques.panneaux.includes(titre.dataset.categoryName));
  });
  // Catégories masquées : même principe
  categories.forEach((info, nom) => {
    const titre = Array.from(info.section.children).find(e => e.classList.contains('titre-categorie'));
    reduireBloc(info.section, titre, categorieMasquee(nom));
  });

  // Cartes : celles d'une catégorie masquée sortent des galeries
  const carteMasquee = carte => {
    const cle = cleDeNomSource(carte.getAttribute('data-source'));
    return !!cle && categorieMasquee(window.sourcesMetadata[cle].category);
  };

  // La grande galerie est recomplétée depuis ses cartes candidates (voir filtrerGaleriePrincipale)
  filtrerGaleriePrincipale(carte => visible(carte) && !carteMasquee(carte));
  document.querySelectorAll('.galerie-carte-wrapper, .galerie-carte[data-source]').forEach(carte => {
    if (carte.closest('.galerie-principale')) return;
    if (carteMasquee(carte)) carte.style.display = 'none';
  });
  majBoutonsAccueil();
}

// ---------- Boutons sur les titres de l'accueil : 👁 masquer ----------

// Œil ouvert (contenu affiché) et œil fermé (contenu masqué) : SVG, couleur du texte
const ICONE_OEIL_OUVERT = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const ICONE_OEIL_FERME = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2.4"/></svg>';

function basculerListe(liste, valeur) {
  return liste.includes(valeur) ? liste.filter(x => x !== valeur) : [...liste, valeur];
}

function ecrireLocal(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) {}
}

// Ajoute 👁 à chaque titre de panneau et de catégorie, et le bandeau de réaffichage.
function ajouterBoutonsAccueil() {
  // L'épinglage est retiré : on efface ce qui pouvait rester en mémoire
  try { localStorage.removeItem('kioske_accueil_epingles'); } catch (e) {}
  if (document.body.dataset.page !== 'accueil' || document.querySelector('.accueil-outil')) return;

  const bouton = (nom, type, action, libelle) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'accueil-outil';
    b.dataset.nom = nom;
    b.dataset.type = type;
    b.dataset.action = action;
    b.innerHTML = ICONE_OEIL_OUVERT;
    return b;
  };
  const ajouter = (titre, nom, type) => {
    if (!titre || titre.style.display === 'none') return;   // titre visuel masqué d'une galerie : rien à régler
    // Les boutons sont regroupés et placés à droite du titre (CSS : .accueil-outils)
    const groupe = document.createElement('span');
    groupe.className = 'accueil-outils';
    groupe.appendChild(bouton(nom, type, 'masquer', ''));
    titre.appendChild(groupe);
  };

  document.querySelectorAll('section.groupe.panneau > .titre-du-panneau[data-category-name]').forEach(titre =>
    ajouter(titre, titre.dataset.categoryName, 'panneau'));
  document.querySelectorAll('.titre-categorie[data-category-name]').forEach(titre => {
    if (titre.closest('.accueil-outil')) return;
    ajouter(titre, titre.dataset.categoryName, 'categorie');
  });

  const groupes = document.querySelector('.groupes');
  if (groupes && !document.getElementById('accueil-bandeau-masques')) {
    const bandeau = document.createElement('p');
    bandeau.id = 'accueil-bandeau-masques';
    bandeau.className = 'accueil-bandeau';
    bandeau.hidden = true;
    const reafficher = document.createElement('button');
    reafficher.type = 'button';
    reafficher.className = 'accueil-bandeau-bouton';
    reafficher.textContent = '↺ Réafficher les catégories et panneaux masqués';
    reafficher.addEventListener('click', () => {
      ecrireLocal(CLE_MASQUES_ACCUEIL, { panneaux: [], categories: [] });
      appliquerFiltreAccueil();
    });
    bandeau.appendChild(reafficher);
    // En bas de page, après la liste des catégories
    groupes.parentNode.insertBefore(bandeau, groupes.nextSibling);
  }

  // Un seul écouteur, en phase de capture : le clic ne parvient pas au titre (qui ouvre son panneau)
  document.addEventListener('click', e => {
    const b = e.target.closest ? e.target.closest('.accueil-outil') : null;
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    const nom = b.dataset.nom;
    const masques = masquesAccueil();
    if (b.dataset.type === 'panneau') {
      ecrireLocal(CLE_MASQUES_ACCUEIL, { panneaux: basculerListe(masques.panneaux, nom), categories: masques.categories });
    } else {
      ecrireLocal(CLE_MASQUES_ACCUEIL, { panneaux: masques.panneaux, categories: basculerListe(masques.categories, nom) });
    }
    appliquerFiltreAccueil();
  }, true);
}

// Met à jour l'état des boutons (aria-pressed) et le bandeau, d'après les choix mémorisés.
function majBoutonsAccueil() {
  const masques = masquesAccueil();
  document.querySelectorAll('.accueil-outil').forEach(b => {
    const nom = b.dataset.nom;
    const actif = b.dataset.type === 'panneau' ? masques.panneaux.includes(nom) : masques.categories.includes(nom);
    const libelle = actif ? 'Réafficher ' : 'Masquer ';
    b.innerHTML = actif ? ICONE_OEIL_FERME : ICONE_OEIL_OUVERT;
    b.setAttribute('aria-pressed', String(actif));
    b.setAttribute('aria-label', libelle + nom);
    b.title = libelle + nom;
  });
  const bandeau = document.getElementById('accueil-bandeau-masques');
  if (bandeau) bandeau.hidden = masques.panneaux.length + masques.categories.length === 0;
}
