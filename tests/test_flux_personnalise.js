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
    .filter(t => t.closest('.sous-categorie').querySelector('.titre-categorie').dataset.categoryName === 'FR');
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

  // Bandeau « nouveau flux ajouté » : affiché à l'ouverture, une seule fois par source.
  async function bandeau(avant) {
    const { w, d, erreurs } = charger('index.html', '/', { avant });
    await attendre(300);
    return { w, d, texte: d.getElementById('flux-nouveau')?.textContent || null, erreurs };
  }
  // Comme au vrai enregistrement : toutes les sources présentes sur la page sont « connues », sauf NOUVELLE
  // (qui n'existait pas encore au moment du choix).
  const { d: pageSansChoix } = charger('index.html', '/');
  const presentes = [...new Set([...pageSansChoix.querySelectorAll('.nuage .tag')].map(t => t.dataset.sourceKey))];
  const connusSansNouvelle = presentes.filter(k => k !== NOUVELLE);
  t.verif('la page contient la source nouvelle', presentes.includes(NOUVELLE));
  const connus = (f) => {
    f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify(choix));
    f.localStorage.setItem('kioske_flux_connus', JSON.stringify(connusSansNouvelle));
  };
  let b = await bandeau(connus);
  t.verif('source nouvelle : bandeau affiché', b.texte !== null && b.texte.includes('Nouveau flux ajouté'), b.texte || '');
  t.verif('bandeau non fermé : pas encore marqué comme annoncé', !JSON.parse(b.w.localStorage.getItem('kioske_flux_annonces') || '[]').includes(NOUVELLE));
  t.verif('cloche : point rouge (notification en attente)', b.w.document.getElementById('btn-notifications').classList.contains('a-notif'));
  t.verif('bandeau : aucune erreur JavaScript', b.erreurs.length === 0, b.erreurs.join(' | '));
  t.verif('nouveau flux : activé par défaut dans le choix personnalisé', JSON.parse(b.w.localStorage.getItem('kioske_flux_personnalise') || '{}')[NOUVELLE] === true);

  // Décochée après activation automatique : elle reste décochée au chargement suivant.
  b = await bandeau((f) => {
    f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify(choix));
    f.localStorage.setItem('kioske_flux_connus', JSON.stringify(connusSansNouvelle));
    f.localStorage.setItem('kioske_flux_activees_auto', JSON.stringify([NOUVELLE]));
  });
  t.verif('source déjà activée automatiquement puis décochée : reste décochée', !JSON.parse(b.w.localStorage.getItem('kioske_flux_personnalise') || '{}')[NOUVELLE]);

  // Quitter sans fermer le bandeau : il revient à la visite suivante (même stockage).
  const stockage = (w) => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
  const sauve = stockage(b.w);
  b = await bandeau((f) => { for (const [k, v] of Object.entries(sauve)) f.localStorage.setItem(k, v); });
  t.verif('bandeau non fermé : revient à la visite suivante', b.texte !== null && b.texte.includes('Inter-LGBT'));

  // Fermer le bandeau (OK) : la source est marquée, le bandeau ne revient plus.
  b.d.querySelector('#flux-nouveau .flux-nouveau-actions button:last-child').click();
  t.verif('OK : source marquée comme annoncée', JSON.parse(b.w.localStorage.getItem('kioske_flux_annonces') || '[]').includes(NOUVELLE));
  const sauve2 = stockage(b.w);
  b = await bandeau((f) => { for (const [k, v] of Object.entries(sauve2)) f.localStorage.setItem(k, v); });
  t.verif('source déjà annoncée : pas de bandeau', b.texte === null);

  b = await bandeau((f) => { f.localStorage.setItem('kioske_flux_personnalise', JSON.stringify(choix)); });
  t.verif('ancien choix sans liste : pas de bandeau', b.texte === null);
  t.fin();
})();
