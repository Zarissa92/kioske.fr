// Données de l'accueil. Python les écrit en JSON dans <script type="application/json" id="kioske-donnees">
// (kioske/rendu.py) ; ce script les lit et les range là où le reste du code les attend.
// Les articles des panneaux (par source et par catégorie, plusieurs Mo) ne sont pas dans la page : ils sont
// dans un fichier à part (donnees_panneaux, /donnees-accueil.json), téléchargé au premier panneau ouvert.
// Tant qu'il n'est pas chargé, window.sourcesData et window.categoriesData valent null.
let promesseDonneesAccueil = null;
let adresseDonneesPanneaux = '';

(function () {
  const element = document.getElementById('kioske-donnees');
  if (!element) return;   // page sans données (texte) : rien à ranger
  const donnees = JSON.parse(element.textContent);
  window.sourcesMetadata = donnees.sources_metadata; // métadonnées des sources (nom, catégorie)
  window.galeriePanneau = donnees.galerie_panneau ?? 1; // afficher galeries dans panneaux (1 = oui, 0 = non)
  adresseDonneesPanneaux = donnees.donnees_panneaux || '';
  // Page sans fichier de panneaux (Menu, article, catégorie) : données vides, disponibles tout de suite
  window.sourcesData = adresseDonneesPanneaux ? null : (donnees.sources || {});
  window.categoriesData = adresseDonneesPanneaux ? null : (donnees.categories || {});
})();

// Les catégories du fichier ne recopient pas les articles : chaque entrée est une référence [rang de la source,
// rang de l'article dans cette source] (kioske/rendu.py). On la remplace par l'article lui-même (même objet que
// dans sources : rien n'est dupliqué en mémoire). Une entrée qui est déjà un article (ancien fichier gardé en
// cache) est prise telle quelle.
function categoriesDepuisReferences(sources, categories) {
  const listes = Object.values(sources);
  const resultat = {};
  Object.entries(categories).forEach(([nom, entrees]) => {
    resultat[nom] = entrees
      .map(e => (Array.isArray(e) ? (listes[e[0]] || [])[e[1]] : e))
      .filter(Boolean);
  });
  return resultat;
}

// Charge les articles des panneaux (une seule fois) ; la promesse se résout quand window.sourcesData et
// window.categoriesData sont remplis. En cas d'échec (réseau), elle est rejetée et un appel suivant réessaie.
function chargerDonneesAccueil() {
  if (window.sourcesData && window.categoriesData) return Promise.resolve();
  if (!promesseDonneesAccueil) {
    promesseDonneesAccueil = fetch(adresseDonneesPanneaux)
      .then(reponse => {
        if (!reponse.ok) throw new Error('données des panneaux : HTTP ' + reponse.status);
        return reponse.json();
      })
      .then(donnees => {
        const sources = donnees.sources || {};
        window.sourcesData = sources;
        window.categoriesData = categoriesDepuisReferences(sources, donnees.categories || {});
      })
      .catch(erreur => {
        promesseDonneesAccueil = null;
        throw erreur;
      });
  }
  return promesseDonneesAccueil;
}

// Lance action() une fois les données des panneaux chargées. Le curseur d'attente s'affiche pendant le
// téléchargement (premier panneau seulement) ; sans réseau, un message le dit au lieu d'un panneau vide.
function avecDonneesAccueil(action) {
  if (window.sourcesData && window.categoriesData) { action(); return; }
  document.documentElement.classList.add('chargement-donnees');
  chargerDonneesAccueil()
    .then(action, () => alert('Impossible de charger les articles : vérifie ta connexion, puis réessaie.'))
    .finally(() => document.documentElement.classList.remove('chargement-donnees'));
}
