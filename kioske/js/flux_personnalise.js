// Gestion du flux personnalisé : sélection des sources à afficher

const CUSTOM_FLUX_KEY = 'kioske_flux_personnalise';

function getCustomFluxSources() {
  const saved = localStorage.getItem(CUSTOM_FLUX_KEY);
  return saved ? JSON.parse(saved) : {};
}

// Sources présentes au moment où le choix a été enregistré. Une source absente de cette liste est nouvelle :
// elle reste visible, au lieu d'être masquée comme une source décochée. Null si rien n'a été enregistré.
const SOURCES_CONNUES_KEY = 'kioske_flux_connus';

function getSourcesConnues() {
  const saved = localStorage.getItem(SOURCES_CONNUES_KEY);
  return saved ? JSON.parse(saved) : null;
}

// Visible si la source est cochée, ou si elle est nouvelle (absente du choix enregistré).
function sourceVisible(customSources, sourceKey, connues) {
  return !!customSources[sourceKey] || (connues !== null && !connues.includes(sourceKey));
}

// Sources « nouvelles » dont le bandeau a été fermé par l'utilisateur (« Gérer » ou « OK »). Tant que le bandeau
// n'a pas été fermé, il revient à chaque visite : une personne qui quitte la page avant de le lire est prévenue
// au retour. Séparé de SOURCES_CONNUES_KEY : une source annoncée reste visible tant qu'elle n'est pas dans le choix.
const SOURCES_ANNONCEES_KEY = 'kioske_flux_annonces';
// Sources pour lesquelles la notification système a déjà été envoyée (une seule fois par source).
const SOURCES_NOTIFIEES_KEY = 'kioske_flux_notifiees';

// Listes en localStorage : lireTableau() et ecrireTableau() de notifications.js (même bundle).

function getSourcesAnnoncees() {
  return lireTableau(SOURCES_ANNONCEES_KEY);
}

// Sources présentes sur le site, absentes du choix enregistré et pas encore signalées : { cle, nom }.
function nouvellesSources() {
  const connues = getSourcesConnues();
  if (connues === null || !isFluxPersonnalise()) return [];
  const dejaVues = new Set([...connues, ...getSourcesAnnoncees()]);
  const nouvelles = new Map();
  document.querySelectorAll('.nuage .tag').forEach(tag => {
    const cle = tag.getAttribute('data-source-key');
    if (!dejaVues.has(cle) && !nouvelles.has(cle)) {
      nouvelles.set(cle, { cle, nom: tag.getAttribute('data-source-name') || cle });
    }
  });
  return [...nouvelles.values()];
}

// Bandeau « nouveau flux ajouté » ; le bouton ouvre le panneau de personnalisation.
function afficherBandeauNouvellesSources(nouvelles) {
  if (document.getElementById('flux-nouveau')) return;
  const noms = nouvelles.map(n => n.nom);
  // Fermer le bandeau (« Gérer » ou « OK ») vaut lecture : ces sources ne seront plus annoncées.
  const fermer = () => { ecrireTableau(SOURCES_ANNONCEES_KEY, [...new Set([...getSourcesAnnoncees(), ...nouvelles.map(n => n.cle)])]); };
  const bandeau = document.createElement('div');
  bandeau.id = 'flux-nouveau';
  bandeau.className = 'flux-nouveau';
  bandeau.setAttribute('role', 'status');

  const texte = document.createElement('p');
  const pluriel = noms.length > 1;
  texte.textContent = (pluriel ? 'Nouveaux flux ajoutés : ' : 'Nouveau flux ajouté : ') + noms.join(', ')
    + (pluriel ? '. Ils sont activés' : '. Il est activé') + ' dans ton flux personnalisé.';

  const actions = document.createElement('div');
  actions.className = 'flux-nouveau-actions';

  const gerer = document.createElement('button');
  gerer.type = 'button';
  gerer.className = 'panneau-bouton';
  gerer.textContent = '⚙️ Gérer mon flux';
  gerer.addEventListener('click', () => {
    fermer();
    bandeau.remove();
    ouvrirPersonnalisation();
  });

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'panneau-bouton';
  ok.textContent = 'OK';
  ok.addEventListener('click', () => { fermer(); bandeau.remove(); });

  actions.append(gerer, ok);
  bandeau.append(texte, actions);
  document.body.appendChild(bandeau);
}

