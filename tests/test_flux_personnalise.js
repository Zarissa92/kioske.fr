// Flux personnalisé : une source ajoutée après l'enregistrement du choix reste visible ; une source décochée
// alors qu'elle était connue reste masquée ; un ancien choix (sans liste des sources connues) garde son comportement.
const { attendre, charger, suite } = require('./outils');

const A = 'https://revueladeferlante.fr/feed/';
const B = 'https://www.outrans.org/feed/';
const C = 'https://www.problematik-media.com/feed.xml';
const NOUVELLE = 'https://www.inter-lgbt.org/feed/';

// Tuiles visibles de la sous-catégorie FR, par nom de source
async function tuilesVisibles(avant) {
  const { w, d, erreurs } = charger('index.html', '/', { avant });
  await attendre(300);
  const tuiles = [...d.querySelectorAll('.sous-categorie .nuage .tag')]
    .filter(t => t.closest('.sous-categorie').querySelector('h2').dataset.categoryName === 'FR');
  return { visibles: tuiles.filter(t => t.style.display !== 'none').map(t => t.dataset.sourceKey), erreurs };
}

(async () => {
  const t = suite('Flux personnalisé : sources nouvelles et décochées');
  const choix = { [A]: true, [B]: true, [C]: true };

  // Choix enregistré quand la source NOUVELLE n'existait pas encore : elle doit rester visible.
  let r = await tuilesVisibles((f) => {
    f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify(choix));
    f.localStorage.setItem('kioske_flux_connus', JSON.stringify([A, B, C]));
  });
  t.verif('source ajoutée après le choix : visible', r.visibles.includes(NOUVELLE), '(' + r.visibles.length + ' tuiles)');
  t.verif('sources cochées : visibles', [A, B, C].every(k => r.visibles.includes(k)));
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));

  // Source décochée alors qu'elle était connue : masquée.
  r = await tuilesVisibles((f) => {
    f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify({ [A]: true, [B]: true }));
    f.localStorage.setItem('kioske_flux_connus', JSON.stringify([A, B, C, NOUVELLE]));
  });
  t.verif('source décochée et connue : masquée', !r.visibles.includes(C));
  t.verif('source connue du choix mais non cochée : masquée aussi', !r.visibles.includes(NOUVELLE));

  // Ancien choix, sans liste des sources connues : même comportement qu'avant (seules les cochées).
  r = await tuilesVisibles((f) => {
    f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify(choix));
  });
  t.verif('ancien choix sans liste : seules les cochées', r.visibles.length === 3 && !r.visibles.includes(NOUVELLE), '(' + r.visibles.length + ')');
  t.fin();
})();
