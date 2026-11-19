// Page Paramètres et personnalisation du flux, depuis la disparition du menu ⚙️ :
// /?flux=personnaliser ouvre le panneau sur l'accueil ; les interrupteurs de galerie de la page Paramètres marchent.
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Page Paramètres et personnalisation du flux');

  // 1. Lien « Personnaliser mon flux » : le panneau s'ouvre sur l'accueil, l'adresse redevient /
  let r = charger('index.html', '/?flux=personnaliser');
  await attendre(300);
  const panneau = r.d.getElementById('container-custom-flux');
  t.verif('?flux=personnaliser : panneau de personnalisation ouvert', !!panneau && !panneau.hidden);
  t.verif('?flux=personnaliser : le paramètre est retiré de l\'adresse', r.w.location.search === '');
  t.verif('accueil : aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  r.w.close();

  // 2. Page Paramètres : lien de personnalisation et interrupteurs des galeries
  r = charger('menu/parametres/index.html', '/menu/parametres/');
  await attendre(200);
  const d = r.d;
  t.verif('lien « Personnaliser mon flux » présent', !!d.querySelector('main a[href="/?flux=personnaliser"]'));
  const blocs = d.getElementById('btn-galeries-blocs');
  const grande = d.getElementById('btn-grande-galerie');
  const plusLus = d.getElementById('btn-galerie-plus-lus');
  t.verif('trois interrupteurs de galerie présents', !!blocs && !!grande && !!plusLus);
  t.verif('les plus lus : affichée par défaut', d.documentElement.dataset.galeriePlusLus === 'oui' && plusLus.textContent.includes('affichée'));
  t.verif('grande galerie : affichée par défaut', d.documentElement.dataset.grandeGalerie === 'oui' && grande.textContent.includes('affichée'));
  t.verif('galeries des catégories : masquées par défaut', d.documentElement.dataset.galeriesBlocs === 'non' && blocs.textContent.includes('masquées'));
  blocs.click();
  await attendre(30);
  t.verif('galeries des catégories : affichées après clic', d.documentElement.dataset.galeriesBlocs === 'oui' && blocs.textContent.includes('affichées'));
  t.verif('galeries des catégories : choix mémorisé', r.w.localStorage.getItem('kioske-galeries-blocs') === '1');
  grande.click();
  await attendre(30);
  t.verif('grande galerie : masquée après clic', d.documentElement.dataset.grandeGalerie === 'non' && r.w.localStorage.getItem('kioske-grande-galerie') === '0');
  plusLus.click();
  await attendre(30);
  t.verif('les plus lus : masquée après clic', d.documentElement.dataset.galeriePlusLus === 'non' && r.w.localStorage.getItem('kioske-galerie-plus-lus') === '0');
  t.verif('Paramètres : aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  r.w.close();
  t.fin();
})();