// À chaque ouverture de l'accueil : bandeau pour les sources nouvelles pas encore fermées, point rouge sur la
// cloche, et notification système seulement pour les sources qui n'en ont pas encore eu une.
// Une nouvelle source est activée par défaut dans le flux personnalisé, une seule fois : si l'utilisateur la
// décoche ensuite, elle reste décochée (`kioske_flux_activees_auto` garde la trace).
const SOURCES_ACTIVEES_AUTO_KEY = 'kioske_flux_activees_auto';

function activerNouvellesSourcesParDefaut(nouvelles) {
  const dejaActivees = lireTableau(SOURCES_ACTIVEES_AUTO_KEY);
  const aActiver = nouvelles.filter(n => !dejaActivees.includes(n.cle));
  if (aActiver.length === 0) return;
  const choix = getCustomFluxSources();
  aActiver.forEach(n => { choix[n.cle] = true; });
  try { localStorage.setItem(CUSTOM_FLUX_KEY, JSON.stringify(choix)); } catch (e) {}
  ecrireTableau(SOURCES_ACTIVEES_AUTO_KEY, [...new Set([...dejaActivees, ...aActiver.map(n => n.cle)])]);
  appliquerFiltreAccueil();
}

function annoncerNouvellesSources() {
  const nouvelles = nouvellesSources();
  if (nouvelles.length === 0) return;
  activerNouvellesSourcesParDefaut(nouvelles);
  afficherBandeauNouvellesSources(nouvelles);
  if (typeof ajouterNotif === 'function') {   // liste de la cloche (notifications.js)
    nouvelles.forEach(n => ajouterNotif('flux:' + n.cle, 'flux', 'Nouveau flux ajouté', n.nom));
  }
  const dejaNotifiees = lireTableau(SOURCES_NOTIFIEES_KEY);
  const aNotifier = nouvelles.filter(n => !dejaNotifiees.includes(n.cle));
  if (aNotifier.length && typeof notifierNouvellesSources === 'function') {
    notifierNouvellesSources(aNotifier.map(n => n.nom));   // notifications.js
    ecrireTableau(SOURCES_NOTIFIEES_KEY, [...new Set([...dejaNotifiees, ...aNotifier.map(n => n.cle)])]);
  }
}

function saveCustomFluxSources(sources) {
  localStorage.setItem(CUSTOM_FLUX_KEY, JSON.stringify(sources));
  const connues = [...new Set([...document.querySelectorAll('.nuage .tag')].map(t => t.getAttribute('data-source-key')))];
  localStorage.setItem(SOURCES_CONNUES_KEY, JSON.stringify(connues));
  appliquerFiltreAccueil();
  if (typeof majCloche === 'function') majCloche();   // cloche des notifications (notifications.js)
}

function isFluxPersonnalise() {
  return Object.keys(getCustomFluxSources()).length > 0;
}

// Filtre l'accueil pour n'afficher que les sources sélectionnées
function appliquerFiltreAccueil() {
  const customSources = getCustomFluxSources();
  const hasCustomFlux = Object.keys(customSources).length > 0;

  if (!hasCustomFlux) {
    // Réinitialiser : afficher tout
    document.querySelectorAll('.nuage .tag').forEach(tag => {
      tag.style.display = '';
    });
    document.querySelectorAll('.groupe').forEach(groupe => {
      groupe.style.display = '';
    });
    document.querySelectorAll('.galerie-carte').forEach(carte => {
      carte.style.display = '';
    });
    return;
  }

  // Masquer/afficher les tags des sources (les sources nouvelles restent visibles)
  const connues = getSourcesConnues();
  document.querySelectorAll('.nuage .tag').forEach(tag => {
    const sourceKey = tag.getAttribute('data-source-key');
    tag.style.display = sourceVisible(customSources, sourceKey, connues) ? '' : 'none';
  });

  // Pour chaque groupe (catégorie), vérifier si au moins une source est visible
  document.querySelectorAll('.groupe').forEach(groupe => {
    const tags = groupe.querySelectorAll('.tag');
    const hasVisibleTag = Array.from(tags).some(tag => {
      const sourceKey = tag.getAttribute('data-source-key');
      return sourceVisible(customSources, sourceKey, connues);
    });
    groupe.style.display = hasVisibleTag ? '' : 'none';
  });

  // Filtrer les cartes de galerie par source
  document.querySelectorAll('.galerie-carte-wrapper, .galerie-carte[data-source]').forEach(carte => {
    const sourceName = carte.getAttribute('data-source');
    if (sourceName) {
      // Trouver la clé de la source correspondante
      const sourceKey = Object.keys(customSources).find(key => {
        return window.sourcesMetadata && window.sourcesMetadata[key] && window.sourcesMetadata[key].name === sourceName;
      });
      carte.style.display = (sourceKey && sourceVisible(customSources, sourceKey, connues)) ? '' : 'none';
    }
  });
}

