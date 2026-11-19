// Recherche en direct : les résultats arrivent pendant la frappe (après une courte pause), le champ garde
// le curseur, aucun résultat donne un message (pas d'alerte), champ vidé = panneau fermé.
// Raccourcis de l'app installée : /?recherche (curseur dans le champ) et /?favoris (panneau des favoris).
const { attendre, charger, suite } = require('./outils');

const ouvert = (d, id) => { const c = d.getElementById(id); return !!c && !c.hidden; };
const taper = (w, champ, texte) => { champ.focus(); champ.value = texte; champ.dispatchEvent(new w.Event('input', { bubbles: true })); };

(async () => {
  const t = suite('Recherche en direct et raccourcis');
  let { w, d, erreurs } = charger('index.html', '/');
  await attendre(300);
  const champ = d.getElementById('recherche');
  const mot = Object.values(w.categoriesData)[0][0].title.split(/\s+/).find(m => m.length > 4) || 'a';

  taper(w, champ, mot.slice(0, 1));
  await attendre(450);
  t.verif('une lettre : pas de recherche', !ouvert(d, 'container-search-results'));

  taper(w, champ, mot);
  await attendre(100);
  t.verif('pendant la frappe : pas encore de recherche', !ouvert(d, 'container-search-results'));
  await attendre(450);
  t.verif('après la pause : panneau des résultats ouvert', ouvert(d, 'container-search-results'), '« ' + mot + ' »');
  t.verif('des cartes de résultats', d.querySelectorAll('#search-results-grille a.carte').length > 0);
  t.verif('le champ garde le curseur', d.activeElement === champ);

  taper(w, champ, 'zzqxwv-introuvable');
  await attendre(450);
  t.verif('aucun résultat : message dans le panneau', /Aucun résultat/.test(d.getElementById('search-results-grille').textContent));
  t.verif('aucun résultat : pas d\'alerte', !(w.alertes || []).length, (w.alertes || []).join(' | '));
  t.verif('aucun résultat : compte (0)', d.querySelector('#search-results-panneau h2 .compte').textContent === '(0)');

  taper(w, champ, '');
  await attendre(100);
  t.verif('champ vidé : panneau fermé', !ouvert(d, 'container-search-results'));
  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();

  ({ w, d, erreurs } = charger('index.html', '/?recherche'));
  await attendre(300);
  t.verif('raccourci /?recherche : curseur dans le champ', d.activeElement === d.getElementById('recherche'));
  w.close();

  ({ w, d, erreurs } = charger('index.html', '/?favoris'));
  await attendre(300);
  t.verif('raccourci /?favoris : panneau des favoris ouvert', ouvert(d, 'container-favoris'));
  t.verif('raccourcis : aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t.fin();
})();
