// Mode sobre : bouton du menu ⚙️, pluie retirée, feuille style_sobre.css ajoutée et retirée, mémorisé.
const { attendre, charger, clic, suite } = require('./outils');

(async () => {
  const t = suite('Mode sobre');

  // Thème red_neon : il a la pluie et sa propre feuille, donc le cas utile
  const { w, d, erreurs } = charger('index.html', '/', {
    avant: (f) => { f.localStorage.setItem('kioske-theme', 'red_neon'); },
  });
  await attendre(200);
  const bouton = d.getElementById('btn-sobre');

  t.verif('bouton présent, désactivé par défaut', bouton && bouton.getAttribute('aria-pressed') === 'false');
  t.verif('thème avec pluie : pluie présente', Boolean(d.getElementById('pluie')));
  t.verif('pas de feuille sobre tant que le mode est coupé', !d.getElementById('sobre-css'));

  clic(w, bouton);
  t.verif('activé : attribut sobre sur <html>', d.documentElement.dataset.sobre === 'oui');
  t.verif('activé : pluie retirée', !d.getElementById('pluie'));
  t.verif('activé : feuille sobre ajoutée', Boolean(d.getElementById('sobre-css')) && d.getElementById('sobre-css').href.endsWith('/style_sobre.css'));
  t.verif('activé : mémorisé', w.localStorage.getItem('kioske-sobre') === '1');
  t.verif('activé : bouton annonce l\'état', bouton.getAttribute('aria-pressed') === 'true' && bouton.textContent.includes('activé'));

  clic(w, bouton);
  t.verif('désactivé : attribut sobre retiré', d.documentElement.dataset.sobre === 'non');
  t.verif('désactivé : pluie revenue', Boolean(d.getElementById('pluie')));
  t.verif('désactivé : feuille sobre coupée', d.getElementById('sobre-css').disabled === true);
  t.verif('désactivé : mémorisé', w.localStorage.getItem('kioske-sobre') === '0');
  w.close();

  // Rechargement avec le mode déjà choisi : appliqué dès le départ, sans pluie
  const seconde = charger('index.html', '/', {
    avant: (f) => {
      f.localStorage.setItem('kioske-theme', 'red_neon');
      f.localStorage.setItem('kioske-sobre', '1');
    },
  });
  await attendre(200);
  t.verif('rechargement : mode sobre appliqué', seconde.d.documentElement.dataset.sobre === 'oui');
  t.verif('rechargement : pas de pluie', !seconde.d.getElementById('pluie'));
  t.verif('rechargement : feuille sobre active', seconde.d.getElementById('sobre-css') && seconde.d.getElementById('sobre-css').disabled === false);
  t.verif('rechargement : bouton à « activé »', seconde.d.getElementById('btn-sobre').getAttribute('aria-pressed') === 'true');
  t.verif('aucune erreur JavaScript', seconde.erreurs.length === 0, seconde.erreurs.join(' | '));
  seconde.w.close();

  t.fin();
})();