// Crée un panneau de configuration du flux personnalisé
function createCustomFluxPanel() {
  if (document.getElementById('container-custom-flux')) return;

  const container = document.createElement('div');
  container.id = 'container-custom-flux';
  container.className = 'categorie-container';
  container.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'categorie-backdrop';
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopover(); });

  const panneau = document.createElement('div');
  panneau.id = 'custom-flux-panneau';
  panneau.className = 'categorie-panneau';

  const header = document.createElement('div');
  header.className = 'panneau-entete panneau-entete-ligne';

  const titre = document.createElement('h2');
  titre.textContent = '⚙️ Personnaliser mon flux';

  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.className = 'categorie-fermer';
  fermer.setAttribute('aria-label', 'Fermer');
  fermer.textContent = '×';
  fermer.classList.add('fermer-entete');
  fermer.addEventListener('click', () => closePopover());

  header.appendChild(titre);
  header.appendChild(fermer);
  panneau.appendChild(header);

  const contenuContainer = document.createElement('div');
  contenuContainer.className = 'panneau-defilant';

  // Bouton tout cocher/décocher
  const toggleAllDiv = document.createElement('div');
  toggleAllDiv.className = 'custom-flux-toggle-all';
  const toggleAllBtn = document.createElement('button');
  toggleAllBtn.type = 'button';
  toggleAllBtn.className = 'panneau-bouton';
  toggleAllBtn.textContent = '✓ Tout cocher';

  toggleAllBtn.addEventListener('click', () => {
    const allCheckboxes = contenuContainer.querySelectorAll('.custom-flux-checkbox');
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);

    allCheckboxes.forEach(checkbox => {
      checkbox.checked = !allChecked;
      const selected = getCustomFluxSources();
      if (checkbox.checked) {
        selected[checkbox.value] = true;
      } else {
        delete selected[checkbox.value];
      }
      saveCustomFluxSources(selected);
    });

    toggleAllBtn.textContent = allChecked ? '✓ Tout cocher' : '✗ Tout décocher';
  });

  toggleAllDiv.appendChild(toggleAllBtn);
  contenuContainer.appendChild(toggleAllDiv);

  // Construire les listes de sources par catégorie
  const savedSources = getCustomFluxSources();

  // Récupérer les catégories et sources dans le bon ordre
  const categoriesToSources = {};

  // Utiliser les métadonnées si disponibles
  if (window.sourcesMetadata) {
    Object.entries(window.sourcesMetadata).forEach(([sourceKey, metadata]) => {
      const category = metadata.category || 'Autres';
      const name = metadata.name || sourceKey;

      if (!categoriesToSources[category]) {
        categoriesToSources[category] = [];
      }
      categoriesToSources[category].push({ key: sourceKey, name });
    });
  } else if (window.sourcesData) {
    // Fallback : construire depuis sourcesData
    Object.keys(window.sourcesData).forEach(sourceKey => {
      let sourceCategory = 'Autres';
      let sourceName = sourceKey;

      if (window.sourcesData[sourceKey][0]) {
        sourceName = window.sourcesData[sourceKey][0].source || sourceKey;
      }

      if (!categoriesToSources[sourceCategory]) {
        categoriesToSources[sourceCategory] = [];
      }
      categoriesToSources[sourceCategory].push({ key: sourceKey, name: sourceName });
    });
  }

  // Afficher les checkboxes par catégorie (groupées)
  Object.entries(categoriesToSources).forEach(([categoryName, sources]) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'custom-flux-category';

    const categoryTitle = document.createElement('h3');
    categoryTitle.className = 'custom-flux-category-title';
    categoryTitle.textContent = categoryName;
    categoryDiv.appendChild(categoryTitle);

    // Groupe des checkboxes pour cette catégorie
    const checkboxesGroup = document.createElement('div');
    checkboxesGroup.className = 'custom-flux-checkboxes-group';

    sources.forEach(({ key, name }) => {
      const label = document.createElement('label');
      label.className = 'custom-flux-checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = key;
      checkbox.className = 'custom-flux-checkbox';
      checkbox.checked = !!savedSources[key];
      checkbox.addEventListener('change', (e) => {
        const selected = getCustomFluxSources();
        if (e.target.checked) {
          selected[key] = true;
        } else {
          delete selected[key];
        }
        saveCustomFluxSources(selected);
        updateFluxPersonnalise();
      });

      const span = document.createElement('span');
      span.textContent = name;

      label.appendChild(checkbox);
      label.appendChild(span);
      checkboxesGroup.appendChild(label);
    });

    categoryDiv.appendChild(checkboxesGroup);
    contenuContainer.appendChild(categoryDiv);
  });

  // Boutons d'action
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'panneau-actions';

  const btnViewFlux = document.createElement('button');
  btnViewFlux.type = 'button';
  btnViewFlux.textContent = '👁️ Voir mon flux';
  btnViewFlux.className = 'panneau-bouton';
  btnViewFlux.addEventListener('click', () => {
    if (isFluxPersonnalise()) {
      openCustomFluxPanel();
      closePopover();
    } else {
      alert('Sélectionnez au moins une source');
    }
  });

  const btnResetAll = document.createElement('button');
  btnResetAll.type = 'button';
  btnResetAll.textContent = '🔄 Réinitialiser';
  btnResetAll.className = 'panneau-bouton';
  btnResetAll.addEventListener('click', () => {
    if (confirm('Réinitialiser le flux personnalisé ?')) {
      localStorage.removeItem(CUSTOM_FLUX_KEY);
      window.location.reload();
    }
  });

  actionsDiv.appendChild(btnViewFlux);
  if (isFluxPersonnalise()) {
    actionsDiv.appendChild(btnResetAll);
  }

  panneau.appendChild(contenuContainer);
  panneau.appendChild(actionsDiv);

  container.appendChild(backdrop);
  container.appendChild(panneau);
  document.body.appendChild(container);
}

