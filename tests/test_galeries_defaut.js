// Galeries affichées par défaut, réglées dans kioske.cfg ([site] galerie_plus_lus, grande_galerie, galeries_blocs) :
// le build les écrit dans <script id="kioske-themes"> ; theme.js les applique tant que le visiteur n'a rien choisi.
const { attendre, charger, suite } = require('./outils');

const inverse = (html) => html.replace(/"galeries": \{[^}]*\}/, '"galeries": {"plus_lus": false, "grande": false, "blocs": true}');

(async () => {
  const t = suite('Galeries par défaut (kioske.cfg)');
  let r = charger('index.html', '/');
  await attendre(100);
  const racine = r.d.documentElement.dataset;
  t.verif('valeurs du dépôt : « Les plus lus » et « Les derniers articles »', racine.galeriePlusLus === 'oui' && racine.grandeGalerie === 'oui' && racine.galeriesBlocs === 'non');
  r.w.close();

  r = charger('index.html', '/', { html: inverse });
  await attendre(100);
  const inv = r.d.documentElement.dataset;
  t.verif('valeurs changées dans la page : appliquées', inv.galeriePlusLus === 'non' && inv.grandeGalerie === 'non' && inv.galeriesBlocs === 'oui');
  r.w.close();

  r = charger('index.html', '/', { html: inverse, avant: (w) => w.localStorage.setItem('kioske-grande-galerie', '1') });
  await attendre(100);
  t.verif('le choix du visiteur l\'emporte', r.d.documentElement.dataset.grandeGalerie === 'oui');
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  t.fin();
})();
