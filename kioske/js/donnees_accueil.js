// Données de l'accueil. Python les écrit en JSON dans <script type="application/json" id="kioske-donnees">
// (kioske/rendu.py) ; ce script les lit et les range là où le reste du code les attend.
(function () {
  const donnees = JSON.parse(document.getElementById('kioske-donnees').textContent);
  window.sourcesData = donnees.sources;        // articles groupés par source (clé du flux)
  window.categoriesData = donnees.categories;  // articles groupés par catégorie
  window.conductCode = donnees.conduite;       // contenu du code de conduite
})();