// Affiche le panneau du flux personnalisé (articles filtrés)
function openCustomFluxPanel() {
  const customSources = getCustomFluxSources();
  if (Object.keys(customSources).length === 0) {
    alert('Aucune source sélectionnée');
    return;
  }

  // Filtrer les articles des sources sélectionnées
  const articles = [];
  Object.keys(customSources).forEach(sourceKey => {
    if (window.sourcesData && window.sourcesData[sourceKey]) {
      articles.push(...window.sourcesData[sourceKey]);
    }
  });

  // Trier par date décroissante
  articles.sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  // Créer le panneau
  creerPanneauArticles({
    id: 'custom-flux-articles',
    titre: '📰 Mon flux personnalisé',
    cle: 'custom-flux',
    articles: articles,
    ancre: page => 'custom-flux&p=' + page,
    galerie: true
  });

  const customId = 'custom-flux-articles';
  showPopover(customId);
}

// Mise à jour de la page quand le flux change
function updateFluxPersonnalise() {
  const indicator = document.getElementById('custom-flux-indicator');
  if (isFluxPersonnalise()) {
    if (indicator) {
      indicator.style.display = 'inline';
    }
  } else {
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
}

// Initialiser quand le DOM est prêt
// Démarrage à DOMContentLoaded, donc après tout le bundle : en defer, readyState vaut déjà « interactive »
// et les constantes de notifications.js (plus bas dans le même fichier) ne seraient pas encore définies.
function demarrerFluxPersonnalise() {
  appliquerFiltreAccueil();
  annoncerNouvellesSources();
}
if (document.readyState === 'complete') demarrerFluxPersonnalise();
else document.addEventListener('DOMContentLoaded', demarrerFluxPersonnalise);

// Lien « Personnaliser flux » venu d'une autre page : /?flux=personnaliser ouvre le panneau de l'accueil.
// En bas du fichier : le panneau a besoin de toutes les fonctions de ce script.
// Ouvre le panneau « Personnaliser mon flux ». Il a besoin des sources de l'accueil : ailleurs, on y renvoie.
function ouvrirPersonnalisation() {
  if (document.body.dataset.page !== 'accueil') {
    location.href = '/?flux=personnaliser';
    return;
  }
  createCustomFluxPanel();
  showPopover('custom-flux');
}

if (document.body.dataset.page === 'accueil' && new URLSearchParams(location.search).get('flux') === 'personnaliser') {
  history.replaceState(null, '', '/');
  ouvrirPersonnalisation();
}
